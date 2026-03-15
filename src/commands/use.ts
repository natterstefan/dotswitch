import { loadConfig } from '../lib/config.js'
import { copyFiles } from '../lib/copy.js'
import { getActiveEnv, listEnvFiles, switchEnv } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import { resolvePaths } from '../lib/paths.js'
import { promptEnvSelection } from '../lib/prompt.js'
import type { UseOptions } from '../types.js'

async function useSinglePath(
  env: string | undefined,
  options: UseOptions,
  dir: string,
  showPrefix: boolean,
): Promise<void> {
  const prefix = showPrefix ? `[${dir}] ` : ''
  const sourceDir = options.sourceDir
  const files = listEnvFiles(sourceDir ?? dir)

  if (files.length === 0) {
    logger.error(`${prefix}No .env.* files found`)
    process.exitCode = 1
    return
  }

  if (!env) {
    if (!process.stdin.isTTY) {
      logger.error(
        `${prefix}No environment specified. Usage: dotswitch use <env>`,
      )
      process.exitCode = 1
      return
    }
    env = await promptEnvSelection(files)
  }

  const available = files.find(f => f.env === env)
  if (!available) {
    logger.error(
      `${prefix}Environment "${env}" not found. Available: ${files.map(f => f.env).join(', ')}`,
    )
    process.exitCode = 1
    return
  }

  const activeEnv = getActiveEnv(dir)
  if (activeEnv === env && !options.force) {
    logger.info(`${prefix}Already using "${env}"`)
    return
  }

  const config = loadConfig(sourceDir ?? dir)
  const { extraFiles } = config

  if (options.dryRun) {
    const from = sourceDir ? ` (from ${sourceDir})` : ''
    logger.info(`${prefix}Would switch to ${env}${from}`)
    if (options.backup) {
      logger.info(`${prefix}Would back up .env.local to .env.local.backup`)
    }
    if (sourceDir && extraFiles.length > 0) {
      for (const file of extraFiles) {
        logger.info(`${prefix}Would copy ${file}`)
      }
    }
    return
  }

  try {
    switchEnv(dir, env, { backup: options.backup, sourceDir })
    const from = sourceDir ? ` (from ${sourceDir})` : ''
    logger.success(`${prefix}Switched to ${env}${from}`)
  } catch (error) {
    logger.error(
      `${prefix}${error instanceof Error ? error.message : 'Failed to switch environment'}`,
    )
    process.exitCode = 1
    return
  }

  if (sourceDir && extraFiles.length > 0) {
    const results = copyFiles(extraFiles, sourceDir, dir, {
      force: true,
      dryRun: false,
    })
    for (const result of results) {
      if (result.status === 'copied') {
        logger.success(`${prefix}Copied ${result.file}`)
      } else if (result.status === 'not_found') {
        logger.warn(`${prefix}${result.file} not found in ${sourceDir}`)
      }
    }
  }
}

export async function useCommand(
  env: string | undefined,
  options: UseOptions,
): Promise<void> {
  const dirs = resolvePaths(options.path)

  if (dirs.length === 0) {
    logger.error('No directories match the given path pattern')
    process.exitCode = 1
    return
  }

  const showPrefix = dirs.length > 1
  for (const dir of dirs) {
    await useSinglePath(env, options, dir, showPrefix)
  }
}

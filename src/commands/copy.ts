import { copyFiles } from '../lib/copy.js'
import { resolveProjectRoot } from '../lib/git.js'
import { logger } from '../lib/logger.js'
import type { CopyOptions } from '../types.js'

interface CopyCommandOptions extends CopyOptions {
  cwd: string
}

export function copyCommand(
  files: string[],
  options: CopyCommandOptions,
): void {
  const projectRoot = resolveProjectRoot(options.cwd)

  if (projectRoot === options.cwd) {
    logger.error(
      'Not in a worktree — copy requires a worktree so there is a source to copy from',
    )
    process.exitCode = 1
    return
  }

  const results = copyFiles(files, projectRoot, options.cwd, {
    force: options.force,
    dryRun: options.dryRun,
  })

  let hasError = false
  for (const result of results) {
    switch (result.status) {
      case 'copied':
        if (options.dryRun) {
          logger.info(`Would copy ${result.file}`)
        } else {
          logger.success(`Copied ${result.file}`)
        }
        break
      case 'skipped':
        logger.warn(`${result.file} already exists (use --force to overwrite)`)
        break
      case 'not_found':
        logger.error(`${result.file} not found in ${projectRoot}`)
        hasError = true
        break
    }
  }

  if (hasError) {
    process.exitCode = 1
  }
}

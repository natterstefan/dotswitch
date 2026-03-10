import { getActiveEnv } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import type { CommonOptions } from '../types.js'

export function currentCommand(options: CommonOptions): void {
  const activeEnv = getActiveEnv(options.path)

  if (options.json) {
    console.log(JSON.stringify({ active: activeEnv ?? null }))
    if (!activeEnv) {
      process.exitCode = 1
    }
    return
  }

  const isTTY = process.stdout.isTTY

  if (activeEnv) {
    if (isTTY) {
      logger.info(`Active environment: ${activeEnv}`)
    } else {
      console.log(activeEnv)
    }
  } else {
    if (isTTY) {
      logger.warn('No active environment detected')
    }
    process.exitCode = 1
  }
}

import { getActiveEnv, restoreEnvLocal } from '../lib/env.js'
import { logger } from '../lib/logger.js'
import type { CommonOptions } from '../types.js'

export function restoreCommand(options: Pick<CommonOptions, 'path'>): void {
  try {
    restoreEnvLocal(options.path)
    const activeEnv = getActiveEnv(options.path)
    if (activeEnv) {
      logger.success(`Restored .env.local from backup (now: ${activeEnv})`)
    } else {
      logger.success('Restored .env.local from backup')
    }
  } catch (error) {
    logger.error(
      error instanceof Error ? error.message : 'Failed to restore backup',
    )
    process.exitCode = 1
  }
}

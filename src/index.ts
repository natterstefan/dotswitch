export type { DotswitchConfig } from './lib/config.js'
export {
  defineConfig,
  getBackupFile,
  getTargetFile,
  loadConfig,
} from './lib/config.js'
export type { CopyResult } from './lib/copy.js'
export { copyFiles } from './lib/copy.js'
export {
  backupEnvLocal,
  getActiveEnv,
  listEnvFiles,
  restoreEnvLocal,
  switchEnv,
} from './lib/env.js'
export { resolveCommonGitDir, resolveProjectRoot } from './lib/git.js'
export type { EnvDiff } from './lib/parser.js'
export { diffEnvMaps, parseEnvContent } from './lib/parser.js'
export {
  addTrackerHeader,
  createTrackerHeader,
  parseTrackerHeader,
  removeTrackerHeader,
} from './lib/tracker.js'
export type {
  CommonOptions,
  CopyOptions,
  EnvFile,
  UseOptions,
} from './types.js'

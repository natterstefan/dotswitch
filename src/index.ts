export { listEnvFiles, getActiveEnv, switchEnv, backupEnvLocal, restoreEnvLocal } from "./lib/env.js";
export { loadConfig, getTargetFile, getBackupFile } from "./lib/config.js";
export type { DotswitchConfig } from "./lib/config.js";
export {
  createTrackerHeader,
  parseTrackerHeader,
  addTrackerHeader,
  removeTrackerHeader,
} from "./lib/tracker.js";
export { parseEnvContent, diffEnvMaps } from "./lib/parser.js";
export type { EnvDiff } from "./lib/parser.js";
export type { EnvFile, UseOptions, CommonOptions } from "./types.js";

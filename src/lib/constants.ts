export const ENV_LOCAL = '.env.local'
export const ENV_LOCAL_BACKUP = '.env.local.backup'
export const TRACKER_PREFIX = '# dotswitch:'

export const EXCLUDED_ENV_FILES: Set<string> = new Set([
  '.env',
  '.env.local',
  '.env.local.backup',
  '.env.example',
])

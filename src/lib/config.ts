import fs from 'node:fs'
import path from 'node:path'
import { createJiti } from 'jiti'
import { logger } from './logger.js'

/**
 * Config file search order (first match wins):
 * 1. dotswitch.config.ts
 * 2. dotswitch.config.js
 * 3. dotswitch.config.mjs
 * 4. dotswitch.config.cjs
 */
const CONFIG_FILES = [
  'dotswitch.config.ts',
  'dotswitch.config.js',
  'dotswitch.config.mjs',
  'dotswitch.config.cjs',
] as const

export interface DotswitchConfig {
  /** Target file to write to (default: ".env.local") */
  target: string
  /** File patterns to exclude from env listing */
  exclude: string[]
  /** Branch-to-env mappings for git hook auto-switching */
  hooks: Record<string, string>
  /** Extra files to copy from the main repo root on every switch (worktrees only) */
  extraFiles: string[]
}

export const DEFAULT_CONFIG: DotswitchConfig = {
  target: '.env.local',
  exclude: [],
  hooks: {},
  extraFiles: [],
}

/**
 * Helper to provide type-safe config with IDE intellisense.
 *
 * @example
 * ```ts
 * // dotswitch.config.ts
 * import { defineConfig } from "dotswitch";
 * export default defineConfig({ target: ".env", exclude: [".env.test"] });
 * ```
 */
export function defineConfig(
  config: Partial<DotswitchConfig>,
): Partial<DotswitchConfig> {
  return config
}

function mergeWithDefaults(raw: Partial<DotswitchConfig>): DotswitchConfig {
  return {
    target: raw.target ?? DEFAULT_CONFIG.target,
    exclude: raw.exclude ?? DEFAULT_CONFIG.exclude,
    hooks: raw.hooks ?? DEFAULT_CONFIG.hooks,
    extraFiles: raw.extraFiles ?? DEFAULT_CONFIG.extraFiles,
  }
}

function loadJsConfig(
  configPath: string,
): Partial<DotswitchConfig> | undefined {
  try {
    const jiti = createJiti(import.meta.url, { interopDefault: true })
    const raw = jiti(configPath) as
      | Partial<DotswitchConfig>
      | { default: Partial<DotswitchConfig> }

    // Unwrap default export for ESM/TS modules
    const config =
      raw && typeof raw === 'object' && 'default' in raw ? raw.default : raw

    return config as Partial<DotswitchConfig>
  } catch (error) {
    logger.debug(
      `config: failed to load ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return undefined
  }
}

export function loadConfig(
  dir: string,
  fsModule: typeof fs = fs,
): DotswitchConfig {
  for (const filename of CONFIG_FILES) {
    const configPath = path.join(dir, filename)
    if (fsModule.existsSync(configPath)) {
      const raw = loadJsConfig(configPath)
      if (raw) {
        const config = mergeWithDefaults(raw)
        logger.debug(`config: loaded ${filename} from ${dir}`)
        logger.debug(
          `config: target=${config.target}, exclude=[${config.exclude.join(', ')}], hooks={${Object.keys(config.hooks).join(', ')}}`,
        )
        return config
      }
    }
  }

  logger.debug(`config: no config file found in ${dir}, using defaults`)
  return { ...DEFAULT_CONFIG }
}

export function getTargetFile(config: DotswitchConfig): string {
  return config.target
}

export function getBackupFile(config: DotswitchConfig): string {
  return `${config.target}.backup`
}

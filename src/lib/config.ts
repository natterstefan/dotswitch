import fs from 'node:fs'
import path from 'node:path'
import { createJiti } from 'jiti'

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
}

export const DEFAULT_CONFIG: DotswitchConfig = {
  target: '.env.local',
  exclude: [],
  hooks: {},
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
  } catch {
    // Invalid config — fall through
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
        return mergeWithDefaults(raw)
      }
    }
  }

  return { ...DEFAULT_CONFIG }
}

export function getTargetFile(config: DotswitchConfig): string {
  return config.target
}

export function getBackupFile(config: DotswitchConfig): string {
  return `${config.target}.backup`
}

import fs from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { logger } from "./logger.js";

/**
 * Config file search order (first match wins):
 * 1. dotswitch.config.ts
 * 2. dotswitch.config.js
 * 3. dotswitch.config.mjs
 * 4. dotswitch.config.cjs
 * 5. .dotswitchrc.json (deprecated)
 */
const CONFIG_FILES = [
  "dotswitch.config.ts",
  "dotswitch.config.js",
  "dotswitch.config.mjs",
  "dotswitch.config.cjs",
] as const;

const LEGACY_CONFIG = ".dotswitchrc.json";

export interface DotswitchConfig {
  /** Target file to write to (default: ".env.local") */
  target: string;
  /** File patterns to exclude from env listing */
  exclude: string[];
  /** Branch-to-env mappings for git hook auto-switching */
  hooks: Record<string, string>;
}

export const DEFAULT_CONFIG: DotswitchConfig = {
  target: ".env.local",
  exclude: [],
  hooks: {},
};

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
export function defineConfig(config: Partial<DotswitchConfig>): Partial<DotswitchConfig> {
  return config;
}

function mergeWithDefaults(raw: Partial<DotswitchConfig>): DotswitchConfig {
  return {
    target: raw.target ?? DEFAULT_CONFIG.target,
    exclude: raw.exclude ?? DEFAULT_CONFIG.exclude,
    hooks: raw.hooks ?? DEFAULT_CONFIG.hooks,
  };
}

function loadJsConfig(
  configPath: string,
): Partial<DotswitchConfig> | undefined {
  try {
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    const raw = jiti(configPath) as
      | Partial<DotswitchConfig>
      | { default: Partial<DotswitchConfig> };

    // Unwrap default export for ESM/TS modules
    const config =
      raw && typeof raw === "object" && "default" in raw
        ? raw.default
        : raw;

    return config as Partial<DotswitchConfig>;
  } catch {
    // Invalid config — fall through
    return undefined;
  }
}

function loadJsonConfig(
  configPath: string,
  fsModule: typeof fs,
): Partial<DotswitchConfig> | undefined {
  try {
    if (fsModule.existsSync(configPath)) {
      logger.warn(
        `.dotswitchrc.json is deprecated. Migrate to dotswitch.config.ts (or .js/.mjs/.cjs).`,
      );
      return JSON.parse(
        fsModule.readFileSync(configPath, "utf-8"),
      ) as Partial<DotswitchConfig>;
    }
  } catch {
    // Invalid config — fall through
  }
  return undefined;
}

export function loadConfig(
  dir: string,
  fsModule: typeof fs = fs,
): DotswitchConfig {
  // 1. Search for JS/TS config files (first match wins)
  for (const filename of CONFIG_FILES) {
    const configPath = path.join(dir, filename);
    if (fsModule.existsSync(configPath)) {
      const raw = loadJsConfig(configPath);
      if (raw) {
        return mergeWithDefaults(raw);
      }
    }
  }

  // 2. Fall back to legacy .dotswitchrc.json (deprecated)
  const legacyPath = path.join(dir, LEGACY_CONFIG);
  const raw = loadJsonConfig(legacyPath, fsModule);
  if (raw) {
    return mergeWithDefaults(raw);
  }

  return { ...DEFAULT_CONFIG };
}

export function getTargetFile(config: DotswitchConfig): string {
  return config.target;
}

export function getBackupFile(config: DotswitchConfig): string {
  return `${config.target}.backup`;
}

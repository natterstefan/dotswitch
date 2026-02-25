import fs from "node:fs";
import path from "node:path";

const CONFIG_FILENAME = ".dotswitchrc.json";

export interface DotswitchConfig {
  /** Target file to write to (default: ".env.local") */
  target: string;
  /** File patterns to exclude from env listing */
  exclude: string[];
  /** Branch-to-env mappings for git hook auto-switching */
  hooks: Record<string, string>;
}

const DEFAULT_CONFIG: DotswitchConfig = {
  target: ".env.local",
  exclude: [],
  hooks: {},
};

export function loadConfig(
  dir: string,
  fsModule: typeof fs = fs,
): DotswitchConfig {
  const configPath = path.join(dir, CONFIG_FILENAME);
  try {
    if (fsModule.existsSync(configPath)) {
      const raw = JSON.parse(
        fsModule.readFileSync(configPath, "utf-8"),
      ) as Partial<DotswitchConfig>;
      return {
        target: raw.target ?? DEFAULT_CONFIG.target,
        exclude: raw.exclude ?? DEFAULT_CONFIG.exclude,
        hooks: raw.hooks ?? DEFAULT_CONFIG.hooks,
      };
    }
  } catch {
    // Invalid config — fall through to defaults
  }
  return { ...DEFAULT_CONFIG };
}

export function getTargetFile(config: DotswitchConfig): string {
  return config.target;
}

export function getBackupFile(config: DotswitchConfig): string {
  return `${config.target}.backup`;
}

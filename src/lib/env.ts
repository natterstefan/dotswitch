import fs from "node:fs";
import path from "node:path";
import { EXCLUDED_ENV_FILES } from "./constants.js";
import { addTrackerHeader, parseTrackerHeader } from "./tracker.js";
import { logger } from "./logger.js";
import { loadConfig, getTargetFile, getBackupFile } from "./config.js";
import type { DotswitchConfig } from "./config.js";
import type { EnvFile } from "../types.js";

function resolveConfig(
  dir: string,
  config: DotswitchConfig | undefined,
  fsModule: typeof fs,
): DotswitchConfig {
  return config ?? loadConfig(dir, fsModule);
}

export function listEnvFiles(
  dir: string,
  fsModule: typeof fs = fs,
  config?: DotswitchConfig,
): EnvFile[] {
  const cfg = resolveConfig(dir, config, fsModule);
  const entries = fsModule.readdirSync(dir);
  const activeEnv = getActiveEnv(dir, fsModule, cfg);

  const target = getTargetFile(cfg);
  const backup = getBackupFile(cfg);
  const excluded = new Set([
    ...EXCLUDED_ENV_FILES,
    ...cfg.exclude,
    target,
    backup,
  ]);

  return entries
    .filter(
      (name) =>
        name.startsWith(".env.") &&
        !excluded.has(name),
    )
    .sort()
    .map((name) => {
      const env = name.replace(/^\.env\./, "");
      return {
        name,
        env,
        path: path.join(dir, name),
        active: env === activeEnv,
      };
    });
}

export function getActiveEnv(
  dir: string,
  fsModule: typeof fs = fs,
  config?: DotswitchConfig,
): string | null {
  const cfg = resolveConfig(dir, config, fsModule);
  const targetPath = path.join(dir, getTargetFile(cfg));
  try {
    const content = fsModule.readFileSync(targetPath, "utf-8");
    return parseTrackerHeader(content);
  } catch {
    return null;
  }
}

export function backupEnvLocal(
  dir: string,
  fsModule: typeof fs = fs,
  config?: DotswitchConfig,
): boolean {
  const cfg = resolveConfig(dir, config, fsModule);
  const target = getTargetFile(cfg);
  const targetPath = path.join(dir, target);
  const backupPath = path.join(dir, getBackupFile(cfg));
  try {
    if (fsModule.existsSync(targetPath)) {
      fsModule.copyFileSync(targetPath, backupPath);
      return true;
    }
    return false;
  } catch (error) {
    logger.warn(
      `Failed to back up ${target}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}

export function restoreEnvLocal(
  dir: string,
  fsModule: typeof fs = fs,
  config?: DotswitchConfig,
): void {
  const cfg = resolveConfig(dir, config, fsModule);
  const target = getTargetFile(cfg);
  const backup = getBackupFile(cfg);
  const backupPath = path.join(dir, backup);
  const targetPath = path.join(dir, target);

  if (!fsModule.existsSync(backupPath)) {
    throw new Error(`No backup file found (${backup})`);
  }

  fsModule.copyFileSync(backupPath, targetPath);
}

export function switchEnv(
  dir: string,
  env: string,
  options: { backup: boolean; sourceDir?: string } = { backup: true },
  fsModule: typeof fs = fs,
  config?: DotswitchConfig,
): void {
  const cfg = resolveConfig(dir, config, fsModule);
  const srcDir = options.sourceDir ?? dir;
  const sourcePath = path.join(srcDir, `.env.${env}`);
  const targetPath = path.join(dir, getTargetFile(cfg));

  if (!fsModule.existsSync(sourcePath)) {
    throw new Error(`Environment file .env.${env} does not exist`);
  }

  if (options.backup) {
    backupEnvLocal(dir, fsModule, cfg);
  }

  const content = fsModule.readFileSync(sourcePath, "utf-8");
  const tracked = addTrackerHeader(content, env);
  fsModule.writeFileSync(targetPath, tracked, "utf-8");
}

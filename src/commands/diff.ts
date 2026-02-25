import fs from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { ENV_LOCAL } from "../lib/constants.js";
import { parseEnvContent, diffEnvMaps } from "../lib/parser.js";
import { removeTrackerHeader } from "../lib/tracker.js";
import { logger } from "../lib/logger.js";

export interface DiffOptions {
  path: string;
  showValues: boolean;
  json: boolean;
}

function readEnvFile(dir: string, name: string): string {
  const filePath = name === ".env.local"
    ? path.join(dir, ENV_LOCAL)
    : path.join(dir, `.env.${name}`);

  if (!fs.existsSync(filePath)) {
    // Try as a literal filename (e.g. ".env.local")
    const literal = path.join(dir, name);
    if (fs.existsSync(literal)) {
      return removeTrackerHeader(fs.readFileSync(literal, "utf-8"));
    }
    throw new Error(`File not found: ${name}`);
  }

  return removeTrackerHeader(fs.readFileSync(filePath, "utf-8"));
}

export function diffCommand(
  env1: string,
  env2: string | undefined,
  options: DiffOptions,
): void {
  try {
    // If only one arg given, compare .env.local against that env
    const fromName = env2 ? env1 : ".env.local";
    const toName = env2 ?? env1;

    const fromContent = readEnvFile(options.path, fromName);
    const toContent = readEnvFile(options.path, toName);

    const fromMap = parseEnvContent(fromContent);
    const toMap = parseEnvContent(toContent);
    const diff = diffEnvMaps(fromMap, toMap);

    if (options.json) {
      const output: Record<string, unknown> = {
        from: fromName,
        to: toName,
        added: diff.added,
        removed: diff.removed,
        changed: diff.changed,
      };
      if (options.showValues) {
        output.details = {
          added: Object.fromEntries(diff.added.map((k) => [k, toMap.get(k)])),
          removed: Object.fromEntries(diff.removed.map((k) => [k, fromMap.get(k)])),
          changed: Object.fromEntries(
            diff.changed.map((k) => [k, { from: fromMap.get(k), to: toMap.get(k) }]),
          ),
        };
      }
      console.log(JSON.stringify(output));
      return;
    }

    const hasChanges = diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0;

    if (!hasChanges) {
      logger.success(`${fromName} and ${toName} are identical`);
      return;
    }

    console.log(pc.bold(`\nComparing ${fromName} → ${toName}\n`));

    if (diff.added.length > 0) {
      console.log(pc.green(`Added (${diff.added.length}):`));
      for (const key of diff.added) {
        const val = options.showValues ? ` = ${toMap.get(key)}` : "";
        console.log(pc.green(`  + ${key}${val}`));
      }
      console.log();
    }

    if (diff.removed.length > 0) {
      console.log(pc.red(`Removed (${diff.removed.length}):`));
      for (const key of diff.removed) {
        const val = options.showValues ? ` = ${fromMap.get(key)}` : "";
        console.log(pc.red(`  - ${key}${val}`));
      }
      console.log();
    }

    if (diff.changed.length > 0) {
      console.log(pc.yellow(`Changed (${diff.changed.length}):`));
      for (const key of diff.changed) {
        if (options.showValues) {
          console.log(pc.yellow(`  ~ ${key}: ${fromMap.get(key)} → ${toMap.get(key)}`));
        } else {
          console.log(pc.yellow(`  ~ ${key}`));
        }
      }
      console.log();
    }
  } catch (error) {
    logger.error(
      error instanceof Error ? error.message : "Failed to diff environments",
    );
    process.exitCode = 1;
  }
}

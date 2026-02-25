import pc from "picocolors";
import { listEnvFiles } from "../lib/env.js";
import { logger } from "../lib/logger.js";
import type { CommonOptions } from "../types.js";

export function lsCommand(options: CommonOptions): void {
  const files = listEnvFiles(options.path);

  if (options.json) {
    const output = files.map(({ name, env, active }) => ({
      name,
      env,
      active,
    }));
    console.log(JSON.stringify(output));
    if (files.length === 0) {
      process.exitCode = 1;
    }
    return;
  }

  if (files.length === 0) {
    logger.warn("No .env.* files found");
    process.exitCode = 1;
    return;
  }

  console.log(pc.bold("Available environments:\n"));
  for (const file of files) {
    const marker = file.active ? pc.green("▸ ") : "  ";
    const name = file.active ? pc.green(pc.bold(file.env)) : file.env;
    const label = file.active ? ` ${pc.dim("(active)")}` : "";
    console.log(`${marker}${name}${label}`);
  }
}

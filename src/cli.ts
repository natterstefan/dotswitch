import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { useCommand } from "./commands/use.js";
import { lsCommand } from "./commands/ls.js";
import { currentCommand } from "./commands/current.js";
import { restoreCommand } from "./commands/restore.js";
import { diffCommand } from "./commands/diff.js";
import { hookInstallCommand, hookRemoveCommand, hookBranchCommand } from "./commands/hook.js";
import { resolveProjectRoot } from "./lib/git.js";
import { EXCLUDED_ENV_FILES } from "./lib/constants.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

/**
 * Check whether a directory contains any `.env.*` source files
 * (i.e. files that dotswitch would operate on, excluding standard non-source files).
 */
function hasEnvFiles(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(
      (name) => name.startsWith(".env.") && !EXCLUDED_ENV_FILES.has(name),
    );
  } catch {
    return false;
  }
}

/**
 * Resolve the effective path for a command.
 * - No --path given: if in a worktree with local env files, operate locally;
 *   otherwise resolve to the main repo root.
 * - Explicit --path: rebase it relative to the main repo when in a worktree,
 *   so glob patterns like "./apps/*" expand against the main repo.
 */
function resolveCommandPath(explicitPath: string | undefined): string {
  const cwd = process.cwd();
  const projectRoot = resolveProjectRoot(cwd);

  if (!explicitPath) {
    if (projectRoot !== cwd && hasEnvFiles(cwd)) {
      return cwd;
    }
    return projectRoot;
  }

  // Not in a worktree — use the explicit path as-is
  if (projectRoot === cwd) return explicitPath;

  // Worktree: rebase the explicit path relative to the main repo
  const absolute = path.resolve(explicitPath);
  const relative = path.relative(cwd, absolute);
  return path.resolve(projectRoot, relative);
}

const program = new Command();

program
  .name("dotswitch")
  .description("Quickly switch between .env files")
  .version(pkg.version);

program
  .command("use [env]")
  .description("Switch to a .env.<env> file (interactive if no env given)")
  .option("-f, --force", "skip confirmation if already active", false)
  .option("--no-backup", "skip .env.local backup")
  .option("-n, --dry-run", "show what would happen without making changes", false)
  .option("-p, --path <dir>", "project directory")
  .option("--hook-branch <branch>", "internal: auto-switch by branch name")
  .action(async (env: string | undefined, opts) => {
    const projectPath = resolveCommandPath(opts.path);
    if (opts.hookBranch) {
      hookBranchCommand(opts.hookBranch, { path: projectPath });
      return;
    }
    await useCommand(env, {
      force: opts.force,
      backup: opts.backup,
      dryRun: opts.dryRun,
      path: projectPath,
    });
  });

program
  .command("ls")
  .description("List available .env.* files")
  .option("-p, --path <dir>", "project directory")
  .option("--json", "output as JSON", false)
  .action((opts) => {
    lsCommand({ path: resolveCommandPath(opts.path), json: opts.json });
  });

program
  .command("current")
  .description("Show the currently active environment")
  .option("-p, --path <dir>", "project directory")
  .option("--json", "output as JSON", false)
  .action((opts) => {
    currentCommand({ path: resolveCommandPath(opts.path), json: opts.json });
  });

program
  .command("restore")
  .description("Restore .env.local from the backup file")
  .option("-p, --path <dir>", "project directory")
  .action((opts) => {
    restoreCommand({ path: resolveCommandPath(opts.path) });
  });

program
  .command("diff <env1> [env2]")
  .description("Compare keys between two env files (defaults: .env.local vs env1)")
  .option("-p, --path <dir>", "project directory")
  .option("--show-values", "show actual values in the diff", false)
  .option("--json", "output as JSON", false)
  .action((env1: string, env2: string | undefined, opts) => {
    diffCommand(env1, env2, {
      path: resolveCommandPath(opts.path),
      showValues: opts.showValues,
      json: opts.json,
    });
  });

const hookCmd = program
  .command("hook")
  .description("Manage git post-checkout hook for auto-switching");

hookCmd
  .command("install")
  .description("Install the post-checkout git hook")
  .option("-p, --path <dir>", "project directory")
  .action((opts) => {
    hookInstallCommand({ path: resolveCommandPath(opts.path) });
  });

hookCmd
  .command("remove")
  .description("Remove the post-checkout git hook")
  .option("-p, --path <dir>", "project directory")
  .action((opts) => {
    hookRemoveCommand({ path: resolveCommandPath(opts.path) });
  });

program.parse();

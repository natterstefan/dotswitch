import { createRequire } from "node:module";
import { Command } from "commander";
import { useCommand } from "./commands/use.js";
import { lsCommand } from "./commands/ls.js";
import { currentCommand } from "./commands/current.js";
import { restoreCommand } from "./commands/restore.js";
import { diffCommand } from "./commands/diff.js";
import { hookInstallCommand, hookRemoveCommand, hookBranchCommand } from "./commands/hook.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { version: string };

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
  .option("-p, --path <dir>", "project directory", process.cwd())
  .option("--hook-branch <branch>", "internal: auto-switch by branch name")
  .action(async (env: string | undefined, opts) => {
    if (opts.hookBranch) {
      hookBranchCommand(opts.hookBranch, { path: opts.path });
      return;
    }
    await useCommand(env, {
      force: opts.force,
      backup: opts.backup,
      dryRun: opts.dryRun,
      path: opts.path,
    });
  });

program
  .command("ls")
  .description("List available .env.* files")
  .option("-p, --path <dir>", "project directory", process.cwd())
  .option("--json", "output as JSON", false)
  .action((opts) => {
    lsCommand({ path: opts.path, json: opts.json });
  });

program
  .command("current")
  .description("Show the currently active environment")
  .option("-p, --path <dir>", "project directory", process.cwd())
  .option("--json", "output as JSON", false)
  .action((opts) => {
    currentCommand({ path: opts.path, json: opts.json });
  });

program
  .command("restore")
  .description("Restore .env.local from the backup file")
  .option("-p, --path <dir>", "project directory", process.cwd())
  .action((opts) => {
    restoreCommand({ path: opts.path });
  });

program
  .command("diff <env1> [env2]")
  .description("Compare keys between two env files (defaults: .env.local vs env1)")
  .option("-p, --path <dir>", "project directory", process.cwd())
  .option("--show-values", "show actual values in the diff", false)
  .option("--json", "output as JSON", false)
  .action((env1: string, env2: string | undefined, opts) => {
    diffCommand(env1, env2, {
      path: opts.path,
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
  .option("-p, --path <dir>", "project directory", process.cwd())
  .action((opts) => {
    hookInstallCommand({ path: opts.path });
  });

hookCmd
  .command("remove")
  .description("Remove the post-checkout git hook")
  .option("-p, --path <dir>", "project directory", process.cwd())
  .action((opts) => {
    hookRemoveCommand({ path: opts.path });
  });

program.parse();

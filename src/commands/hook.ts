import { installHook, removeHook, matchBranchToEnv } from "../lib/hooks.js";
import { loadConfig } from "../lib/config.js";
import { switchEnv } from "../lib/env.js";
import { logger } from "../lib/logger.js";

export function hookInstallCommand(options: { path: string }): void {
  try {
    const config = loadConfig(options.path);
    if (Object.keys(config.hooks).length === 0) {
      logger.warn(
        'No hook mappings defined. Add "hooks" to your dotswitch config first.',
      );
      logger.info('Example: export default { hooks: { "staging/*": "staging" } }');
      process.exitCode = 1;
      return;
    }

    const result = installHook(options.path);
    if (result.created) {
      logger.success("Installed post-checkout hook");
    } else {
      logger.success("Updated post-checkout hook");
    }
  } catch (error) {
    logger.error(
      error instanceof Error ? error.message : "Failed to install hook",
    );
    process.exitCode = 1;
  }
}

export function hookRemoveCommand(options: { path: string }): void {
  try {
    const removed = removeHook(options.path);
    if (removed) {
      logger.success("Removed dotswitch post-checkout hook");
    } else {
      logger.info("No dotswitch hook found");
    }
  } catch (error) {
    logger.error(
      error instanceof Error ? error.message : "Failed to remove hook",
    );
    process.exitCode = 1;
  }
}

export function hookBranchCommand(
  branch: string,
  options: { path: string },
): void {
  const config = loadConfig(options.path);
  const env = matchBranchToEnv(branch, config.hooks);
  if (!env) return; // No match — silently do nothing

  try {
    switchEnv(options.path, env, { backup: true });
    logger.success(`Auto-switched to ${env} (branch: ${branch})`);
  } catch {
    // Silently fail in hook context — don't block git operations
  }
}

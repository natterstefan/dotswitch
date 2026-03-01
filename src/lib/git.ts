import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger.js";

function git(dir: string, ...args: string[]): string | null {
  try {
    return execFileSync("git", ["-C", dir, ...args], {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error
        ? String((error as NodeJS.ErrnoException & { stderr: unknown }).stderr).trim()
        : "";
    if (stderr) {
      logger.warn(`git ${args.join(" ")}: ${stderr}`);
    }
    return null;
  }
}

/**
 * Resolve the common (shared) git directory for a project.
 * - Regular repos: returns <dir>/.git
 * - Worktrees: returns the main repo's .git directory
 * - Non-git directories: returns null
 */
export function resolveCommonGitDir(dir: string): string | null {
  const gitPath = path.join(dir, ".git");

  // Regular repo — no need to shell out
  try {
    if (fs.statSync(gitPath).isDirectory()) return gitPath;
  } catch {
    return null;
  }

  // Worktree — ask git for the common dir
  const result = git(dir, "rev-parse", "--git-common-dir");
  if (!result) return null;
  return path.isAbsolute(result) ? result : path.resolve(dir, result);
}

/**
 * Resolve the project root directory.
 * In a worktree, this returns the main repo's root (parent of its .git dir).
 * Otherwise returns the given directory as-is.
 */
export function resolveProjectRoot(dir: string): string {
  const gitPath = path.join(dir, ".git");

  let stats: fs.Stats;
  try {
    stats = fs.statSync(gitPath);
  } catch {
    return dir;
  }

  // Regular repo — already at project root
  if (stats.isDirectory()) {
    return dir;
  }

  // Worktree — resolve to the main repo root
  if (stats.isFile()) {
    const commonGitDir = resolveCommonGitDir(dir);
    if (commonGitDir) return path.dirname(commonGitDir);
  }

  return dir;
}

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { matchBranchToEnv, installHook, removeHook } from "../../src/lib/hooks.js";

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

describe("hooks", () => {
  describe("installHook / removeHook", () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "dotswitch-hook-test-")));
    });

    afterEach(() => {
      // Remove worktrees before deleting tmpDir so git doesn't leave stale entries
      for (const entry of fs.readdirSync(tmpDir)) {
        const dotGit = path.join(tmpDir, entry, ".git");
        try {
          if (fs.statSync(dotGit).isDirectory()) {
            execFileSync("git", ["-C", path.join(tmpDir, entry), "worktree", "prune"], { stdio: "pipe" });
          }
        } catch { /* not a repo — skip */ }
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("installs hook in a regular git repo", () => {
      const repoDir = path.join(tmpDir, "repo");
      fs.mkdirSync(repoDir);
      git(repoDir, "init");
      git(repoDir, "commit", "--allow-empty", "-m", "init");

      const result = installHook(repoDir);

      expect(result.created).toBe(true);
      expect(result.path).toBe(path.join(repoDir, ".git", "hooks", "post-checkout"));
      expect(fs.existsSync(result.path)).toBe(true);
    });

    it("installs hook in the shared .git/hooks from a worktree", () => {
      const mainDir = path.join(tmpDir, "main");
      const wtDir = path.join(tmpDir, "feature-wt");
      fs.mkdirSync(mainDir);
      git(mainDir, "init");
      git(mainDir, "commit", "--allow-empty", "-m", "init");
      git(mainDir, "worktree", "add", wtDir, "-b", "feature");

      const result = installHook(wtDir);

      expect(result.created).toBe(true);
      expect(result.path).toBe(path.join(mainDir, ".git", "hooks", "post-checkout"));
      expect(fs.existsSync(result.path)).toBe(true);
    });

    it("removes hook from the shared .git/hooks via worktree", () => {
      const mainDir = path.join(tmpDir, "main");
      const wtDir = path.join(tmpDir, "feature-wt");
      fs.mkdirSync(mainDir);
      git(mainDir, "init");
      git(mainDir, "commit", "--allow-empty", "-m", "init");
      git(mainDir, "worktree", "add", wtDir, "-b", "feature");

      installHook(wtDir);
      const removed = removeHook(wtDir);

      expect(removed).toBe(true);
      expect(
        fs.existsSync(path.join(mainDir, ".git", "hooks", "post-checkout")),
      ).toBe(false);
    });

    it("throws when not a git repo", () => {
      expect(() => installHook(tmpDir)).toThrow("Not a git repository");
    });
  });

  describe("matchBranchToEnv", () => {
    const hooks = {
      main: "production",
      "staging/*": "staging",
      "dev*": "development",
    };

    it("matches exact branch name", () => {
      expect(matchBranchToEnv("main", hooks)).toBe("production");
    });

    it("matches prefix/* glob pattern", () => {
      expect(matchBranchToEnv("staging/feat-login", hooks)).toBe("staging");
    });

    it("matches prefix* glob pattern", () => {
      expect(matchBranchToEnv("develop", hooks)).toBe("development");
      expect(matchBranchToEnv("dev-branch", hooks)).toBe("development");
    });

    it("returns null for no match", () => {
      expect(matchBranchToEnv("feature/unmatched", hooks)).toBeNull();
    });

    it("prefers exact match over glob", () => {
      const hooks = { dev: "exact", "dev*": "glob" };
      expect(matchBranchToEnv("dev", hooks)).toBe("exact");
    });

    it("returns null for empty hooks", () => {
      expect(matchBranchToEnv("main", {})).toBeNull();
    });
  });
});

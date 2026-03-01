import fs from "node:fs";
import path from "node:path";
import { resolveCommonGitDir } from "./git.js";

const HOOK_FILENAME = "post-checkout";

const HOOK_MARKER_START = "# >>> dotswitch hook >>>";
const HOOK_MARKER_END = "# <<< dotswitch hook <<<";

function getHookScript(): string {
  return `${HOOK_MARKER_START}
# Auto-switch .env files based on branch name
BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)
if [ -n "$BRANCH" ] && command -v dotswitch >/dev/null 2>&1; then
  dotswitch use --hook-branch "$BRANCH" 2>/dev/null || true
fi
${HOOK_MARKER_END}`;
}

function getHooksDir(dir: string): string | null {
  const gitDir = resolveCommonGitDir(dir);
  if (!gitDir) return null;
  return path.join(gitDir, "hooks");
}

export function installHook(dir: string): { created: boolean; path: string } {
  const hooksDir = getHooksDir(dir);
  if (!hooksDir) {
    throw new Error("Not a git repository");
  }

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, HOOK_FILENAME);
  const hookScript = getHookScript();

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, "utf-8");
    if (existing.includes(HOOK_MARKER_START)) {
      // Already installed — update in place
      const before = existing.slice(0, existing.indexOf(HOOK_MARKER_START));
      const after = existing.slice(
        existing.indexOf(HOOK_MARKER_END) + HOOK_MARKER_END.length,
      );
      fs.writeFileSync(hookPath, before + hookScript + after, { mode: 0o755 });
      return { created: false, path: hookPath };
    }
    // Append to existing hook
    fs.appendFileSync(hookPath, `\n${hookScript}\n`);
    fs.chmodSync(hookPath, 0o755);
    return { created: false, path: hookPath };
  }

  // Create new hook file
  fs.writeFileSync(hookPath, `#!/bin/sh\n${hookScript}\n`, { mode: 0o755 });
  return { created: true, path: hookPath };
}

export function removeHook(dir: string): boolean {
  const hooksDir = getHooksDir(dir);
  if (!hooksDir) {
    throw new Error("Not a git repository");
  }

  const hookPath = path.join(hooksDir, HOOK_FILENAME);
  if (!fs.existsSync(hookPath)) return false;

  const content = fs.readFileSync(hookPath, "utf-8");
  if (!content.includes(HOOK_MARKER_START)) return false;

  const before = content.slice(0, content.indexOf(HOOK_MARKER_START));
  const after = content.slice(
    content.indexOf(HOOK_MARKER_END) + HOOK_MARKER_END.length,
  );

  const remaining = (before + after).trim();
  if (!remaining || remaining === "#!/bin/sh") {
    // Nothing left — remove the file
    fs.unlinkSync(hookPath);
  } else {
    fs.writeFileSync(hookPath, remaining + "\n", { mode: 0o755 });
  }
  return true;
}

/**
 * Match a branch name against hook patterns from config.
 * Supports simple glob patterns: "staging/*" matches "staging/feat-x".
 */
export function matchBranchToEnv(
  branch: string,
  hooks: Record<string, string>,
): string | null {
  // Exact match first
  if (hooks[branch]) return hooks[branch];

  // Glob pattern match
  for (const [pattern, env] of Object.entries(hooks)) {
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      if (branch.startsWith(`${prefix}/`)) return env;
    } else if (pattern.endsWith("*")) {
      const prefix = pattern.slice(0, -1);
      if (branch.startsWith(prefix)) return env;
    }
  }

  return null;
}

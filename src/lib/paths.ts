import fs from "node:fs";
import path from "node:path";

/**
 * Resolve a path pattern that may contain a simple glob (* wildcard).
 * Returns an array of matching directories.
 * Non-glob paths return a single-element array.
 */
export function resolvePaths(pattern: string): string[] {
  // Not a glob — return as-is
  if (!pattern.includes("*")) {
    return [path.resolve(pattern)];
  }

  const parts = pattern.split("*");
  if (parts.length !== 2) {
    // Only support single * wildcard
    return [path.resolve(pattern)];
  }

  const baseDir = path.resolve(parts[0]);
  const suffix = parts[1];

  if (!fs.existsSync(baseDir)) return [];

  const entries = fs.readdirSync(baseDir);
  return entries
    .map((entry) => path.join(baseDir, entry) + suffix)
    .filter((p) => {
      try {
        return fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    })
    .sort();
}

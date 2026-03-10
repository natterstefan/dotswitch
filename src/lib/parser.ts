/**
 * Parse a .env file into a key-value map.
 * Strips comments (lines starting with #) and empty lines.
 */
export function parseEnvContent(content: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()
    if (key) result.set(key, value)
  }
  return result
}

export interface EnvDiff {
  added: string[]
  removed: string[]
  changed: string[]
  unchanged: string[]
}

/**
 * Compute the diff between two parsed env maps.
 * "added" = keys in `to` but not in `from`.
 * "removed" = keys in `from` but not in `to`.
 * "changed" = keys in both with different values.
 */
export function diffEnvMaps(
  from: Map<string, string>,
  to: Map<string, string>,
): EnvDiff {
  const added: string[] = []
  const removed: string[] = []
  const changed: string[] = []
  const unchanged: string[] = []

  for (const key of from.keys()) {
    if (!to.has(key)) {
      removed.push(key)
    } else if (from.get(key) !== to.get(key)) {
      changed.push(key)
    } else {
      unchanged.push(key)
    }
  }

  for (const key of to.keys()) {
    if (!from.has(key)) {
      added.push(key)
    }
  }

  return {
    added: added.sort(),
    removed: removed.sort(),
    changed: changed.sort(),
    unchanged: unchanged.sort(),
  }
}

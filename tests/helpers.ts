import type fs from 'node:fs'
import { fs as memfs, vol } from 'memfs'

export interface MockProject {
  fs: typeof fs
  dir: string
}

export function setupMockProject(
  files: Record<string, string> = {},
): MockProject {
  vol.reset()
  const dir = '/project'
  const structure: Record<string, string> = {}
  for (const [name, content] of Object.entries(files)) {
    structure[`${dir}/${name}`] = content
  }
  vol.fromJSON(structure)
  // Ensure the project directory always exists, even when no files are given
  vol.mkdirSync(dir, { recursive: true })
  return { fs: memfs as unknown as typeof fs, dir }
}

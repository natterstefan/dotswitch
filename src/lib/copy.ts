import fs from 'node:fs'
import path from 'node:path'
import type { CopyOptions } from '../types.js'

export type CopyResult = {
  file: string
  status: 'copied' | 'skipped' | 'not_found'
}

export function copyFiles(
  files: string[],
  sourceDir: string,
  targetDir: string,
  options: CopyOptions,
  fsModule: typeof fs = fs,
): CopyResult[] {
  return files.map(file => {
    const sourcePath = path.join(sourceDir, file)
    const targetPath = path.join(targetDir, file)

    if (!fsModule.existsSync(sourcePath)) {
      return { file, status: 'not_found' as const }
    }

    if (fsModule.existsSync(targetPath) && !options.force) {
      return { file, status: 'skipped' as const }
    }

    if (!options.dryRun) {
      fsModule.copyFileSync(sourcePath, targetPath)
    }

    return { file, status: 'copied' as const }
  })
}

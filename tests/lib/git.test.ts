import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveCommonGitDir, resolveProjectRoot } from '../../src/lib/git.js'

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    ['-c', 'user.name=test', '-c', 'user.email=test@test.com', ...args],
    {
      cwd,
      encoding: 'utf-8',
    },
  ).trim()
}

describe('git utilities', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'dotswitch-git-test-')),
    )
  })

  afterEach(() => {
    // Remove worktrees before deleting tmpDir so git doesn't leave stale entries
    for (const entry of fs.readdirSync(tmpDir)) {
      const dotGit = path.join(tmpDir, entry, '.git')
      try {
        if (fs.statSync(dotGit).isDirectory()) {
          execFileSync(
            'git',
            ['-C', path.join(tmpDir, entry), 'worktree', 'prune'],
            {
              stdio: 'pipe',
            },
          )
        }
      } catch {
        /* not a repo — skip */
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('resolveCommonGitDir', () => {
    it('returns .git directory for a regular repo', () => {
      const repoDir = path.join(tmpDir, 'repo')
      fs.mkdirSync(repoDir)
      git(repoDir, 'init')

      expect(resolveCommonGitDir(repoDir)).toBe(path.join(repoDir, '.git'))
    })

    it('returns the main .git dir from a worktree', () => {
      const mainDir = path.join(tmpDir, 'main')
      const wtDir = path.join(tmpDir, 'feature-wt')
      fs.mkdirSync(mainDir)
      git(mainDir, 'init')
      git(mainDir, 'commit', '--allow-empty', '-m', 'init')
      git(mainDir, 'worktree', 'add', wtDir, '-b', 'feature')

      expect(resolveCommonGitDir(wtDir)).toBe(path.join(mainDir, '.git'))
    })

    it('returns null for non-git directory', () => {
      expect(resolveCommonGitDir(tmpDir)).toBeNull()
    })
  })

  describe('resolveProjectRoot', () => {
    it('returns repo root for a regular repo', () => {
      const repoDir = path.join(tmpDir, 'repo')
      fs.mkdirSync(repoDir)
      git(repoDir, 'init')
      git(repoDir, 'commit', '--allow-empty', '-m', 'init')

      expect(resolveProjectRoot(repoDir)).toBe(repoDir)
    })

    it('returns main repo root from worktree root', () => {
      const mainDir = path.join(tmpDir, 'main')
      const wtDir = path.join(tmpDir, 'feature-wt')
      fs.mkdirSync(mainDir)
      git(mainDir, 'init')
      git(mainDir, 'commit', '--allow-empty', '-m', 'init')
      git(mainDir, 'worktree', 'add', wtDir, '-b', 'feature')

      expect(resolveProjectRoot(wtDir)).toBe(mainDir)
    })

    it('returns main repo root from main repo itself', () => {
      const mainDir = path.join(tmpDir, 'main')
      const wtDir = path.join(tmpDir, 'feature-wt')
      fs.mkdirSync(mainDir)
      git(mainDir, 'init')
      git(mainDir, 'commit', '--allow-empty', '-m', 'init')
      git(mainDir, 'worktree', 'add', wtDir, '-b', 'feature')

      expect(resolveProjectRoot(mainDir)).toBe(mainDir)
    })

    it('returns dir as-is for non-git directory', () => {
      expect(resolveProjectRoot(tmpDir)).toBe(tmpDir)
    })
  })

  describe('warning on git errors', () => {
    it('warns when git fails unexpectedly in a corrupt worktree', () => {
      const badDir = path.join(tmpDir, 'corrupt-wt')
      fs.mkdirSync(badDir, { recursive: true })
      // .git file pointing to a nonexistent directory — simulates a stale worktree
      fs.writeFileSync(path.join(badDir, '.git'), 'gitdir: /nonexistent/path\n')

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = resolveProjectRoot(badDir)

      expect(result).toBe(badDir) // falls back gracefully
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('git rev-parse --git-common-dir'),
      )

      consoleSpy.mockRestore()
    })
  })
})

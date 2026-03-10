import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadConfig } from '../src/lib/config.js'
import {
  backupEnvLocal,
  getActiveEnv,
  listEnvFiles,
  restoreEnvLocal,
  switchEnv,
} from '../src/lib/env.js'
import { resolveProjectRoot } from '../src/lib/git.js'
import { installHook } from '../src/lib/hooks.js'
import { diffEnvMaps, parseEnvContent } from '../src/lib/parser.js'

function git(cwd: string, ...args: string[]): string {
  return execFileSync(
    'git',
    [
      '-c',
      'user.name=test',
      '-c',
      'user.email=test@test.com',
      '-c',
      'init.defaultBranch=main',
      ...args,
    ],
    {
      cwd,
      encoding: 'utf-8',
    },
  ).trim()
}

describe('integration: real filesystem', () => {
  let tmpDir: string

  function writeFile(name: string, content: string): void {
    fs.writeFileSync(path.join(tmpDir, name), content, 'utf-8')
  }

  function readFile(name: string): string {
    return fs.readFileSync(path.join(tmpDir, name), 'utf-8')
  }

  function fileExists(name: string): boolean {
    return fs.existsSync(path.join(tmpDir, name))
  }

  beforeEach(() => {
    tmpDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'dotswitch-integration-')),
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

  describe('full switch workflow', () => {
    it('switches env, creates backup, and tracks active env', () => {
      writeFile(
        '.env.staging',
        'API_URL=https://staging.example.com\nDEBUG=true',
      )
      writeFile(
        '.env.production',
        'API_URL=https://api.example.com\nDEBUG=false',
      )
      writeFile('.env.local', 'API_URL=https://old.example.com')

      // List available envs
      const files = listEnvFiles(tmpDir)
      expect(files).toHaveLength(2)
      expect(files.map(f => f.env).sort()).toStrictEqual([
        'production',
        'staging',
      ])

      // No active env yet (no tracker header)
      expect(getActiveEnv(tmpDir)).toBeNull()

      // Switch to staging with backup
      switchEnv(tmpDir, 'staging', { backup: true })

      // Verify backup was created
      expect(fileExists('.env.local.backup')).toBe(true)
      expect(readFile('.env.local.backup')).toBe(
        'API_URL=https://old.example.com',
      )

      // Verify .env.local has tracker header and content
      const localContent = readFile('.env.local')
      expect(localContent).toContain('# dotswitch:staging')
      expect(localContent).toContain('API_URL=https://staging.example.com')

      // Verify active env
      expect(getActiveEnv(tmpDir)).toBe('staging')

      // List should show staging as active
      const updatedFiles = listEnvFiles(tmpDir)
      expect(updatedFiles.find(f => f.env === 'staging')?.active).toBe(true)
      expect(updatedFiles.find(f => f.env === 'production')?.active).toBe(false)

      // Switch to production
      switchEnv(tmpDir, 'production', { backup: true })
      expect(getActiveEnv(tmpDir)).toBe('production')
      expect(readFile('.env.local')).toContain(
        'API_URL=https://api.example.com',
      )
    })

    it('restores from backup', () => {
      writeFile('.env.staging', 'API=staging')
      writeFile('.env.production', 'API=production')

      // Switch to staging (creates .env.local)
      switchEnv(tmpDir, 'staging', { backup: false })
      expect(getActiveEnv(tmpDir)).toBe('staging')

      // Create backup, then switch to production
      switchEnv(tmpDir, 'production', { backup: true })
      expect(getActiveEnv(tmpDir)).toBe('production')

      // Restore should bring back staging
      restoreEnvLocal(tmpDir)
      expect(getActiveEnv(tmpDir)).toBe('staging')
    })

    it('throws when restoring without backup', () => {
      expect(() => restoreEnvLocal(tmpDir)).toThrow('No backup file found')
    })
  })

  describe('env file filtering', () => {
    it('excludes .env, .env.local, .env.local.backup, .env.example', () => {
      writeFile('.env', 'BASE=true')
      writeFile('.env.local', 'LOCAL=true')
      writeFile('.env.local.backup', 'BACKUP=true')
      writeFile('.env.example', 'EXAMPLE=true')
      writeFile('.env.staging', 'STAGING=true')

      const files = listEnvFiles(tmpDir)
      expect(files).toHaveLength(1)
      expect(files[0].env).toBe('staging')
    })
  })

  describe('diff workflow', () => {
    it('detects differences between env files', () => {
      const staging = 'API=staging\nDEBUG=true\nSHARED=same'
      const production = 'API=production\nNEW_KEY=value\nSHARED=same'

      const fromMap = parseEnvContent(staging)
      const toMap = parseEnvContent(production)
      const diff = diffEnvMaps(fromMap, toMap)

      expect(diff.added).toStrictEqual(['NEW_KEY'])
      expect(diff.removed).toStrictEqual(['DEBUG'])
      expect(diff.changed).toStrictEqual(['API'])
      expect(diff.unchanged).toStrictEqual(['SHARED'])
    })
  })

  describe('config file loading', () => {
    it('loads config from dotswitch.config.cjs on real filesystem', () => {
      writeFile(
        'dotswitch.config.cjs',
        `module.exports = {
        target: ".env",
        exclude: [".env.test"],
      };`,
      )

      const config = loadConfig(tmpDir)
      expect(config.target).toBe('.env')
      expect(config.exclude).toStrictEqual(['.env.test'])
    })

    it('returns defaults when config file does not exist', () => {
      const config = loadConfig(tmpDir)
      expect(config.target).toBe('.env.local')
      expect(config.exclude).toStrictEqual([])
    })
  })

  describe('backup', () => {
    it('creates and verifies real file backup', () => {
      writeFile('.env.local', 'ORIGINAL=content')

      const result = backupEnvLocal(tmpDir)
      expect(result).toBe(true)
      expect(readFile('.env.local.backup')).toBe('ORIGINAL=content')
    })

    it('returns false when nothing to back up', () => {
      expect(backupEnvLocal(tmpDir)).toBe(false)
    })
  })

  describe('custom target via config', () => {
    it('switches to .env instead of .env.local when configured', () => {
      writeFile('dotswitch.config.cjs', `module.exports = { target: ".env" };`)
      writeFile('.env.staging', 'API=staging')

      const config = loadConfig(tmpDir)
      switchEnv(tmpDir, 'staging', { backup: false }, undefined, config)

      expect(readFile('.env')).toContain('# dotswitch:staging')
      expect(readFile('.env')).toContain('API=staging')
      expect(getActiveEnv(tmpDir, undefined, config)).toBe('staging')
    })
  })

  describe('worktree support', () => {
    let mainRepoDir: string
    let worktreeDir: string

    beforeEach(() => {
      mainRepoDir = path.join(tmpDir, 'main-repo')
      worktreeDir = path.join(tmpDir, 'my-feature')

      // Create a real git repo with env files
      fs.mkdirSync(mainRepoDir, { recursive: true })
      git(mainRepoDir, 'init')
      git(mainRepoDir, 'commit', '--allow-empty', '-m', 'init')

      fs.writeFileSync(
        path.join(mainRepoDir, '.env.staging'),
        'API=https://staging.example.com\n',
      )
      fs.writeFileSync(
        path.join(mainRepoDir, '.env.production'),
        'API=https://api.example.com\n',
      )
      fs.writeFileSync(
        path.join(mainRepoDir, 'dotswitch.config.cjs'),
        `module.exports = { hooks: { main: "production" } };`,
      )

      // Create a real worktree
      git(mainRepoDir, 'worktree', 'add', worktreeDir, '-b', 'my-feature')
    })

    it('resolveProjectRoot returns main repo from worktree', () => {
      expect(resolveProjectRoot(worktreeDir)).toBe(mainRepoDir)
    })

    it('resolveProjectRoot returns dir as-is for normal repo', () => {
      expect(resolveProjectRoot(mainRepoDir)).toBe(mainRepoDir)
    })

    it('lists env files from main repo when running in worktree', () => {
      const projectRoot = resolveProjectRoot(worktreeDir)
      const files = listEnvFiles(projectRoot)

      expect(files.map(f => f.env).sort()).toStrictEqual([
        'production',
        'staging',
      ])
    })

    it('switches env in main repo from worktree', () => {
      const projectRoot = resolveProjectRoot(worktreeDir)

      switchEnv(projectRoot, 'staging', { backup: false })

      const content = fs.readFileSync(
        path.join(mainRepoDir, '.env.local'),
        'utf-8',
      )
      expect(content).toContain('# dotswitch:staging')
      expect(content).toContain('API=https://staging.example.com')
      expect(fs.existsSync(path.join(worktreeDir, '.env.local'))).toBe(false)
    })

    it('reads active env from main repo when in worktree', () => {
      const projectRoot = resolveProjectRoot(worktreeDir)

      switchEnv(projectRoot, 'production', { backup: false })
      expect(getActiveEnv(projectRoot)).toBe('production')
    })

    it('loads config from main repo when in worktree', () => {
      const projectRoot = resolveProjectRoot(worktreeDir)
      const config = loadConfig(projectRoot)

      expect(config.hooks).toStrictEqual({ main: 'production' })
    })

    it('installs hook in shared .git/hooks from worktree', () => {
      const result = installHook(worktreeDir)

      expect(result.created).toBe(true)
      expect(result.path).toBe(
        path.join(mainRepoDir, '.git', 'hooks', 'post-checkout'),
      )
      expect(fs.existsSync(result.path)).toBe(true)
    })

    it('full workflow: switch, backup, restore from worktree', () => {
      const projectRoot = resolveProjectRoot(worktreeDir)

      switchEnv(projectRoot, 'staging', { backup: false })
      expect(getActiveEnv(projectRoot)).toBe('staging')

      switchEnv(projectRoot, 'production', { backup: true })
      expect(getActiveEnv(projectRoot)).toBe('production')

      expect(fs.existsSync(path.join(mainRepoDir, '.env.local.backup'))).toBe(
        true,
      )

      restoreEnvLocal(projectRoot)
      expect(getActiveEnv(projectRoot)).toBe('staging')
    })

    it('operates locally when worktree has tracked env files', () => {
      // Simulate tracked env files checked out into the worktree
      fs.writeFileSync(
        path.join(worktreeDir, '.env.staging'),
        'API=https://wt-staging.example.com\n',
      )
      fs.writeFileSync(
        path.join(worktreeDir, '.env.production'),
        'API=https://wt-production.example.com\n',
      )

      // resolveProjectRoot still returns main repo
      expect(resolveProjectRoot(worktreeDir)).toBe(mainRepoDir)

      // But listEnvFiles on the worktree dir finds the local files
      const files = listEnvFiles(worktreeDir)
      expect(files.map(f => f.env).sort()).toStrictEqual([
        'production',
        'staging',
      ])

      // switchEnv writes .env.local in the worktree, not the main repo
      switchEnv(worktreeDir, 'staging', { backup: false })

      const wtContent = fs.readFileSync(
        path.join(worktreeDir, '.env.local'),
        'utf-8',
      )
      expect(wtContent).toContain('# dotswitch:staging')
      expect(wtContent).toContain('API=https://wt-staging.example.com')

      // Main repo should NOT have a .env.local from this operation
      expect(fs.existsSync(path.join(mainRepoDir, '.env.local'))).toBe(false)
    })

    it('switchEnv with sourceDir reads from main repo, writes to worktree', () => {
      // Worktree has its own (different) env files
      fs.writeFileSync(
        path.join(worktreeDir, '.env.staging'),
        'API=https://wt-staging.example.com\n',
      )

      // Switch in worktree using main repo as source
      switchEnv(worktreeDir, 'staging', {
        backup: false,
        sourceDir: mainRepoDir,
      })

      // .env.local should be written in the worktree
      const wtContent = fs.readFileSync(
        path.join(worktreeDir, '.env.local'),
        'utf-8',
      )
      expect(wtContent).toContain('# dotswitch:staging')
      // Content should come from the main repo, not the worktree copy
      expect(wtContent).toContain('API=https://staging.example.com')

      // Main repo should NOT have a .env.local
      expect(fs.existsSync(path.join(mainRepoDir, '.env.local'))).toBe(false)
    })

    it('switchEnv with sourceDir backs up existing target in worktree', () => {
      // Existing .env.local in worktree
      fs.writeFileSync(
        path.join(worktreeDir, '.env.local'),
        'API=https://old.example.com\n',
      )

      switchEnv(worktreeDir, 'production', {
        backup: true,
        sourceDir: mainRepoDir,
      })

      // Backup should exist in the worktree
      expect(fs.existsSync(path.join(worktreeDir, '.env.local.backup'))).toBe(
        true,
      )
      const backup = fs.readFileSync(
        path.join(worktreeDir, '.env.local.backup'),
        'utf-8',
      )
      expect(backup).toBe('API=https://old.example.com\n')

      // Switched content comes from main repo
      const content = fs.readFileSync(
        path.join(worktreeDir, '.env.local'),
        'utf-8',
      )
      expect(content).toContain('API=https://api.example.com')
    })

    it('listEnvFiles from main repo shows main repo envs regardless of worktree files', () => {
      // Worktree has a different set of env files
      fs.writeFileSync(
        path.join(worktreeDir, '.env.local-only'),
        'LOCAL=true\n',
      )

      const mainFiles = listEnvFiles(mainRepoDir)
      expect(mainFiles.map(f => f.env).sort()).toStrictEqual([
        'production',
        'staging',
      ])

      const wtFiles = listEnvFiles(worktreeDir)
      expect(wtFiles.map(f => f.env)).toStrictEqual(['local-only'])
    })

    it('rebases explicit --path from worktree to main repo', () => {
      // Simulate what cli.ts resolveCommandPath does for an explicit --path
      // when cwd is the worktree root
      const cwd = worktreeDir
      const projectRoot = resolveProjectRoot(cwd)

      // Explicit --path "./apps" → rebased to main repo
      const rawPath = path.resolve(cwd, './apps')
      const relative = path.relative(cwd, rawPath)
      const rebased = path.resolve(projectRoot, relative)

      expect(rebased).toBe(path.join(mainRepoDir, 'apps'))
    })
  })

  describe('programmatic API with worktrees', () => {
    it('works end-to-end using exported functions', () => {
      // This tests the public API surface that npm consumers would use
      const mainRepoDir = path.join(tmpDir, 'lib-test-repo')
      const worktreeDir = path.join(tmpDir, 'lib-test-wt')

      fs.mkdirSync(mainRepoDir, { recursive: true })
      git(mainRepoDir, 'init')
      git(mainRepoDir, 'commit', '--allow-empty', '-m', 'init')
      git(mainRepoDir, 'worktree', 'add', worktreeDir, '-b', 'feat')

      fs.writeFileSync(path.join(mainRepoDir, '.env.dev'), 'MODE=dev\n')

      // Consumer resolves the project root, then uses other APIs
      const projectRoot = resolveProjectRoot(worktreeDir)
      expect(projectRoot).toBe(mainRepoDir)

      const files = listEnvFiles(projectRoot)
      expect(files).toHaveLength(1)

      switchEnv(projectRoot, 'dev', { backup: false })
      expect(getActiveEnv(projectRoot)).toBe('dev')
    })
  })
})

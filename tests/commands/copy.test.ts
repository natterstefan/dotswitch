import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/copy.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/copy.js')>()
  return { ...actual, copyFiles: vi.fn() }
})

vi.mock('../../src/lib/git.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/git.js')>()
  return { ...actual, resolveProjectRoot: vi.fn() }
})

import { copyCommand } from '../../src/commands/copy.js'
import { copyFiles } from '../../src/lib/copy.js'
import { resolveProjectRoot } from '../../src/lib/git.js'

const mockedCopyFiles = vi.mocked(copyFiles)
const mockedResolveProjectRoot = vi.mocked(resolveProjectRoot)

describe('copyCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.exitCode = undefined
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('copies files and logs success', () => {
    mockedResolveProjectRoot.mockReturnValue('/main-repo')
    mockedCopyFiles.mockReturnValue([
      { file: '.env.test.local', status: 'copied' },
    ])
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    copyCommand(['.env.test.local'], {
      force: false,
      dryRun: false,
      cwd: '/worktree',
    })

    expect(mockedCopyFiles).toHaveBeenCalledWith(
      ['.env.test.local'],
      '/main-repo',
      '/worktree',
      { force: false, dryRun: false },
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('.env.test.local'),
    )
  })

  it('errors when not in a worktree', () => {
    mockedResolveProjectRoot.mockReturnValue('/same-dir')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    copyCommand(['.env.test.local'], {
      force: false,
      dryRun: false,
      cwd: '/same-dir',
    })

    expect(process.exitCode).toBe(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('worktree'),
    )
    expect(mockedCopyFiles).not.toHaveBeenCalled()
  })

  it('logs skipped files as warnings', () => {
    mockedResolveProjectRoot.mockReturnValue('/main-repo')
    mockedCopyFiles.mockReturnValue([
      { file: '.env.test.local', status: 'skipped' },
    ])
    const consoleWarnSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    copyCommand(['.env.test.local'], {
      force: false,
      dryRun: false,
      cwd: '/worktree',
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('already exists'),
    )
  })

  it('logs not_found files as errors', () => {
    mockedResolveProjectRoot.mockReturnValue('/main-repo')
    mockedCopyFiles.mockReturnValue([
      { file: '.env.test.local', status: 'not_found' },
    ])
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    copyCommand(['.env.test.local'], {
      force: false,
      dryRun: false,
      cwd: '/worktree',
    })

    expect(process.exitCode).toBe(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found'),
    )
  })

  it('prefixes output with dry-run label', () => {
    mockedResolveProjectRoot.mockReturnValue('/main-repo')
    mockedCopyFiles.mockReturnValue([
      { file: '.env.test.local', status: 'copied' },
    ])
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    copyCommand(['.env.test.local'], {
      force: false,
      dryRun: true,
      cwd: '/worktree',
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Would copy'),
    )
  })
})

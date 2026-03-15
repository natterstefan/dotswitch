import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EnvFile } from '../../src/types.js'

vi.mock('../../src/lib/config.js', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/lib/config.js')>()
  return { ...actual, loadConfig: vi.fn() }
})

vi.mock('../../src/lib/copy.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/copy.js')>()
  return { ...actual, copyFiles: vi.fn() }
})

vi.mock('../../src/lib/env.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/lib/env.js')>()
  return {
    ...actual,
    listEnvFiles: vi.fn(),
    switchEnv: vi.fn(),
    getActiveEnv: vi.fn(),
  }
})

vi.mock('../../src/lib/prompt.js', () => ({
  promptEnvSelection: vi.fn(),
}))

import { useCommand } from '../../src/commands/use.js'
import { loadConfig } from '../../src/lib/config.js'
import { copyFiles } from '../../src/lib/copy.js'
import { getActiveEnv, listEnvFiles, switchEnv } from '../../src/lib/env.js'
import { promptEnvSelection } from '../../src/lib/prompt.js'

const mockedLoadConfig = vi.mocked(loadConfig)
const mockedCopyFiles = vi.mocked(copyFiles)
const mockedListEnvFiles = vi.mocked(listEnvFiles)
const mockedSwitchEnv = vi.mocked(switchEnv)
const mockedGetActiveEnv = vi.mocked(getActiveEnv)
const _mockedPromptEnvSelection = vi.mocked(promptEnvSelection)

const defaultFiles: EnvFile[] = [
  {
    name: '.env.staging',
    env: 'staging',
    path: '/p/.env.staging',
    active: false,
  },
  {
    name: '.env.production',
    env: 'production',
    path: '/p/.env.production',
    active: false,
  },
]

describe('useCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    process.exitCode = undefined
    mockedListEnvFiles.mockReturnValue(defaultFiles)
    mockedGetActiveEnv.mockReturnValue(null)
    mockedLoadConfig.mockReturnValue({
      target: '.env.local',
      exclude: [],
      hooks: {},
      extraFiles: [],
    })
  })

  it('switches to the specified environment', async () => {
    await useCommand('staging', {
      force: false,
      backup: true,
      dryRun: false,
      path: '/p',
    })

    expect(mockedSwitchEnv).toHaveBeenCalledWith('/p', 'staging', {
      backup: true,
    })
  })

  it('errors when no env files exist', async () => {
    mockedListEnvFiles.mockReturnValue([])
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await useCommand('staging', {
      force: false,
      backup: true,
      dryRun: false,
      path: '/p',
    })

    expect(process.exitCode).toBe(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('No .env.* files found'),
    )
  })

  it('errors when environment not found', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await useCommand('unknown', {
      force: false,
      backup: true,
      dryRun: false,
      path: '/p',
    })

    expect(process.exitCode).toBe(1)
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('not found'),
    )
  })

  it('skips if already active and not forced', async () => {
    mockedGetActiveEnv.mockReturnValue('staging')
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await useCommand('staging', {
      force: false,
      backup: true,
      dryRun: false,
      path: '/p',
    })

    expect(mockedSwitchEnv).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Already using'),
    )
  })

  it('switches even if already active when forced', async () => {
    mockedGetActiveEnv.mockReturnValue('staging')

    await useCommand('staging', {
      force: true,
      backup: true,
      dryRun: false,
      path: '/p',
    })

    expect(mockedSwitchEnv).toHaveBeenCalled()
  })

  it('passes backup option through', async () => {
    await useCommand('staging', {
      force: false,
      backup: false,
      dryRun: false,
      path: '/p',
    })

    expect(mockedSwitchEnv).toHaveBeenCalledWith('/p', 'staging', {
      backup: false,
    })
  })

  it('--dry-run shows what would happen without switching', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await useCommand('staging', {
      force: false,
      backup: true,
      dryRun: true,
      path: '/p',
    })

    expect(mockedSwitchEnv).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Would switch to staging'),
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Would back up'),
    )
  })

  it('--dry-run without backup skips backup message', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await useCommand('staging', {
      force: false,
      backup: false,
      dryRun: true,
      path: '/p',
    })

    expect(mockedSwitchEnv).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Would switch to staging'),
    )
    expect(consoleSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Would back up'),
    )
  })

  it('copies extraFiles from sourceDir after switching', async () => {
    mockedLoadConfig.mockReturnValue({
      target: '.env.local',
      exclude: [],
      hooks: {},
      extraFiles: ['.env.test.local'],
    })
    mockedCopyFiles.mockReturnValue([
      { file: '.env.test.local', status: 'copied' },
    ])
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await useCommand('staging', {
      force: false,
      backup: true,
      dryRun: false,
      path: '/worktree',
      sourceDir: '/main-repo',
    })

    expect(mockedSwitchEnv).toHaveBeenCalled()
    expect(mockedCopyFiles).toHaveBeenCalledWith(
      ['.env.test.local'],
      '/main-repo',
      '/worktree',
      { force: true, dryRun: false },
    )
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('.env.test.local'),
    )
  })

  it('does not copy extraFiles when no sourceDir (not a worktree)', async () => {
    mockedLoadConfig.mockReturnValue({
      target: '.env.local',
      exclude: [],
      hooks: {},
      extraFiles: ['.env.test.local'],
    })

    await useCommand('staging', {
      force: false,
      backup: true,
      dryRun: false,
      path: '/p',
    })

    expect(mockedSwitchEnv).toHaveBeenCalled()
    expect(mockedCopyFiles).not.toHaveBeenCalled()
  })

  it('--dry-run shows extraFiles that would be copied', async () => {
    mockedLoadConfig.mockReturnValue({
      target: '.env.local',
      exclude: [],
      hooks: {},
      extraFiles: ['.env.test.local'],
    })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await useCommand('staging', {
      force: false,
      backup: false,
      dryRun: true,
      path: '/worktree',
      sourceDir: '/main-repo',
    })

    expect(mockedSwitchEnv).not.toHaveBeenCalled()
    expect(mockedCopyFiles).not.toHaveBeenCalled()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Would copy .env.test.local'),
    )
  })

  it('errors in non-TTY mode without env argument', async () => {
    const originalIsTTY = process.stdin.isTTY
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      configurable: true,
    })
    const _consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await useCommand(undefined, {
      force: false,
      backup: true,
      dryRun: false,
      path: '/p',
    })

    expect(process.exitCode).toBe(1)
    Object.defineProperty(process.stdin, 'isTTY', {
      value: originalIsTTY,
      configurable: true,
    })
  })
})

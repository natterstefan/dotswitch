import { describe, expect, it, vi } from 'vitest'
import {
  backupEnvLocal,
  getActiveEnv,
  listEnvFiles,
  restoreEnvLocal,
  switchEnv,
} from '../../src/lib/env.js'
import { setupMockProject } from '../helpers.js'

describe('env', () => {
  describe('listEnvFiles', () => {
    it('lists .env.* files excluding defaults', () => {
      const { fs, dir } = setupMockProject({
        '.env': 'BASE=true',
        '.env.local': 'LOCAL=true',
        '.env.staging': 'STAGING=true',
        '.env.production': 'PROD=true',
        '.env.example': 'EXAMPLE=true',
      })

      const files = listEnvFiles(dir, fs)
      expect(files).toHaveLength(2)
      expect(files.map(f => f.env)).toStrictEqual(['production', 'staging'])
    })

    it('marks the active env file', () => {
      const { fs, dir } = setupMockProject({
        '.env.staging': 'STAGING=true',
        '.env.production': 'PROD=true',
        '.env.local': '# dotswitch:staging\nLOCAL=true',
      })

      const files = listEnvFiles(dir, fs)
      const staging = files.find(f => f.env === 'staging')
      const production = files.find(f => f.env === 'production')
      expect(staging?.active).toBe(true)
      expect(production?.active).toBe(false)
    })

    it('returns empty array if no env files', () => {
      const { fs, dir } = setupMockProject({})
      const files = listEnvFiles(dir, fs)
      expect(files).toStrictEqual([])
    })

    it('respects config exclude list', () => {
      const { fs, dir } = setupMockProject({
        '.env.staging': 'S=1',
        '.env.test': 'T=1',
        '.env.production': 'P=1',
      })
      const config = {
        target: '.env.local',
        exclude: ['.env.test'],
        hooks: {},
      }
      const files = listEnvFiles(dir, fs, config)
      expect(files.map(f => f.env)).toStrictEqual(['production', 'staging'])
    })

    it('respects custom target in config', () => {
      const { fs, dir } = setupMockProject({
        '.env': '# dotswitch:staging\nX=1',
        '.env.staging': 'S=1',
        '.env.production': 'P=1',
      })
      const config = { target: '.env', exclude: [], hooks: {} }
      const files = listEnvFiles(dir, fs, config)
      expect(files.find(f => f.env === 'staging')?.active).toBe(true)
    })
  })

  describe('getActiveEnv', () => {
    it('returns the active env from .env.local header', () => {
      const { fs, dir } = setupMockProject({
        '.env.local': '# dotswitch:staging\nFOO=bar',
      })
      expect(getActiveEnv(dir, fs)).toBe('staging')
    })

    it('returns null if .env.local has no header', () => {
      const { fs, dir } = setupMockProject({
        '.env.local': 'FOO=bar',
      })
      expect(getActiveEnv(dir, fs)).toBeNull()
    })

    it('returns null if .env.local does not exist', () => {
      const { fs, dir } = setupMockProject({})
      expect(getActiveEnv(dir, fs)).toBeNull()
    })
  })

  describe('backupEnvLocal', () => {
    it('creates a backup of .env.local', () => {
      const { fs, dir } = setupMockProject({
        '.env.local': 'FOO=bar',
      })

      const result = backupEnvLocal(dir, fs)
      expect(result).toBe(true)
      expect(fs.readFileSync('/project/.env.local.backup', 'utf-8')).toBe(
        'FOO=bar',
      )
    })

    it('returns false if .env.local does not exist', () => {
      const { fs, dir } = setupMockProject({})
      expect(backupEnvLocal(dir, fs)).toBe(false)
    })

    it('logs a warning when backup fails', () => {
      const { fs, dir } = setupMockProject({
        '.env.local': 'FOO=bar',
      })
      // Make copyFileSync throw to simulate a filesystem error
      const originalCopyFileSync = fs.copyFileSync
      fs.copyFileSync = () => {
        throw new Error('Permission denied')
      }
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const result = backupEnvLocal(dir, fs)

        expect(result).toBe(false)
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to back up .env.local'),
        )
      } finally {
        consoleSpy.mockRestore()
        fs.copyFileSync = originalCopyFileSync
      }
    })
  })

  describe('switchEnv', () => {
    it('copies env file to .env.local with tracker header', () => {
      const { fs, dir } = setupMockProject({
        '.env.staging': 'API_URL=https://staging.example.com',
      })

      switchEnv(dir, 'staging', { backup: false }, fs)

      const content = fs.readFileSync('/project/.env.local', 'utf-8')
      expect(content).toBe(
        '# dotswitch:staging\nAPI_URL=https://staging.example.com',
      )
    })

    it('creates backup before switching by default', () => {
      const { fs, dir } = setupMockProject({
        '.env.local': 'OLD=content',
        '.env.staging': 'NEW=content',
      })

      switchEnv(dir, 'staging', { backup: true }, fs)

      expect(fs.readFileSync('/project/.env.local.backup', 'utf-8')).toBe(
        'OLD=content',
      )
    })

    it('throws if source env file does not exist', () => {
      const { fs, dir } = setupMockProject({})
      expect(() => switchEnv(dir, 'missing', { backup: false }, fs)).toThrow(
        'Environment file .env.missing does not exist',
      )
    })

    it('skips backup when option is false', () => {
      const { fs, dir } = setupMockProject({
        '.env.local': 'OLD=content',
        '.env.staging': 'NEW=content',
      })

      switchEnv(dir, 'staging', { backup: false }, fs)

      expect(fs.existsSync('/project/.env.local.backup')).toBe(false)
    })

    it('writes to custom target from config', () => {
      const { fs, dir } = setupMockProject({
        '.env.staging': 'API=staging',
      })
      const config = { target: '.env', exclude: [], hooks: {} }

      switchEnv(dir, 'staging', { backup: false }, fs, config)

      const content = fs.readFileSync('/project/.env', 'utf-8')
      expect(content).toBe('# dotswitch:staging\nAPI=staging')
    })
  })

  describe('restoreEnvLocal', () => {
    it('restores .env.local from backup', () => {
      const { fs, dir } = setupMockProject({
        '.env.local': 'CURRENT=value',
        '.env.local.backup': 'BACKUP=value',
      })

      restoreEnvLocal(dir, fs)

      expect(fs.readFileSync('/project/.env.local', 'utf-8')).toBe(
        'BACKUP=value',
      )
    })

    it('throws if no backup file exists', () => {
      const { fs, dir } = setupMockProject({})
      expect(() => restoreEnvLocal(dir, fs)).toThrow('No backup file found')
    })

    it('works when .env.local does not exist yet', () => {
      const { fs, dir } = setupMockProject({
        '.env.local.backup': 'BACKUP=value',
      })

      restoreEnvLocal(dir, fs)

      expect(fs.readFileSync('/project/.env.local', 'utf-8')).toBe(
        'BACKUP=value',
      )
    })
  })
})

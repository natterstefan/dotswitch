import { describe, expect, it } from 'vitest'
import {
  addTrackerHeader,
  createTrackerHeader,
  parseTrackerHeader,
  removeTrackerHeader,
} from '../../src/lib/tracker.js'

describe('tracker', () => {
  describe('createTrackerHeader', () => {
    it('creates a header with the env name', () => {
      expect(createTrackerHeader('staging')).toBe('# dotswitch:staging')
    })
  })

  describe('parseTrackerHeader', () => {
    it('parses env from a tracked file', () => {
      expect(parseTrackerHeader('# dotswitch:staging\nFOO=bar')).toBe('staging')
    })

    it('returns null for untracked content', () => {
      expect(parseTrackerHeader('FOO=bar')).toBeNull()
    })

    it('returns null for empty content', () => {
      expect(parseTrackerHeader('')).toBeNull()
    })

    it('trims whitespace from env name', () => {
      expect(parseTrackerHeader('# dotswitch: production ')).toBe('production')
    })
  })

  describe('addTrackerHeader', () => {
    it('prepends header to untracked content', () => {
      const result = addTrackerHeader('FOO=bar', 'staging')
      expect(result).toBe('# dotswitch:staging\nFOO=bar')
    })

    it('replaces existing header', () => {
      const result = addTrackerHeader(
        '# dotswitch:staging\nFOO=bar',
        'production',
      )
      expect(result).toBe('# dotswitch:production\nFOO=bar')
    })
  })

  describe('removeTrackerHeader', () => {
    it('removes existing header', () => {
      const result = removeTrackerHeader('# dotswitch:staging\nFOO=bar')
      expect(result).toBe('FOO=bar')
    })

    it('returns content unchanged if no header', () => {
      const result = removeTrackerHeader('FOO=bar')
      expect(result).toBe('FOO=bar')
    })
  })
})

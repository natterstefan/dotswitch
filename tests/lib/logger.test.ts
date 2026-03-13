import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/lib/logger.js'

describe('logger', () => {
  describe('debug', () => {
    let stderrSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      stderrSpy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
      logger.setVerbose(false)
      delete process.env.DEBUG
    })

    afterEach(() => {
      stderrSpy.mockRestore()
      delete process.env.DEBUG
    })

    it('does not output when verbose is off and DEBUG is unset', () => {
      logger.debug('hidden')
      expect(stderrSpy).not.toHaveBeenCalled()
    })

    it('outputs to stderr when verbose is true', () => {
      logger.setVerbose(true)
      logger.debug('visible')
      expect(stderrSpy).toHaveBeenCalledOnce()
      const output = stderrSpy.mock.calls[0][0] as string
      expect(output).toContain('[debug]')
      expect(output).toContain('visible')
    })

    it('outputs to stderr when DEBUG=dotswitch', () => {
      process.env.DEBUG = 'dotswitch'
      logger.debug('env-visible')
      expect(stderrSpy).toHaveBeenCalledOnce()
      const output = stderrSpy.mock.calls[0][0] as string
      expect(output).toContain('env-visible')
    })

    it('does not output when DEBUG is set to something else', () => {
      process.env.DEBUG = 'other'
      logger.debug('hidden')
      expect(stderrSpy).not.toHaveBeenCalled()
    })
  })
})

import { describe, expect, it } from 'vitest'
import { copyFiles } from '../../src/lib/copy.js'
import { setupMockProject } from '../helpers.js'

describe('copyFiles', () => {
  it('copies a file from source to target directory', () => {
    const { fs } = setupMockProject({})
    // Set up source directory with a file
    fs.mkdirSync('/source', { recursive: true })
    fs.writeFileSync('/source/.env.test.local', 'TEST=true')

    const results = copyFiles(['.env.test.local'], '/source', '/project', {
      force: false,
      dryRun: false,
    }, fs)

    expect(results).toStrictEqual([
      { file: '.env.test.local', status: 'copied' },
    ])
    expect(fs.readFileSync('/project/.env.test.local', 'utf-8')).toBe('TEST=true')
  })

  it('copies multiple files', () => {
    const { fs } = setupMockProject({})
    fs.mkdirSync('/source', { recursive: true })
    fs.writeFileSync('/source/.env.test.local', 'TEST=true')
    fs.writeFileSync('/source/.env.cypress.local', 'CY=true')

    const results = copyFiles(
      ['.env.test.local', '.env.cypress.local'],
      '/source',
      '/project',
      { force: false, dryRun: false },
      fs,
    )

    expect(results).toStrictEqual([
      { file: '.env.test.local', status: 'copied' },
      { file: '.env.cypress.local', status: 'copied' },
    ])
  })

  it('skips files that already exist without --force', () => {
    const { fs } = setupMockProject({
      '.env.test.local': 'EXISTING=true',
    })
    fs.mkdirSync('/source', { recursive: true })
    fs.writeFileSync('/source/.env.test.local', 'NEW=true')

    const results = copyFiles(['.env.test.local'], '/source', '/project', {
      force: false,
      dryRun: false,
    }, fs)

    expect(results).toStrictEqual([
      { file: '.env.test.local', status: 'skipped' },
    ])
    // Original content preserved
    expect(fs.readFileSync('/project/.env.test.local', 'utf-8')).toBe('EXISTING=true')
  })

  it('overwrites files that already exist with --force', () => {
    const { fs } = setupMockProject({
      '.env.test.local': 'EXISTING=true',
    })
    fs.mkdirSync('/source', { recursive: true })
    fs.writeFileSync('/source/.env.test.local', 'NEW=true')

    const results = copyFiles(['.env.test.local'], '/source', '/project', {
      force: true,
      dryRun: false,
    }, fs)

    expect(results).toStrictEqual([
      { file: '.env.test.local', status: 'copied' },
    ])
    expect(fs.readFileSync('/project/.env.test.local', 'utf-8')).toBe('NEW=true')
  })

  it('returns not_found for files missing in source', () => {
    const { fs } = setupMockProject({})
    fs.mkdirSync('/source', { recursive: true })

    const results = copyFiles(['.env.test.local'], '/source', '/project', {
      force: false,
      dryRun: false,
    }, fs)

    expect(results).toStrictEqual([
      { file: '.env.test.local', status: 'not_found' },
    ])
  })

  it('dry-run does not copy files', () => {
    const { fs } = setupMockProject({})
    fs.mkdirSync('/source', { recursive: true })
    fs.writeFileSync('/source/.env.test.local', 'TEST=true')

    const results = copyFiles(['.env.test.local'], '/source', '/project', {
      force: false,
      dryRun: true,
    }, fs)

    expect(results).toStrictEqual([
      { file: '.env.test.local', status: 'copied' },
    ])
    expect(fs.existsSync('/project/.env.test.local')).toBe(false)
  })

  it('dry-run reports skipped for existing files without --force', () => {
    const { fs } = setupMockProject({
      '.env.test.local': 'EXISTING=true',
    })
    fs.mkdirSync('/source', { recursive: true })
    fs.writeFileSync('/source/.env.test.local', 'NEW=true')

    const results = copyFiles(['.env.test.local'], '/source', '/project', {
      force: false,
      dryRun: true,
    }, fs)

    expect(results).toStrictEqual([
      { file: '.env.test.local', status: 'skipped' },
    ])
  })
})

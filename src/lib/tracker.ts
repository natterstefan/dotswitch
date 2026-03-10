import { TRACKER_PREFIX } from './constants.js'

export function createTrackerHeader(env: string): string {
  return `${TRACKER_PREFIX}${env}`
}

export function parseTrackerHeader(content: string): string | null {
  const firstLine = content.split('\n')[0]
  if (firstLine?.startsWith(TRACKER_PREFIX)) {
    return firstLine.slice(TRACKER_PREFIX.length).trim()
  }
  return null
}

export function addTrackerHeader(content: string, env: string): string {
  const header = createTrackerHeader(env)
  const existing = parseTrackerHeader(content)
  if (existing !== null) {
    // Replace existing header
    const lines = content.split('\n')
    lines[0] = header
    return lines.join('\n')
  }
  return `${header}\n${content}`
}

export function removeTrackerHeader(content: string): string {
  const existing = parseTrackerHeader(content)
  if (existing !== null) {
    const lines = content.split('\n')
    lines.shift()
    return lines.join('\n')
  }
  return content
}

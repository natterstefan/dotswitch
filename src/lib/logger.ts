import pc from 'picocolors'

let verbose = false

export const logger = {
  setVerbose(enabled: boolean): void {
    verbose = enabled
  },
  debug(message: string): void {
    if (verbose || process.env.DEBUG === 'dotswitch') {
      process.stderr.write(`${pc.dim('[debug]')} ${pc.dim(message)}\n`)
    }
  },
  success(message: string): void {
    console.log(pc.green(`✓ ${message}`))
  },
  info(message: string): void {
    console.log(pc.cyan(message))
  },
  warn(message: string): void {
    console.error(pc.yellow(`⚠ ${message}`))
  },
  error(message: string): void {
    console.error(pc.red(`✗ ${message}`))
  },
}

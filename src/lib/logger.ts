import pc from "picocolors";

export const logger = {
  success(message: string): void {
    console.log(pc.green(`✓ ${message}`));
  },
  info(message: string): void {
    console.log(pc.cyan(message));
  },
  warn(message: string): void {
    console.log(pc.yellow(`⚠ ${message}`));
  },
  error(message: string): void {
    console.error(pc.red(`✗ ${message}`));
  },
};

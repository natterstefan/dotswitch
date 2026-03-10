import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMockProject } from "../helpers.js";
import {
  loadConfig,
  defineConfig,
  getTargetFile,
  getBackupFile,
} from "../../src/lib/config.js";

describe("config", () => {
  describe("loadConfig (memfs — JSON only)", () => {
    it("returns defaults when no config file exists", () => {
      const { fs, dir } = setupMockProject({});
      const config = loadConfig(dir, fs);
      expect(config.target).toBe(".env.local");
      expect(config.exclude).toStrictEqual([]);
      expect(config.hooks).toStrictEqual({});
    });

    it("loads config from .dotswitchrc.json", () => {
      const { fs, dir } = setupMockProject({
        ".dotswitchrc.json": JSON.stringify({
          target: ".env",
          exclude: [".env.test"],
          hooks: { "staging/*": "staging" },
        }),
      });

      const config = loadConfig(dir, fs);
      expect(config.target).toBe(".env");
      expect(config.exclude).toStrictEqual([".env.test"]);
      expect(config.hooks).toStrictEqual({ "staging/*": "staging" });
    });

    it("fills in defaults for missing fields", () => {
      const { fs, dir } = setupMockProject({
        ".dotswitchrc.json": JSON.stringify({ target: ".env" }),
      });

      const config = loadConfig(dir, fs);
      expect(config.target).toBe(".env");
      expect(config.exclude).toStrictEqual([]);
      expect(config.hooks).toStrictEqual({});
    });

    it("returns defaults for invalid JSON", () => {
      const { fs, dir } = setupMockProject({
        ".dotswitchrc.json": "not valid json{{{",
      });

      const config = loadConfig(dir, fs);
      expect(config.target).toBe(".env.local");
    });
  });

  describe("loadConfig (real filesystem — JS/TS configs)", () => {
    let tmpDir: string;

    function writeFile(name: string, content: string): void {
      fs.writeFileSync(path.join(tmpDir, name), content, "utf-8");
    }

    beforeEach(() => {
      tmpDir = fs.realpathSync(
        fs.mkdtempSync(path.join(os.tmpdir(), "dotswitch-config-")),
      );
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("loads dotswitch.config.ts with export default", () => {
      writeFile(
        "dotswitch.config.ts",
        `
        const config = { target: ".env.from-ts", exclude: [".env.test"] };
        export default config;
        `,
      );

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.from-ts");
      expect(config.exclude).toStrictEqual([".env.test"]);
      expect(config.hooks).toStrictEqual({});
    });

    it("loads dotswitch.config.ts with TypeScript syntax", () => {
      writeFile(
        "dotswitch.config.ts",
        `
        interface Config { target: string; hooks: Record<string, string>; }
        const config: Config = { target: ".env.typed", hooks: { "main": "production" } };
        export default config;
        `,
      );

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.typed");
      expect(config.hooks).toStrictEqual({ main: "production" });
    });

    it("loads dotswitch.config.js (ESM)", () => {
      writeFile(
        "dotswitch.config.js",
        `export default { target: ".env.from-js" };`,
      );

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.from-js");
    });

    it("loads dotswitch.config.mjs", () => {
      writeFile(
        "dotswitch.config.mjs",
        `export default { target: ".env.from-mjs" };`,
      );

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.from-mjs");
    });

    it("loads dotswitch.config.cjs", () => {
      writeFile(
        "dotswitch.config.cjs",
        `module.exports = { target: ".env.from-cjs", exclude: [".env.dev"] };`,
      );

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.from-cjs");
      expect(config.exclude).toStrictEqual([".env.dev"]);
    });

    it("prefers .ts over .js over .mjs over .cjs", () => {
      writeFile("dotswitch.config.ts", `export default { target: ".env.ts" };`);
      writeFile("dotswitch.config.js", `export default { target: ".env.js" };`);
      writeFile("dotswitch.config.mjs", `export default { target: ".env.mjs" };`);
      writeFile("dotswitch.config.cjs", `module.exports = { target: ".env.cjs" };`);

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.ts");
    });

    it("prefers JS/TS config over .dotswitchrc.json", () => {
      writeFile("dotswitch.config.cjs", `module.exports = { target: ".env.cjs" };`);
      writeFile(".dotswitchrc.json", JSON.stringify({ target: ".env.json" }));

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.cjs");
    });

    it("falls back to .dotswitchrc.json when no JS/TS config exists", () => {
      writeFile(".dotswitchrc.json", JSON.stringify({ target: ".env.legacy" }));

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.legacy");
    });

    it("fills in defaults for partial JS config", () => {
      writeFile(
        "dotswitch.config.cjs",
        `module.exports = { target: ".env" };`,
      );

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env");
      expect(config.exclude).toStrictEqual([]);
      expect(config.hooks).toStrictEqual({});
    });

    it("returns defaults when config file has invalid syntax", () => {
      writeFile("dotswitch.config.js", `export default {{invalid`);

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.local");
    });
  });

  describe("defineConfig", () => {
    it("returns the config object as-is (identity function)", () => {
      const input = { target: ".env", exclude: [".env.test"] };
      expect(defineConfig(input)).toBe(input);
    });
  });

  describe("getTargetFile", () => {
    it("returns the target from config", () => {
      expect(getTargetFile({ target: ".env", exclude: [], hooks: {} })).toBe(".env");
    });
  });

  describe("getBackupFile", () => {
    it("appends .backup to target", () => {
      expect(getBackupFile({ target: ".env.local", exclude: [], hooks: {} })).toBe(
        ".env.local.backup",
      );
      expect(getBackupFile({ target: ".env", exclude: [], hooks: {} })).toBe(
        ".env.backup",
      );
    });
  });
});

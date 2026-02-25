import { describe, it, expect } from "vitest";
import { setupMockProject } from "../helpers.js";
import {
  loadConfig,
  getTargetFile,
  getBackupFile,
} from "../../src/lib/config.js";

describe("config", () => {
  describe("loadConfig", () => {
    it("returns defaults when no config file exists", () => {
      const { fs, dir } = setupMockProject({});
      const config = loadConfig(dir, fs);
      expect(config.target).toBe(".env.local");
      expect(config.exclude).toEqual([]);
      expect(config.hooks).toEqual({});
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
      expect(config.exclude).toEqual([".env.test"]);
      expect(config.hooks).toEqual({ "staging/*": "staging" });
    });

    it("fills in defaults for missing fields", () => {
      const { fs, dir } = setupMockProject({
        ".dotswitchrc.json": JSON.stringify({ target: ".env" }),
      });

      const config = loadConfig(dir, fs);
      expect(config.target).toBe(".env");
      expect(config.exclude).toEqual([]);
      expect(config.hooks).toEqual({});
    });

    it("returns defaults for invalid JSON", () => {
      const { fs, dir } = setupMockProject({
        ".dotswitchrc.json": "not valid json{{{",
      });

      const config = loadConfig(dir, fs);
      expect(config.target).toBe(".env.local");
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

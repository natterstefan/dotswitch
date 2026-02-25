import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  listEnvFiles,
  getActiveEnv,
  switchEnv,
  backupEnvLocal,
  restoreEnvLocal,
} from "../src/lib/env.js";
import { parseEnvContent, diffEnvMaps } from "../src/lib/parser.js";
import { loadConfig } from "../src/lib/config.js";

describe("integration: real filesystem", () => {
  let tmpDir: string;

  function writeFile(name: string, content: string): void {
    fs.writeFileSync(path.join(tmpDir, name), content, "utf-8");
  }

  function readFile(name: string): string {
    return fs.readFileSync(path.join(tmpDir, name), "utf-8");
  }

  function fileExists(name: string): boolean {
    return fs.existsSync(path.join(tmpDir, name));
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dotswitch-integration-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("full switch workflow", () => {
    it("switches env, creates backup, and tracks active env", () => {
      writeFile(".env.staging", "API_URL=https://staging.example.com\nDEBUG=true");
      writeFile(".env.production", "API_URL=https://api.example.com\nDEBUG=false");
      writeFile(".env.local", "API_URL=https://old.example.com");

      // List available envs
      const files = listEnvFiles(tmpDir);
      expect(files).toHaveLength(2);
      expect(files.map((f) => f.env).sort()).toEqual(["production", "staging"]);

      // No active env yet (no tracker header)
      expect(getActiveEnv(tmpDir)).toBeNull();

      // Switch to staging with backup
      switchEnv(tmpDir, "staging", { backup: true });

      // Verify backup was created
      expect(fileExists(".env.local.backup")).toBe(true);
      expect(readFile(".env.local.backup")).toBe("API_URL=https://old.example.com");

      // Verify .env.local has tracker header and content
      const localContent = readFile(".env.local");
      expect(localContent).toContain("# dotswitch:staging");
      expect(localContent).toContain("API_URL=https://staging.example.com");

      // Verify active env
      expect(getActiveEnv(tmpDir)).toBe("staging");

      // List should show staging as active
      const updatedFiles = listEnvFiles(tmpDir);
      expect(updatedFiles.find((f) => f.env === "staging")?.active).toBe(true);
      expect(updatedFiles.find((f) => f.env === "production")?.active).toBe(false);

      // Switch to production
      switchEnv(tmpDir, "production", { backup: true });
      expect(getActiveEnv(tmpDir)).toBe("production");
      expect(readFile(".env.local")).toContain("API_URL=https://api.example.com");
    });

    it("restores from backup", () => {
      writeFile(".env.staging", "API=staging");
      writeFile(".env.production", "API=production");

      // Switch to staging (creates .env.local)
      switchEnv(tmpDir, "staging", { backup: false });
      expect(getActiveEnv(tmpDir)).toBe("staging");

      // Create backup, then switch to production
      switchEnv(tmpDir, "production", { backup: true });
      expect(getActiveEnv(tmpDir)).toBe("production");

      // Restore should bring back staging
      restoreEnvLocal(tmpDir);
      expect(getActiveEnv(tmpDir)).toBe("staging");
    });

    it("throws when restoring without backup", () => {
      expect(() => restoreEnvLocal(tmpDir)).toThrow("No backup file found");
    });
  });

  describe("env file filtering", () => {
    it("excludes .env, .env.local, .env.local.backup, .env.example", () => {
      writeFile(".env", "BASE=true");
      writeFile(".env.local", "LOCAL=true");
      writeFile(".env.local.backup", "BACKUP=true");
      writeFile(".env.example", "EXAMPLE=true");
      writeFile(".env.staging", "STAGING=true");

      const files = listEnvFiles(tmpDir);
      expect(files).toHaveLength(1);
      expect(files[0].env).toBe("staging");
    });
  });

  describe("diff workflow", () => {
    it("detects differences between env files", () => {
      const staging = "API=staging\nDEBUG=true\nSHARED=same";
      const production = "API=production\nNEW_KEY=value\nSHARED=same";

      const fromMap = parseEnvContent(staging);
      const toMap = parseEnvContent(production);
      const diff = diffEnvMaps(fromMap, toMap);

      expect(diff.added).toEqual(["NEW_KEY"]);
      expect(diff.removed).toEqual(["DEBUG"]);
      expect(diff.changed).toEqual(["API"]);
      expect(diff.unchanged).toEqual(["SHARED"]);
    });
  });

  describe("config file loading", () => {
    it("loads config from .dotswitchrc.json on real filesystem", () => {
      writeFile(".dotswitchrc.json", JSON.stringify({
        target: ".env",
        exclude: [".env.test"],
      }));

      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env");
      expect(config.exclude).toEqual([".env.test"]);
    });

    it("returns defaults when config file does not exist", () => {
      const config = loadConfig(tmpDir);
      expect(config.target).toBe(".env.local");
      expect(config.exclude).toEqual([]);
    });
  });

  describe("backup", () => {
    it("creates and verifies real file backup", () => {
      writeFile(".env.local", "ORIGINAL=content");

      const result = backupEnvLocal(tmpDir);
      expect(result).toBe(true);
      expect(readFile(".env.local.backup")).toBe("ORIGINAL=content");
    });

    it("returns false when nothing to back up", () => {
      expect(backupEnvLocal(tmpDir)).toBe(false);
    });
  });

  describe("custom target via config", () => {
    it("switches to .env instead of .env.local when configured", () => {
      writeFile(".dotswitchrc.json", JSON.stringify({ target: ".env" }));
      writeFile(".env.staging", "API=staging");

      const config = loadConfig(tmpDir);
      switchEnv(tmpDir, "staging", { backup: false }, undefined, config);

      expect(readFile(".env")).toContain("# dotswitch:staging");
      expect(readFile(".env")).toContain("API=staging");
      expect(getActiveEnv(tmpDir, undefined, config)).toBe("staging");
    });
  });
});

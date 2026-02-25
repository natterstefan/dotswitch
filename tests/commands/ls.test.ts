import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EnvFile } from "../../src/types.js";

vi.mock("../../src/lib/env.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/env.js")>();
  return {
    ...actual,
    listEnvFiles: vi.fn(),
  };
});

import { listEnvFiles } from "../../src/lib/env.js";
import { lsCommand } from "../../src/commands/ls.js";

const mockedListEnvFiles = vi.mocked(listEnvFiles);

const sampleFiles: EnvFile[] = [
  { name: ".env.staging", env: "staging", path: "/p/.env.staging", active: true },
  { name: ".env.production", env: "production", path: "/p/.env.production", active: false },
];

describe("lsCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("lists available environments", () => {
    mockedListEnvFiles.mockReturnValue(sampleFiles);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    lsCommand({ path: "/p", json: false });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Available environments"),
    );
  });

  it("warns when no env files found", () => {
    mockedListEnvFiles.mockReturnValue([]);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    lsCommand({ path: "/p", json: false });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No .env.* files found"),
    );
  });

  it("sets exit code 1 when no env files found", () => {
    mockedListEnvFiles.mockReturnValue([]);
    vi.spyOn(console, "log").mockImplementation(() => {});

    lsCommand({ path: "/p", json: false });

    expect(process.exitCode).toBe(1);
  });

  it("--json outputs valid JSON array with correct structure", () => {
    mockedListEnvFiles.mockReturnValue(sampleFiles);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    lsCommand({ path: "/p", json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output).toEqual([
      { name: ".env.staging", env: "staging", active: true },
      { name: ".env.production", env: "production", active: false },
    ]);
  });

  it("--json with no envs outputs [] and sets exit code 1", () => {
    mockedListEnvFiles.mockReturnValue([]);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    lsCommand({ path: "/p", json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output).toEqual([]);
    expect(process.exitCode).toBe(1);
  });
});

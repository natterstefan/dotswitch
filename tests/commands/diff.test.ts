import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { diffCommand } from "../../src/commands/diff.js";

// Mock node:fs module
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      readFileSync: vi.fn(),
    },
  };
});

const mockedExistsSync = vi.mocked(fs.existsSync);
const mockedReadFileSync = vi.mocked(fs.readFileSync);

describe("diffCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("compares .env.local against a named env by default", () => {
    mockedExistsSync.mockImplementation((p) => {
      const s = String(p);
      return s.endsWith(".env.local") || s.endsWith(".env.staging");
    });
    mockedReadFileSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith(".env.local")) return "# dotswitch:production\nAPI=prod\nSECRET=x";
      if (s.endsWith(".env.staging")) return "API=staging\nNEW_KEY=y";
      return "";
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    diffCommand("staging", undefined, { path: "/p", showValues: false, json: false });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Added");
    expect(output).toContain("NEW_KEY");
    expect(output).toContain("Removed");
    expect(output).toContain("SECRET");
    expect(output).toContain("Changed");
    expect(output).toContain("API");
  });

  it("compares two named envs", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith(".env.staging")) return "API=staging";
      if (s.endsWith(".env.production")) return "API=prod";
      return "";
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    diffCommand("staging", "production", { path: "/p", showValues: false, json: false });

    const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("Changed");
    expect(output).toContain("API");
  });

  it("reports identical files", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue("API=same");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    diffCommand("staging", "production", { path: "/p", showValues: false, json: false });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("identical"),
    );
  });

  it("--json outputs structured JSON", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith(".env.staging")) return "API=staging\nOLD=x";
      if (s.endsWith(".env.production")) return "API=prod\nNEW=y";
      return "";
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    diffCommand("staging", "production", { path: "/p", showValues: false, json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.added).toEqual(["NEW"]);
    expect(output.removed).toEqual(["OLD"]);
    expect(output.changed).toEqual(["API"]);
  });

  it("--show-values includes values in JSON output", () => {
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockImplementation((p) => {
      const s = String(p);
      if (s.endsWith(".env.staging")) return "API=staging";
      if (s.endsWith(".env.production")) return "API=prod\nNEW=y";
      return "";
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    diffCommand("staging", "production", { path: "/p", showValues: true, json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output.details.added).toEqual({ NEW: "y" });
    expect(output.details.changed).toEqual({ API: { from: "staging", to: "prod" } });
  });

  it("errors when file not found", () => {
    mockedExistsSync.mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    diffCommand("missing", undefined, { path: "/p", showValues: false, json: false });

    expect(process.exitCode).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("File not found"),
    );
  });
});

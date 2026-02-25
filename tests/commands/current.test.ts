import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/env.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/env.js")>();
  return {
    ...actual,
    getActiveEnv: vi.fn(),
  };
});

import { getActiveEnv } from "../../src/lib/env.js";
import { currentCommand } from "../../src/commands/current.js";

const mockedGetActiveEnv = vi.mocked(getActiveEnv);

describe("currentCommand", () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
    originalIsTTY = process.stdout.isTTY;
  });

  afterEach(() => {
    process.exitCode = undefined;
    Object.defineProperty(process.stdout, "isTTY", {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    });
  });

  it("displays the active environment", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    mockedGetActiveEnv.mockReturnValue("staging");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    currentCommand({ path: "/project", json: false });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("staging"),
    );
  });

  it("warns when no active environment", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    mockedGetActiveEnv.mockReturnValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    currentCommand({ path: "/project", json: false });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No active environment"),
    );
  });

  it("sets exit code 1 when no active environment", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
    mockedGetActiveEnv.mockReturnValue(null);
    vi.spyOn(console, "log").mockImplementation(() => {});

    currentCommand({ path: "/project", json: false });

    expect(process.exitCode).toBe(1);
  });

  it("--json outputs active env", () => {
    mockedGetActiveEnv.mockReturnValue("staging");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    currentCommand({ path: "/project", json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output).toEqual({ active: "staging" });
  });

  it("--json outputs null when no active env", () => {
    mockedGetActiveEnv.mockReturnValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    currentCommand({ path: "/project", json: true });

    const output = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(output).toEqual({ active: null });
    expect(process.exitCode).toBe(1);
  });

  it("non-TTY outputs plain env name", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });
    mockedGetActiveEnv.mockReturnValue("staging");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    currentCommand({ path: "/project", json: false });

    expect(consoleSpy).toHaveBeenCalledWith("staging");
  });

  it("non-TTY prints nothing and sets exit code 1 when no active env", () => {
    Object.defineProperty(process.stdout, "isTTY", { value: undefined, configurable: true });
    mockedGetActiveEnv.mockReturnValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    currentCommand({ path: "/project", json: false });

    expect(consoleSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });
});

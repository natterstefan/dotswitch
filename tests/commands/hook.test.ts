import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/hooks.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/hooks.js")>();
  return {
    ...actual,
    installHook: vi.fn(),
    removeHook: vi.fn(),
    matchBranchToEnv: actual.matchBranchToEnv,
  };
});

vi.mock("../../src/lib/config.js", () => ({
  loadConfig: vi.fn(),
}));

vi.mock("../../src/lib/env.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/env.js")>();
  return {
    ...actual,
    switchEnv: vi.fn(),
  };
});

import { installHook, removeHook } from "../../src/lib/hooks.js";
import { loadConfig } from "../../src/lib/config.js";
import { switchEnv } from "../../src/lib/env.js";
import {
  hookInstallCommand,
  hookRemoveCommand,
  hookBranchCommand,
} from "../../src/commands/hook.js";

const mockedInstallHook = vi.mocked(installHook);
const mockedRemoveHook = vi.mocked(removeHook);
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedSwitchEnv = vi.mocked(switchEnv);

describe("hookInstallCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("warns when no hook mappings defined", () => {
    mockedLoadConfig.mockReturnValue({ target: ".env.local", exclude: [], hooks: {} });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    hookInstallCommand({ path: "/p" });

    expect(process.exitCode).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No hook mappings"),
    );
  });

  it("installs hook when mappings exist", () => {
    mockedLoadConfig.mockReturnValue({
      target: ".env.local",
      exclude: [],
      hooks: { "main": "production" },
    });
    mockedInstallHook.mockReturnValue({ created: true, path: "/p/.git/hooks/post-checkout" });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    hookInstallCommand({ path: "/p" });

    expect(mockedInstallHook).toHaveBeenCalledWith("/p");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Installed"),
    );
  });

  it("reports update when hook already exists", () => {
    mockedLoadConfig.mockReturnValue({
      target: ".env.local",
      exclude: [],
      hooks: { "main": "production" },
    });
    mockedInstallHook.mockReturnValue({ created: false, path: "/p/.git/hooks/post-checkout" });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    hookInstallCommand({ path: "/p" });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Updated"),
    );
  });
});

describe("hookRemoveCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("removes existing hook", () => {
    mockedRemoveHook.mockReturnValue(true);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    hookRemoveCommand({ path: "/p" });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Removed"),
    );
  });

  it("reports when no hook found", () => {
    mockedRemoveHook.mockReturnValue(false);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    hookRemoveCommand({ path: "/p" });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No dotswitch hook found"),
    );
  });
});

describe("hookBranchCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("switches env when branch matches", () => {
    mockedLoadConfig.mockReturnValue({
      target: ".env.local",
      exclude: [],
      hooks: { "staging/*": "staging" },
    });
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    hookBranchCommand("staging/feat-x", { path: "/p" });

    expect(mockedSwitchEnv).toHaveBeenCalledWith("/p", "staging", { backup: true });
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Auto-switched to staging"),
    );
  });

  it("does nothing when branch does not match", () => {
    mockedLoadConfig.mockReturnValue({
      target: ".env.local",
      exclude: [],
      hooks: { "staging/*": "staging" },
    });

    hookBranchCommand("feature/unmatched", { path: "/p" });

    expect(mockedSwitchEnv).not.toHaveBeenCalled();
  });
});

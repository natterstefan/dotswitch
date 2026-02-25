import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../src/lib/env.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/lib/env.js")>();
  return {
    ...actual,
    restoreEnvLocal: vi.fn(),
    getActiveEnv: vi.fn(),
  };
});

import { restoreEnvLocal, getActiveEnv } from "../../src/lib/env.js";
import { restoreCommand } from "../../src/commands/restore.js";

const mockedRestoreEnvLocal = vi.mocked(restoreEnvLocal);
const mockedGetActiveEnv = vi.mocked(getActiveEnv);

describe("restoreCommand", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = undefined;
  });

  it("restores from backup and shows active env", () => {
    mockedRestoreEnvLocal.mockReturnValue(undefined);
    mockedGetActiveEnv.mockReturnValue("staging");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    restoreCommand({ path: "/p" });

    expect(mockedRestoreEnvLocal).toHaveBeenCalledWith("/p");
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Restored"),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("staging"),
    );
  });

  it("restores from backup without active env info", () => {
    mockedRestoreEnvLocal.mockReturnValue(undefined);
    mockedGetActiveEnv.mockReturnValue(null);
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    restoreCommand({ path: "/p" });

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Restored .env.local from backup"),
    );
  });

  it("errors when no backup exists", () => {
    mockedRestoreEnvLocal.mockImplementation(() => {
      throw new Error("No backup file found (.env.local.backup)");
    });
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    restoreCommand({ path: "/p" });

    expect(process.exitCode).toBe(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("No backup file found"),
    );
  });
});

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolvePaths } from "../../src/lib/paths.js";

describe("resolvePaths", () => {
  let tmpDir: string;

  function createTmpStructure(dirs: string[]): void {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dotswitch-test-"));
    for (const d of dirs) {
      fs.mkdirSync(path.join(tmpDir, d), { recursive: true });
    }
  }

  afterEach(() => {
    if (tmpDir) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("returns single resolved path for non-glob", () => {
    const result = resolvePaths("/some/path");
    expect(result).toStrictEqual(["/some/path"]);
  });

  it("resolves glob pattern to matching directories", () => {
    createTmpStructure(["apps/web", "apps/api", "apps/docs"]);
    const result = resolvePaths(`${tmpDir}/apps/*`);
    expect(result).toHaveLength(3);
    expect(result[0]).toContain("api");
    expect(result[1]).toContain("docs");
    expect(result[2]).toContain("web");
  });

  it("returns empty array for non-existent base dir", () => {
    const result = resolvePaths("/nonexistent/path/*");
    expect(result).toStrictEqual([]);
  });

  it("filters to directories only", () => {
    createTmpStructure(["apps/web"]);
    fs.writeFileSync(path.join(tmpDir, "apps", "README.md"), "hi");
    const result = resolvePaths(`${tmpDir}/apps/*`);
    expect(result).toHaveLength(1);
    expect(result[0]).toContain("web");
  });
});

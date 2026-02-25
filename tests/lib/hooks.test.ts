import { describe, it, expect } from "vitest";
import { matchBranchToEnv } from "../../src/lib/hooks.js";

describe("hooks", () => {
  describe("matchBranchToEnv", () => {
    const hooks = {
      main: "production",
      "staging/*": "staging",
      "dev*": "development",
    };

    it("matches exact branch name", () => {
      expect(matchBranchToEnv("main", hooks)).toBe("production");
    });

    it("matches prefix/* glob pattern", () => {
      expect(matchBranchToEnv("staging/feat-login", hooks)).toBe("staging");
    });

    it("matches prefix* glob pattern", () => {
      expect(matchBranchToEnv("develop", hooks)).toBe("development");
      expect(matchBranchToEnv("dev-branch", hooks)).toBe("development");
    });

    it("returns null for no match", () => {
      expect(matchBranchToEnv("feature/unmatched", hooks)).toBeNull();
    });

    it("prefers exact match over glob", () => {
      const hooks = { dev: "exact", "dev*": "glob" };
      expect(matchBranchToEnv("dev", hooks)).toBe("exact");
    });

    it("returns null for empty hooks", () => {
      expect(matchBranchToEnv("main", {})).toBeNull();
    });
  });
});

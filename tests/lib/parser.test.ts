import { describe, it, expect } from "vitest";
import { parseEnvContent, diffEnvMaps } from "../../src/lib/parser.js";

describe("parser", () => {
  describe("parseEnvContent", () => {
    it("parses key=value pairs", () => {
      const result = parseEnvContent("FOO=bar\nBAZ=qux");
      expect(result.get("FOO")).toBe("bar");
      expect(result.get("BAZ")).toBe("qux");
    });

    it("skips comments and empty lines", () => {
      const result = parseEnvContent("# comment\n\nFOO=bar\n# another");
      expect(result.size).toBe(1);
      expect(result.get("FOO")).toBe("bar");
    });

    it("handles values with equals signs", () => {
      const result = parseEnvContent("URL=https://example.com?a=1&b=2");
      expect(result.get("URL")).toBe("https://example.com?a=1&b=2");
    });

    it("trims whitespace around keys and values", () => {
      const result = parseEnvContent("  FOO  =  bar  ");
      expect(result.get("FOO")).toBe("bar");
    });

    it("returns empty map for empty content", () => {
      expect(parseEnvContent("").size).toBe(0);
    });

    it("skips lines without equals", () => {
      const result = parseEnvContent("INVALID_LINE\nFOO=bar");
      expect(result.size).toBe(1);
    });
  });

  describe("diffEnvMaps", () => {
    it("detects added keys", () => {
      const from = new Map([["A", "1"]]);
      const to = new Map([["A", "1"], ["B", "2"]]);
      const diff = diffEnvMaps(from, to);
      expect(diff.added).toStrictEqual(["B"]);
      expect(diff.removed).toStrictEqual([]);
      expect(diff.changed).toStrictEqual([]);
    });

    it("detects removed keys", () => {
      const from = new Map([["A", "1"], ["B", "2"]]);
      const to = new Map([["A", "1"]]);
      const diff = diffEnvMaps(from, to);
      expect(diff.removed).toStrictEqual(["B"]);
      expect(diff.added).toStrictEqual([]);
    });

    it("detects changed keys", () => {
      const from = new Map([["A", "1"]]);
      const to = new Map([["A", "2"]]);
      const diff = diffEnvMaps(from, to);
      expect(diff.changed).toStrictEqual(["A"]);
    });

    it("detects unchanged keys", () => {
      const from = new Map([["A", "1"]]);
      const to = new Map([["A", "1"]]);
      const diff = diffEnvMaps(from, to);
      expect(diff.unchanged).toStrictEqual(["A"]);
      expect(diff.added).toStrictEqual([]);
      expect(diff.removed).toStrictEqual([]);
      expect(diff.changed).toStrictEqual([]);
    });

    it("sorts results alphabetically", () => {
      const from = new Map([["C", "1"], ["A", "1"]]);
      const to = new Map([["B", "2"], ["D", "2"]]);
      const diff = diffEnvMaps(from, to);
      expect(diff.added).toStrictEqual(["B", "D"]);
      expect(diff.removed).toStrictEqual(["A", "C"]);
    });
  });
});

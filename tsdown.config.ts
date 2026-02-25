import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    format: ["esm"],
    banner: { js: "#!/usr/bin/env node" },
    outDir: "dist",
    clean: true,
  },
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    outDir: "dist",
    clean: false,
  },
]);

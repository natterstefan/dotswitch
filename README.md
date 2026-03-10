# dotswitch

![dotswitch banner](.github/banner.png)

[![CI](https://github.com/natterstefan/dotswitch/actions/workflows/ci.yml/badge.svg)](https://github.com/natterstefan/dotswitch/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dotswitch)](https://www.npmjs.com/package/dotswitch)
[![npm downloads](https://img.shields.io/npm/dm/dotswitch)](https://www.npmjs.com/package/dotswitch)
[![node](https://img.shields.io/node/v/dotswitch)](https://www.npmjs.com/package/dotswitch)
[![license](https://img.shields.io/npm/l/dotswitch)](https://github.com/natterstefan/dotswitch/blob/main/LICENSE)

Quickly switch between `.env` files. Copies
`.env.<environment>` to `.env.local` (or a custom target) and
tracks the active environment via a header comment. Works with
Next.js, Vite, Remix, and any project that uses `.env` files.

## Install

```bash
npm install -g dotswitch
```

Or use directly without installing:

```bash
npx dotswitch use staging
```

## Usage

### Switch environment

```bash
# Switch to .env.staging → .env.local
dotswitch use staging

# Interactive picker (when no env specified)
dotswitch use

# Skip backup of existing .env.local
dotswitch use production --no-backup

# Force switch even if already active
dotswitch use staging --force

# Preview what would happen without making changes
dotswitch use staging --dry-run
```

### List available environments

```bash
dotswitch ls
```

```
Available environments:

▸ staging (active)
  production
  preview
```

JSON output for scripts:

```bash
dotswitch ls --json
# [{"name":".env.staging","env":"staging","active":true},{"name":".env.production","env":"production","active":false}]
```

### Show current environment

```bash
dotswitch current
```

JSON output:

```bash
dotswitch current --json
# {"active":"staging"}
```

Pipe-friendly — outputs the plain env name when not a TTY:

```bash
ENV=$(dotswitch current)
```

### Restore from backup

```bash
# Restore .env.local from .env.local.backup
dotswitch restore
```

### Compare environments

```bash
# Compare current .env.local against .env.production
dotswitch diff production

# Compare two environments directly
dotswitch diff staging production

# Show actual values (not just key names)
dotswitch diff staging production --show-values

# JSON output
dotswitch diff staging production --json
```

### Options

All commands support:

| Flag | Description |
|------|-------------|
| `-p, --path <dir>` | Project directory (defaults to cwd) |
| `--json` | Output as JSON (machine-readable) |

`ls` and `use` also support:

| Flag | Description |
|------|-------------|
| `-r, --root` | Source env files from the main repo root (worktree) |

`use` also supports:

| Flag | Description |
|------|-------------|
| `-f, --force` | Switch even if already active |
| `--no-backup` | Skip `.env.local` backup |
| `-n, --dry-run` | Preview what would happen |

## Configuration

Create a `dotswitch.config.ts` (or `.js`/`.mjs`/`.cjs`) in your project
root to customize behavior. Everything is optional — dotswitch
works out of the box without a config file.

### TypeScript (recommended)

```ts
// dotswitch.config.ts
import { defineConfig } from "dotswitch";

export default defineConfig({
  target: ".env.local",
  exclude: [".env.test"],
  hooks: {
    "main": "production",
    "staging/*": "staging",
    "dev*": "development",
  },
});
```

### JavaScript (ESM)

```js
// dotswitch.config.js

/** @type {import("dotswitch").DotswitchConfig} */
export default {
  target: ".env.local",
  exclude: [".env.test"],
  hooks: {
    "main": "production",
    "staging/*": "staging",
  },
};
```

### JavaScript (CommonJS)

```js
// dotswitch.config.cjs
const { defineConfig } = require("dotswitch");

module.exports = defineConfig({
  target: ".env.local",
  exclude: [".env.test"],
});
```

### Config file resolution order

dotswitch searches for config files in this order (first match wins):

1. `dotswitch.config.ts`
2. `dotswitch.config.js`
3. `dotswitch.config.mjs`
4. `dotswitch.config.cjs`
5. `.dotswitchrc.json` (deprecated)

> **Note:** `.dotswitchrc.json` still works but is deprecated and
> will show a warning. Migrate to one of the JS/TS formats above.

### Options

| Field | Default | Description |
|-------|---------|-------------|
| `target` | `".env.local"` | File to write the active env to |
| `exclude` | `[]` | Additional env files to hide from `ls` |
| `hooks` | `{}` | Branch-to-env mappings for git hook auto-switching |

### Custom target file

By default dotswitch writes to `.env.local`, but some
frameworks use `.env` directly. Set the `target` field to
change this:

```ts
// dotswitch.config.ts
import { defineConfig } from "dotswitch";

export default defineConfig({
  target: ".env",
});
```

## Git hook auto-switching

Automatically switch environments when you check out a branch.

### Setup

1. Add branch mappings to your config:

```ts
// dotswitch.config.ts
import { defineConfig } from "dotswitch";

export default defineConfig({
  hooks: {
    "main": "production",
    "staging/*": "staging",
    "develop": "development",
  },
});
```

2. Install the git hook:

```bash
dotswitch hook install
```

Now `git checkout staging/feat-login` will automatically run
`dotswitch use staging`.

### Patterns

- `"main"` — exact branch name match
- `"staging/*"` — matches `staging/` prefix (e.g., `staging/feat-x`)
- `"dev*"` — matches any branch starting with `dev`

### Remove the hook

```bash
dotswitch hook remove
```

## Monorepo support

Switch environments across multiple packages at once using glob patterns:

```bash
# Switch all apps to staging
dotswitch use staging --path "./apps/*"

# Check status across packages
dotswitch ls --path "./packages/*"
```

Each directory is processed independently with labeled output.

## Git worktree support

dotswitch works transparently in
[git worktrees](https://git-scm.com/docs/git-worktree). When
you run any command from a worktree, it automatically resolves
back to the main repo where your `.env.*` files and
config live.

```bash
# From a worktree, all commands operate on the main repo
cd /path/to/my-worktree
dotswitch ls          # lists envs from the main repo
dotswitch use staging # switches in the main repo
dotswitch hook install # installs hook in the shared .git/hooks
```

Explicit `--path` arguments are rebased automatically, so
monorepo globs also work from worktrees:

```bash
dotswitch use staging --path "./apps/*"
```

### Using main repo envs in a worktree

When a worktree has its own `.env.*` files, dotswitch operates
locally by default. Use `--root` / `-r` to source env files
from the main repo instead:

```bash
cd /path/to/my-worktree

# List envs from the main repo (even if the worktree has local ones)
dotswitch ls --root

# Copy .env.staging from the main repo into the worktree as .env.local
dotswitch use staging --root
```

This is useful when you want to quickly pull an environment
configuration from the main repo into your worktree without
copying files manually.

## How it works

When you run `dotswitch use staging`, it:

1. Backs up your existing `.env.local` to `.env.local.backup`
2. Copies `.env.staging` to `.env.local`
3. Prepends a `# dotswitch:staging` header to track the active environment

The header comment is how `dotswitch ls` and
`dotswitch current` know which environment is active.

## Programmatic API

dotswitch exports its core functions for use in scripts:

```ts
import {
  listEnvFiles,
  switchEnv,
  getActiveEnv,
  restoreEnvLocal,
  loadConfig,
  defineConfig,
  parseEnvContent,
  diffEnvMaps,
  resolveProjectRoot,
} from "dotswitch";

const files = listEnvFiles(process.cwd());
const active = getActiveEnv(process.cwd());
switchEnv(process.cwd(), "staging", { backup: true });
```

In worktree-aware scripts, resolve the project root first:

```ts
const projectRoot = resolveProjectRoot(process.cwd());
const files = listEnvFiles(projectRoot);
switchEnv(projectRoot, "staging", { backup: true });
```

## Requirements

- Node.js >= 20

## License

MIT

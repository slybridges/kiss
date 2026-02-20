# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

kiss (Keep It Simple and Static) is a low-tech static site generator built with Node.js. It transforms markdown, HTML, JSON, and JavaScript content into static websites using Nunjucks templates. Always refer to it as "kiss" (lowercase), not "KISS".

## Commands

```bash
# Testing
npm test                           # Run all tests (unit + integration)
node --test test/unit/             # Run only unit tests
node --test test/integration/      # Run only integration tests
node --test test/unit/build.test.js  # Run a single test file
npm run test:watch                 # Watch mode
npm run test:coverage              # Coverage report

# Code quality
npm run lint                       # ESLint
npm run format                     # Prettier (auto-fix)
npm run validate                   # Both lint + format check

# Build & dev
npx kiss build                     # Full build
NODE_ENV=production npx kiss build # Production build
npx kiss start                     # Dev server with watch + auto-reload
npx kiss watch --incremental       # Watch with incremental builds
npx kiss build --verbosity=info    # Verbose logging (log|info|success|warn|error)
```

## Code Quality Protocol

Before completing ANY task, always run on modified files:

```bash
npx eslint <files-or-dirs> && npx prettier --write <files-or-dirs> && npm test
```

## Code Conventions

- **No semicolons** (Prettier config: `{ "semi": false }`)
- **CommonJS modules** (`require`/`module.exports`)
- **Node.js 20+** required
- Async/await for asynchronous operations
- Lodash for utility functions, fast-glob for file system operations

## Architecture

### Build Pipeline (`src/build.js`)

The `build(options, lastBuild, version)` function is the entire pipeline. The same function handles both full builds and incremental rebuilds via `buildFlags`. It returns `{ context, config }` which becomes `lastBuild` for the next incremental rebuild.

**Stages in order:**

1. **Config load** — `loadConfig()` deep-clones `defaultConfig` then calls user's `kiss.config.js` function
2. **`computeBuildFlags`** — determines which stages to run (all for full build, subset for incremental)
3. **`loadLibs` hooks** — sets up nunjucks, marked, slugify onto `config.libs.*`
4. **`preLoad` hooks**
5. **`loadContent`** — scans files via fast-glob, runs `baseLoader` then specific loader. Files sorted index-first, post-last for proper cascade order
6. **`postLoad` hooks**
7. **`computeAllPagesData`** — multi-round computation loop resolving `kissDependencies` (up to `maxComputingRounds`: 10)
8. **`buildPageIndexes`** — builds 6 Maps for O(1) lookups, stored as `context._pageIndexes`
9. **`computeDataViews`** — populates `context.collections`, `context.categories`, etc.
10. **`applyTransforms`** — per-page (`PAGE` scope) and global (`CONTEXT` scope) transforms
11. **`writeStaticSite`** — dispatches pages to writers by `_meta.outputType`
12. **`postWrite` hooks**

### Data Cascade (Critical to Understand)

The data cascade is the most sophisticated part of the codebase.

**How it works:** `initialPageData` (`src/data/initialPageData.js`) defines page field defaults as **functions** (the `computeX` functions), not plain values. When `baseLoader` merges parent data into a child page, children inherit unevaluated compute functions from parents. `computeAllPagesData` then resolves these in multiple rounds.

**`kissDependencies` mechanism:** Compute functions declare inter-page dependencies as static properties:

```js
computePermalink.kissDependencies = ["slug", ["_meta.parent", "permalink"]]
```

- A string dep = field on the same page
- An array dep like `["_meta.parent", "permalink"]` = follow `_meta.parent` as a page ID, check `permalink` on that page

If dependencies are still unresolved (still functions), the compute is deferred to the next round. `computePermalink` returns itself when parent's permalink isn't ready yet.

**`_no_cascade` convention:** A field named `foo_no_cascade` prevents `foo` from cascading to children. The `_no_cascade` variant replaces the normal key for that page only.

**Cascade scoping:** `post.md`/`post.js` data sets data on the collection page but does NOT cascade to sibling pages. Only `index.*` file data cascades to children.

### Config System

**`kiss.config.js` is a function, not an object.** It receives a mutable `baseConfig` (deep-cloned from defaults) and returns it:

```js
module.exports = (config) => {
  config.context.site.url = "https://example.com"
  return config
}
```

`config.addPlugin(fn, options)` calls `fn(config, options)` for plugin-style extension.

**Namespaced options:** Loaders/transforms/writers declare a `namespace` string. Users override defaults via top-level config keys (e.g., `config.image.widths = [...]`).

### Hook System

Hooks are arrays on `config.hooks` (`loadLibs`, `preLoad`, `postLoad`, `postWrite`). A hook entry can be:

- A plain function: `(options, config, data, buildFlags) => data`
- An object: `{ action: "run"|"copy"|"exec", handler?, from?, to?, command? }`

Object hooks can have an `incrementalRebuild` function for conditional execution during incremental builds.

### @attribute System

`@attributes` in page data strings are resolved by `atAttributesContentTransform`:

- `@file:/path` — resolves to permalink of the page loaded from that content file
- `@permalink:/url/` — validates a permalink exists
- `@id:some-id` — resolves by page ID + language
- `@data:site.url` — resolves a lodash path into `context`

**Performance-critical:** The transform uses a JSON string serialization trick (serialize page to JSON, regex match all `@attribute:value` patterns, batch replace). The comments explicitly warn against refactoring to use helper functions due to measured 40% overhead at ~1M+ calls per build. The transform bypasses `lookupHelpers` and uses `context._pageIndexes` Maps directly.

### Page Indexing (`src/indexing/`)

Six Maps built in a single pass after `computeAllPagesData`: `byPermalink`, `byInputPath`, `byIdAndLang`, `byDerivative`, `byParentPermalink`, `byInputSource`. Lookup helpers have O(n) fallbacks for when indexes aren't yet built (during data cascade phase).

### Incremental Build

`computeBuildFlags` branches on file type:

- Content file change → reload content + recompute + transform + write
- Template file change → skip content reload, re-run transforms + write
- Config file change → full rebuild
- `unlink`/`unlinkDir` → full rebuild

`buildPageIds` computes the impacted page set: ascendants + page + descendants (except for `post.*` files which don't include descendants).

## Testing

- Uses **Node.js built-in `node:test`** framework with `node:assert` (no Jest/Mocha/Vitest)
- Unit tests in `test/unit/` mirror `src/` structure exactly
- Integration tests in `test/integration/` use fixture site at `test/integration/repo/`
- Private `build.js` functions are tested via `build.private.test.js` using `module.exports._functionName` exports

### Test Utilities (`test-utils/helpers.js`)

Key helpers: `createMockConfig(overrides)`, `createMockPage(overrides)`, `createMockContext(overrides)`, `mockGlobalLogger()`/`restoreGlobalLogger()`, `createCapturingLogger()`, `mockProcessExit()`, `mockProcessArgv(args)`, `clearRequireCache(pathPattern)`, `waitFor(conditionFn, timeoutMs, checkIntervalMs)`, `waitForProcessExit(childProcess, timeoutMs)`, `createTempDir()`/`cleanupTempDir(dir)`, `copyFixtureToTemp(fixturePath)`, `createTestFile(dir, filePath, content)`/`createTestFiles(dir, files)`, `assertFileExists(filePath)`/`assertFileContent(filePath, expected)`, `stripAnsi(string)`.

### Incremental Tests

`test/integration/incremental.test.js` spawns `test-utils/incremental-runner.js` as a child process (produces TAP output). This indirection exists because chokidar/vite pending timers prevent `node:test` from exiting cleanly when run inline.

**When modifying incremental tests:**

- ALWAYS include `incremental: true` in the initial build
- Template changes need 250-500ms delay for chokidar detection
- Debug with: `VERBOSITY=info node test-utils/incremental-runner.js`

## Debugging

- `npx kiss build --verbosity=log` for maximum output
- `jsonContextWriter` outputs `sitedata.json` in public dir with full site data
- For intermittent test failures: check test isolation, shared state, and file watcher timing

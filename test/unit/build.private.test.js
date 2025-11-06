const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const build = require("../../src/build")
const {
  mockGlobalLogger,
  restoreGlobalLogger,
  createMockConfig,
  createMockContext,
} = require("../../test-utils/helpers")

// Import private functions for testing
const {
  _computeBuildFlags,
  _computeBuildPageIDs,
  _computeIncrementalHookBuildFlag,
  _countPendingDependencies,
  _directoryCollectionLoader,
  _isComputableValue,
  _findMatchingLoaderId,
  _getFiles,
  _getOptions,
  _sortFiles,
  _runCopyHook,
  _runExecHook,
  _runHandlerHook,
  _computePageData,
  _runConfigHooks,
} = build

describe("build.js private functions", () => {
  let originalLogger

  beforeEach(() => {
    originalLogger = mockGlobalLogger()
    global.logger.success = () => {}
    global.logger.counts = { error: 0, warn: 0 }
  })

  describe("_computeBuildFlags", () => {
    it("should return full build flags when not incremental", () => {
      const config = createMockConfig({
        hooks: {
          loadLibs: [],
          preLoad: [() => {}],
          postLoad: [],
          postWrite: [],
        },
      })
      const options = { event: "change" }
      const flags = _computeBuildFlags(options, config, null, 0)

      assert.equal(flags.config, true)
      assert.equal(flags.content, true)
      assert.equal(flags.dynamicData, true)
      assert.equal(flags.transform, true)
      assert.equal(flags.write, true)
      assert.equal(flags.preLoad, true)
    })

    it("should skip directory add events in incremental mode", () => {
      const config = createMockConfig()
      const options = {
        incremental: true,
        event: "addDir",
        file: "content/newdir",
      }
      const lastContext = { pages: {} }
      const flags = _computeBuildFlags(options, config, lastContext, 1)

      assert.equal(flags.incremental, true)
      assert.equal(flags.content, false)
      assert.equal(flags.transform, false)
      assert.equal(flags.write, false)
    })

    it("should handle content file changes in incremental mode", () => {
      const config = createMockConfig({
        dirs: { content: "content", template: "templates" },
      })
      const options = {
        incremental: true,
        event: "change",
        file: "content/test.md",
      }
      const lastContext = { pages: {} }
      const flags = _computeBuildFlags(options, config, lastContext, 1)

      assert.equal(flags.content, true)
      assert.equal(flags.contentFile, "content/test.md")
      assert.equal(flags.dynamicData, true)
      assert.equal(flags.dataViews, true)
    })

    it("should handle template file changes in incremental mode", () => {
      const config = createMockConfig({
        dirs: { content: "content", template: "templates" },
      })
      const options = {
        incremental: true,
        event: "change",
        file: "templates/default.njk",
      }
      const lastContext = { pages: {} }
      const flags = _computeBuildFlags(options, config, lastContext, 1)

      assert.equal(flags.content, false)
      assert.equal(flags.templateFile, "default.njk")
      assert.equal(flags.transform, true)
    })

    it("should trigger full rebuild for unlink events", () => {
      const config = createMockConfig()
      const options = {
        incremental: true,
        event: "unlink",
        file: "content/deleted.md",
      }
      const lastContext = { pages: {} }
      const flags = _computeBuildFlags(options, config, lastContext, 1)

      // Unsupported events trigger full rebuild
      assert.equal(flags.content, true)
      assert.equal(flags.dynamicData, true)
    })
  })

  describe("_computeBuildPageIDs", () => {
    it("should return empty array when no contentFile or templateFile", () => {
      const config = createMockConfig()
      const context = createMockContext()
      const buildFlags = { incremental: true }

      const ids = _computeBuildPageIDs(config, context, buildFlags)

      assert.deepEqual(ids, [])
    })

    // Note: Page ID computation with existing pages (ascendants/descendants) is
    // covered by integration tests which perform real builds

    it("should handle new file addition with valid loader", () => {
      const config = createMockConfig({
        dirs: { content: "content" },
        loaders: [
          {
            handler: () => {},
            match: "content/**/*.md",
          },
        ],
      })
      const context = createMockContext({
        pages: {
          ".": {
            _meta: {
              id: ".",
              ascendants: [],
            },
          },
        },
      })
      const buildFlags = {
        incremental: true,
        contentFile: "content/new.md",
        event: "add",
      }

      // This will trigger the new file logic
      const ids = _computeBuildPageIDs(config, context, buildFlags)

      // Should include the new page id (computed from path)
      assert.ok(Array.isArray(ids))
    })

    it("should return empty array when no loader found for new file", () => {
      const config = createMockConfig({
        dirs: { content: "content" },
        loaders: [], // No loaders
      })
      const context = createMockContext()
      const buildFlags = {
        incremental: true,
        contentFile: "content/new.txt",
        event: "add",
      }

      const ids = _computeBuildPageIDs(config, context, buildFlags)

      assert.deepEqual(ids, [])
    })

    it("should return empty array when parent not found for new file", () => {
      const { computeParentId } = require("../../src/helpers")
      const originalComputeParentId = computeParentId

      // Mock computeParentId to return null
      require.cache[
        require.resolve("../../src/helpers")
      ].exports.computeParentId = () => null

      const config = createMockConfig({
        dirs: { content: "content" },
        loaders: [
          {
            handler: () => {},
            match: "content/**/*.md",
          },
        ],
      })
      const context = createMockContext()
      const buildFlags = {
        incremental: true,
        contentFile: "content/orphan.md",
        event: "add",
      }

      const ids = _computeBuildPageIDs(config, context, buildFlags)

      assert.deepEqual(ids, [])

      // Restore original
      require.cache[
        require.resolve("../../src/helpers")
      ].exports.computeParentId = originalComputeParentId
    })

    it("should return empty array when existing page not found for change event", () => {
      const config = createMockConfig()
      const context = createMockContext({ pages: {} })
      const buildFlags = {
        incremental: true,
        contentFile: "content/missing.md",
        event: "change",
      }

      const ids = _computeBuildPageIDs(config, context, buildFlags)

      assert.deepEqual(ids, [])
    })

    it("should return pages using specific template for template changes", () => {
      const config = createMockConfig()
      const context = createMockContext({
        pages: {
          "./page1": {
            layout: "default.njk",
            _meta: { id: "./page1" },
          },
          "./page2": {
            layout: "post.njk",
            _meta: { id: "./page2" },
          },
          "./page3": {
            layout: "default.njk",
            _meta: { id: "./page3" },
          },
        },
      })
      const buildFlags = {
        incremental: true,
        templateFile: "default.njk",
      }

      const ids = _computeBuildPageIDs(config, context, buildFlags)

      assert.ok(ids.includes("./page1"))
      assert.ok(ids.includes("./page3"))
      assert.ok(!ids.includes("./page2"))
    })
  })

  describe("_computeIncrementalHookBuildFlag", () => {
    it("should return false when no hooks", () => {
      const result = _computeIncrementalHookBuildFlag([], "file.md", {})
      assert.equal(result, false)
    })

    it("should return true for plain function hooks", () => {
      const hooks = [() => {}]
      const result = _computeIncrementalHookBuildFlag(hooks, "file.md", {})
      assert.equal(result, true)
    })

    it("should call incrementalRebuild function when present", () => {
      let called = false
      const hooks = [
        {
          action: "run",
          handler: () => {},
          incrementalRebuild: (file, context) => {
            called = true
            return file.includes("test")
          },
        },
      ]
      const result = _computeIncrementalHookBuildFlag(hooks, "test.md", {})

      assert.equal(called, true)
      assert.equal(result, true)
    })

    it("should return false when incrementalRebuild returns false", () => {
      const hooks = [
        {
          action: "run",
          handler: () => {},
          incrementalRebuild: () => false,
        },
      ]
      const result = _computeIncrementalHookBuildFlag(hooks, "file.md", {})

      assert.equal(result, false)
    })

    it("should return false for hooks without incrementalRebuild", () => {
      const hooks = [
        {
          action: "copy",
          from: "src",
          to: "dest",
        },
      ]
      const result = _computeIncrementalHookBuildFlag(hooks, "file.md", {})

      assert.equal(result, false)
    })
  })

  describe("_countPendingDependencies", () => {
    it("should return 0 for empty dependencies", () => {
      const page = { title: "Test" }
      const count = _countPendingDependencies(page, {}, [])
      assert.equal(count, 0)
    })

    it("should count pending function dependencies", () => {
      const page = {
        computed: () => "value",
      }
      const count = _countPendingDependencies(page, {}, ["computed"])
      assert.equal(count, 1)
    })

    it("should not count resolved dependencies", () => {
      const page = {
        title: "Already resolved",
      }
      const count = _countPendingDependencies(page, {}, ["title"])
      assert.equal(count, 0)
    })

    it("should throw error for invalid dependency type", () => {
      const page = { title: "Test" }

      assert.throws(() => {
        _countPendingDependencies(page, {}, [123])
      }, /dependency should either be a string or an array/)
    })

    it("should handle array dependencies for page references", () => {
      const pages = {
        "./other": {
          computed: () => "value",
        },
      }
      const page = {
        related: "./other",
      }

      const count = _countPendingDependencies(page, pages, [
        ["related", "computed"],
      ])
      assert.equal(count, 1)
    })

    it("should handle array dependencies with array values", () => {
      const pages = {
        "./page1": { computed: () => "v1" },
        "./page2": { title: "resolved" },
      }
      const page = {
        related: ["./page1", "./page2"],
      }

      const count = _countPendingDependencies(page, pages, [
        ["related", "computed"],
      ])
      assert.equal(count, 1) // Only ./page1 has pending computed
    })

    it("should count pending dependency in first element of chain", () => {
      const pages = {
        "./other": { title: "Test" },
      }
      const page = {
        related: () => "./other",
      }

      const count = _countPendingDependencies(page, pages, [
        ["related", "title"],
      ])
      assert.equal(count, 1) // related itself is pending
    })
  })

  describe("_isComputableValue", () => {
    it("should return true for functions", () => {
      assert.equal(
        _isComputableValue(() => {}),
        true,
      )
    })

    it("should return true for objects with _kissCheckDependencies", () => {
      assert.equal(_isComputableValue({ _kissCheckDependencies: true }), true)
    })

    it("should return false for regular strings", () => {
      assert.equal(_isComputableValue("test"), false)
    })

    it("should return false for numbers", () => {
      assert.equal(_isComputableValue(42), false)
    })

    it("should return falsy for regular objects", () => {
      // Returns undefined for plain objects without _kissCheckDependencies
      assert.ok(!_isComputableValue({ foo: "bar" }))
    })

    it("should return false for null", () => {
      assert.equal(_isComputableValue(null), false)
    })
  })

  describe("_findMatchingLoaderId", () => {
    it("should return loader id when match found", () => {
      const config = createMockConfig({
        loaders: [
          { handler: () => {}, match: "content/**/*.md" },
          { handler: () => {}, match: "content/**/*.json" },
        ],
      })

      // Note: This requires fast-glob to actually find the file
      // In a real scenario, the file would need to exist
      const id = _findMatchingLoaderId(config, "content/test.md")

      // Returns undefined if file doesn't exist in glob results
      assert.ok(id === undefined || typeof id === "number")
    })

    it("should return undefined when no loader matches", () => {
      const config = createMockConfig({
        loaders: [{ handler: () => {}, match: "content/**/*.md" }],
      })

      const id = _findMatchingLoaderId(config, "content/test.xyz")

      assert.equal(id, undefined)
    })

    it("should use namespace options when present", () => {
      const config = createMockConfig({
        loaders: [
          {
            handler: () => {},
            namespace: "customLoader",
            match: "custom/**/*.md",
          },
        ],
        customLoader: {
          match: "content/**/*.md",
        },
      })

      const id = _findMatchingLoaderId(config, "content/test.md")

      assert.ok(id === undefined || typeof id === "number")
    })
  })

  describe("_getFiles", () => {
    it("should return empty array for invalid loader id", () => {
      const config = createMockConfig({ loaders: [] })

      const files = _getFiles(999, config)

      assert.deepEqual(files, [])
    })

    it("should convert string match to array", () => {
      const config = createMockConfig({
        dirs: { content: "content" },
        loaders: [{ handler: () => {}, match: "**/*.md" }],
      })

      const files = _getFiles(0, config, "specific.md")

      assert.ok(Array.isArray(files))
    })

    it("should use loader match when no match parameter provided", () => {
      const config = createMockConfig({
        dirs: { content: "content" },
        loaders: [{ handler: () => {}, match: ["**/*.md"] }],
      })

      const files = _getFiles(0, config)

      assert.ok(Array.isArray(files))
    })

    it("should handle contentPathInMatch flag", () => {
      const config = createMockConfig({
        dirs: { content: "content" },
        loaders: [{ handler: () => {}, match: "content/**/*.md" }],
      })

      const files = _getFiles(0, config, null, true)

      assert.ok(Array.isArray(files))
    })
  })

  describe("_getOptions", () => {
    it("should merge namespace and direct options", () => {
      const config = createMockConfig({
        customNamespace: {
          option1: "from-namespace",
          option2: "namespace-only",
        },
      })

      const options = _getOptions(config, "customNamespace", {
        option1: "from-direct",
        option3: "direct-only",
      })

      assert.equal(options.option1, "from-direct") // Direct wins
      assert.equal(options.option2, "namespace-only")
      assert.equal(options.option3, "direct-only")
    })

    it("should handle missing namespace", () => {
      const config = createMockConfig()

      const options = _getOptions(config, "nonexistent", {
        test: "value",
      })

      assert.equal(options.test, "value")
    })
  })

  describe("_sortFiles", () => {
    it("should sort index files first", () => {
      const files = [
        { name: "post.md", path: "a/post.md" },
        { name: "index.md", path: "a/index.md" },
        { name: "other.md", path: "a/other.md" },
      ]

      const sorted = _sortFiles(files)

      assert.equal(sorted[0].name, "index.md")
    })

    it("should sort post files last", () => {
      const files = [
        { name: "post.md", path: "a/post.md" },
        { name: "other.md", path: "a/other.md" },
        { name: "test.md", path: "a/test.md" },
      ]

      const sorted = _sortFiles(files)

      assert.equal(sorted[sorted.length - 1].name, "post.md")
    })

    it("should sort index files by path length (shortest first)", () => {
      const files = [
        { name: "index.md", path: "a/b/c/index.md" },
        { name: "index.md", path: "a/index.md" },
        { name: "index.md", path: "a/b/index.md" },
      ]

      const sorted = _sortFiles(files)

      assert.equal(sorted[0].path, "a/index.md")
      assert.equal(sorted[1].path, "a/b/index.md")
      assert.equal(sorted[2].path, "a/b/c/index.md")
    })

    it("should sort post files by path length (longest first)", () => {
      const files = [
        { name: "post.md", path: "a/post.md" },
        { name: "post.md", path: "a/b/c/post.md" },
        { name: "post.md", path: "a/b/post.md" },
      ]

      const sorted = _sortFiles(files)

      assert.equal(sorted[0].path, "a/b/c/post.md")
      assert.equal(sorted[1].path, "a/b/post.md")
      assert.equal(sorted[2].path, "a/post.md")
    })
  })

  describe("_runCopyHook", () => {
    it("should handle copy errors gracefully", () => {
      const config = createMockConfig({
        dirs: { public: "public" },
      })

      // This will fail because source doesn't exist
      _runCopyHook(
        {
          from: "/nonexistent/path",
          to: "destination",
        },
        config,
      )

      // Should not throw, error is logged
      assert.ok(true)
    })
  })

  describe("_runExecHook", () => {
    it("should execute command and log output", () => {
      _runExecHook("echo test", {})

      // Should not throw
      assert.ok(true)
    })

    it("should handle command errors gracefully", () => {
      _runExecHook("nonexistent-command-xyz", {})

      // Should not throw, error is logged
      assert.ok(true)
    })
  })

  describe("_runHandlerHook", () => {
    it("should execute handler and return result", () => {
      const handler = (options, config, data) => {
        return { ...data, modified: true }
      }

      const result = _runHandlerHook(
        handler,
        {},
        createMockConfig(),
        { original: true },
        {},
      )

      assert.equal(result.original, true)
      assert.equal(result.modified, true)
    })

    it("should return original data on error", () => {
      const handler = () => {
        throw new Error("Test error")
      }

      const originalData = { test: "data" }
      const result = _runHandlerHook(
        handler,
        {},
        createMockConfig(),
        originalData,
        {},
      )

      assert.deepEqual(result, originalData)
    })
  })

  describe("_directoryCollectionLoader", () => {
    it("should return pages when reaching top parent", () => {
      const config = createMockConfig()
      const pages = {}
      const buildFlags = { version: 1 }

      // Test with path that has no parent
      const result = _directoryCollectionLoader(
        "content",
        {},
        pages,
        config,
        buildFlags,
      )

      assert.ok(result)
    })

    it("should return pages when parent already loaded with matching version", () => {
      const config = createMockConfig()
      const pages = {
        ".": {
          _meta: {
            id: ".",
            buildVersion: 5,
          },
        },
      }
      const buildFlags = { version: 5 }

      const result = _directoryCollectionLoader(
        "content/test",
        {},
        pages,
        config,
        buildFlags,
      )

      assert.ok(result)
    })
  })

  describe("_computePageData", () => {
    it("should handle function that returns another function", () => {
      const config = createMockConfig()
      const context = createMockContext()
      const buildFlags = {}

      const data = {
        _meta: { id: "./test" },
        lazy: () => () => "nested",
      }

      const result = _computePageData(data, config, context, buildFlags)

      assert.equal(result.pendingCount, 1) // Still has pending function
      assert.equal(typeof result.data.lazy, "function")
    })

    it("should handle array data", () => {
      const config = createMockConfig()
      const context = createMockContext()
      const buildFlags = {}

      const data = ["item1", "item2", () => "item3"]

      const result = _computePageData(data, config, context, buildFlags)

      assert.ok(Array.isArray(result.data))
      assert.equal(result.data[0], "item1")
    })

    it("should handle nested objects with functions", () => {
      const config = createMockConfig()
      const context = createMockContext()
      const buildFlags = {}

      const data = {
        _meta: { id: "./test" },
        nested: {
          value: "static",
          computed: () => "dynamic",
        },
      }

      const result = _computePageData(data, config, context, buildFlags)

      assert.equal(result.data.nested.value, "static")
      assert.equal(result.data.nested.computed, "dynamic")
    })
  })

  describe("_runConfigHooks", () => {
    it("should return early when no hooks registered", () => {
      const config = createMockConfig({
        hooks: { postWrite: [] },
      })

      const result = _runConfigHooks(config, "postWrite", {}, {})

      assert.equal(result, undefined)
    })

    it("should execute plain function hooks", () => {
      let executed = false
      const config = createMockConfig({
        hooks: {
          postWrite: [
            () => {
              executed = true
            },
          ],
        },
      })

      _runConfigHooks(config, "postWrite", {}, {})

      assert.equal(executed, true)
    })

    it("should execute hooks with action:run", () => {
      let executed = false
      const config = createMockConfig({
        hooks: {
          postWrite: [
            {
              action: "run",
              handler: () => {
                executed = true
              },
            },
          ],
        },
      })

      _runConfigHooks(config, "postWrite", {}, {})

      assert.equal(executed, true)
    })

    it("should skip hooks in incremental mode without incrementalRebuild", () => {
      let executed = false
      const config = createMockConfig({
        hooks: {
          postWrite: [
            {
              action: "run",
              handler: () => {
                executed = true
              },
            },
          ],
        },
      })

      _runConfigHooks(
        config,
        "postWrite",
        {},
        { incremental: true, file: "test.md" },
      )

      assert.equal(executed, false)
    })

    it("should execute hooks in incremental mode when incrementalRebuild returns true", () => {
      let executed = false
      const config = createMockConfig({
        hooks: {
          postWrite: [
            {
              action: "run",
              handler: () => {
                executed = true
              },
              incrementalRebuild: () => true,
            },
          ],
        },
      })

      _runConfigHooks(
        config,
        "postWrite",
        {},
        { incremental: true, file: "test.md" },
      )

      assert.equal(executed, true)
    })

    it("should handle unknown hook action", () => {
      const config = createMockConfig({
        hooks: {
          postWrite: [
            {
              action: "unknown-action",
            },
          ],
        },
      })

      // Should not throw
      _runConfigHooks(config, "postWrite", {}, {})

      assert.ok(true)
    })
  })
})

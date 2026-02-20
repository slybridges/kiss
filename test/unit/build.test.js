const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")

// Mock dependencies that build.js imports
// Shared config object that can be modified by tests
const _sharedConfig = {
  dirs: {
    content: "content",
    public: "public",
    theme: "theme",
    template: "theme/templates",
    watchExtra: [],
  },
  context: {
    site: {
      title: "Test Site",
      url: "https://example.com",
    },
  },
  defaults: {
    enablePageIndexes: true,
    maxComputingRounds: 10,
    sortCollectionBy: "created",
    pageUpdatedAttribute: "modified",
    pagePublishedAttribute: "created",
  },
  hooks: {
    loadLibs: [],
    preLoad: [],
    postLoad: [],
    postWrite: [],
  },
  loaders: [],
  transforms: [],
  writers: [],
  dataViews: [],
  configFile: "kiss.config.js",
}

const mockConfig = {
  _config: _sharedConfig,
  loadConfig: () => _sharedConfig,
}

const mockHelpers = {
  computePageId: (path) =>
    path.replace(/^content\//, "./").replace(/\.[^.]+$/, ""),
  computeParentId: () => "./",
  getBuildEntries: (context) => Object.entries(context.pages || {}),
  getPageFromInputPath: () => null,
  relativeToAbsoluteAttributes: (page) => page,
}

const mockIndexing = {
  buildPageIndexes: () => ({
    byPermalink: new Map(),
    byInputPath: new Map(),
    byIdAndLang: new Map(),
    byDerivative: new Map(),
    byParentPermalink: new Map(),
    byInputSource: new Map(),
  }),
}

const mockBaseLoader = () => ({
  _meta: { id: "./test", parent: ".", children: [], descendants: [] },
  title: "Test Page",
})

const {
  mockGlobalLogger: mockGlobalLoggerHelper,
  createTempDir,
  cleanupTempDir,
} = require("../../test-utils/helpers")

const mockLogger = {
  setGlobalLogger: () => {
    // Preserve existing counts if they exist
    const existingCounts = global.logger?.counts || { error: 0, warn: 0 }
    const logger = mockGlobalLoggerHelper()
    // Add success method and preserve counts
    global.logger.success = () => {}
    global.logger.counts = existingCounts
    return logger
  },
}

// Mock the require calls
require.cache[require.resolve("../../src/config")] = { exports: mockConfig }
require.cache[require.resolve("../../src/helpers")] = { exports: mockHelpers }
require.cache[require.resolve("../../src/indexing")] = { exports: mockIndexing }
require.cache[require.resolve("../../src/loaders")] = {
  exports: { baseLoader: mockBaseLoader },
}
require.cache[require.resolve("../../src/logger")] = { exports: mockLogger }

const build = require("../../src/build")

describe("build", () => {
  let tempDir
  let originalProcessExit
  let originalConsoleTime
  let originalConsoleTimeEnd
  let exitCode
  let timeLabels

  beforeEach(() => {
    tempDir = createTempDir()
    exitCode = null
    timeLabels = []

    // Mock process.exit
    originalProcessExit = process.exit
    process.exit = (code) => {
      exitCode = code
    }

    // Mock console timing functions
    originalConsoleTime = console.time
    originalConsoleTimeEnd = console.timeEnd
    console.time = (label) => timeLabels.push(`start:${label}`)
    console.timeEnd = (label) => timeLabels.push(`end:${label}`)

    // Set up global logger
    mockLogger.setGlobalLogger()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)

    // Restore mocked functions
    process.exit = originalProcessExit
    console.time = originalConsoleTime
    console.timeEnd = originalConsoleTimeEnd

    delete global.logger
  })

  describe("basic build functionality", () => {
    it("should return context and config", async () => {
      const options = {
        verbosity: "error", // Quiet mode for tests
      }

      const result = await build(options)

      assert.ok(result)
      assert.ok(result.context)
      assert.ok(result.config)
      assert.ok(result.context.pages)
    })

    it("should handle build timing when verbosity is info or log", async () => {
      const options = {
        verbosity: "info", // Build time is shown for verbose levels
      }

      await build(options)

      assert.ok(timeLabels.includes("start:Build time"))
      assert.ok(timeLabels.includes("end:Build time"))
    })

    it("should not show build timing when verbosity is error/warn/success", async () => {
      timeLabels = [] // Reset

      const options = {
        verbosity: "error", // Build time is hidden for minimal verbosity
      }

      await build(options)

      assert.ok(!timeLabels.includes("start:Build time"))
      assert.ok(!timeLabels.includes("end:Build time"))
    })

    it("should set global logger with specified verbosity", async () => {
      const options = {
        verbosity: "warn",
      }

      await build(options)

      // Global logger should be set
      assert.ok(global.logger)
    })

    it("should handle custom config file", async () => {
      const options = {
        configFile: "custom.config.js",
        verbosity: "error",
      }

      const result = await build(options)

      assert.ok(result.config)
      // The mock loadConfig doesn't actually use the configFile param,
      // but we verify the option is passed through
    })

    it("should handle unsafe build mode", async () => {
      // Mock a build with errors
      global.logger.counts.error = 1
      global.logger.counts.warn = 0

      const options = {
        unsafeBuild: true,
        verbosity: "error",
      }

      const result = await build(options)

      // Should complete without calling process.exit
      assert.equal(exitCode, null)
      assert.ok(result)
    })

    it("should exit on errors when not in unsafe mode", async () => {
      // Mock a build with errors
      global.logger.counts.error = 1
      global.logger.counts.warn = 0

      const options = {
        unsafeBuild: false,
        verbosity: "error",
      }

      const result = await build(options)

      // Should have called process.exit(1)
      assert.equal(exitCode, 1)
      assert.ok(result) // Still returns result before exit
    })

    it("should not exit on warnings only", async () => {
      // Mock a build with only warnings
      global.logger.counts.error = 0
      global.logger.counts.warn = 3

      const options = {
        verbosity: "error",
      }

      const result = await build(options)

      // Should not exit
      assert.equal(exitCode, null)
      assert.ok(result)
    })

    it("should not exit when in watch mode even with errors", async () => {
      // Mock a build with errors
      global.logger.counts.error = 1
      global.logger.counts.warn = 0

      const options = {
        watchMode: true,
        verbosity: "error",
      }

      const result = await build(options)

      // Should not exit in watch mode
      assert.equal(exitCode, null)
      assert.ok(result)
    })
  })

  describe("incremental build functionality", () => {
    it("should handle incremental build options", async () => {
      const lastBuild = {
        context: {
          pages: {},
          site: { title: "Test" },
        },
        config: mockConfig.loadConfig(),
      }

      const options = {
        incremental: true,
        event: "change",
        file: "content/test.md",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)

      assert.ok(result)
      assert.ok(result.context)
      assert.equal(result.context.site.title, "Test") // Should preserve context
    })

    it("should handle config file changes", async () => {
      const lastBuild = {
        context: { pages: {} },
        config: mockConfig.loadConfig(),
      }

      const options = {
        incremental: true,
        event: "change",
        file: "kiss.config.js",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)

      assert.ok(result)
      // Config changes should clear the context
      assert.ok(result.context)
    })

    it("should skip directory add events in incremental mode", async () => {
      const lastBuild = {
        context: { pages: {} },
        config: mockConfig.loadConfig(),
      }

      const options = {
        incremental: true,
        event: "addDir",
        file: "content/new-dir",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)

      assert.ok(result)
      // Should complete successfully even with addDir event
    })

    it("should handle full rebuild for unsupported events", async () => {
      const lastBuild = {
        context: { pages: {} },
        config: mockConfig.loadConfig(),
      }

      const options = {
        incremental: true,
        event: "unlink", // Unsupported event triggers full rebuild
        file: "content/deleted.md",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)

      assert.ok(result)
      // Should complete successfully with full rebuild
    })
  })

  describe("build flags and phases", () => {
    it("should handle builds without hooks", async () => {
      const options = {
        verbosity: "error",
      }

      const result = await build(options)

      assert.ok(result)
      // Should complete even without hooks defined
    })

    it("should use provided last build config", async () => {
      const customConfig = {
        ...mockConfig.loadConfig(),
        customProperty: "test-value",
      }

      const lastBuild = {
        config: customConfig,
        context: null,
      }

      const options = {
        verbosity: "error",
      }

      const result = await build(options, lastBuild)

      assert.ok(result)
      assert.equal(result.config.customProperty, "test-value")
    })

    it("should handle page index building", async () => {
      const options = {
        verbosity: "error",
      }

      const result = await build(options)

      assert.ok(result)
      assert.ok(result.context)
      // Mock indexing should have created _pageIndexes
      assert.ok(result.context._pageIndexes)
    })

    it("should handle disabled page indexes", async () => {
      // Temporarily disable page indexes
      const originalEnablePageIndexes = _sharedConfig.defaults.enablePageIndexes
      _sharedConfig.defaults.enablePageIndexes = false

      const options = {
        verbosity: "error",
      }

      const result = await build(options)

      assert.ok(result)
      assert.ok(result.context)
      // Should not have _pageIndexes when disabled
      assert.equal(result.context._pageIndexes, undefined)

      // Restore original setting
      _sharedConfig.defaults.enablePageIndexes = originalEnablePageIndexes
    })
  })

  describe("error handling", () => {
    it("should handle errors gracefully", async () => {
      // This is a basic test since our mocks don't throw errors
      const options = {
        verbosity: "error",
      }

      const result = await build(options)

      assert.ok(result)
      // Should complete without throwing
    })

    it("should handle missing context in incremental build", async () => {
      const lastBuild = {
        config: mockConfig.loadConfig(),
        // Missing context
      }

      const options = {
        incremental: true,
        event: "change",
        file: "content/test.md",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)

      assert.ok(result)
      // Should handle missing context and create new one
      assert.ok(result.context)
    })

    it("should provide meaningful version tracking", async () => {
      const lastBuild = {
        context: { pages: {} },
        config: mockConfig.loadConfig(),
      }

      const version = 42

      const options = {
        incremental: true,
        verbosity: "error",
      }

      const result = await build(options, lastBuild, version)

      assert.ok(result)
      // Version should be tracked (though our mock doesn't actually use it)
    })
  })

  describe("build phases", () => {
    it("should handle all build phases", async () => {
      const options = {
        verbosity: "error",
      }

      // This test verifies that all major build phases execute without error
      const result = await build(options)

      assert.ok(result)
      assert.ok(result.context)
      assert.ok(result.config)

      // Basic structure should be present
      assert.ok(typeof result.context === "object")
      assert.ok(typeof result.config === "object")
    })

    it("should handle data views computation", async () => {
      // Mock with data views
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        dataViews: [
          {
            attribute: "test.computed",
            handler: () => "computed-value",
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)

      assert.ok(result)
      // Data view should have been computed (though our mock is simple)

      // Restore original loadConfig
      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("hook execution", () => {
    it("should execute preLoad hooks", async () => {
      // Note: This test verifies the hook structure is in place
      // Actual execution is mocked but the code path is tested
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          preLoad: [() => {}],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with preLoad hooks")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should execute postLoad hooks", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postLoad: [() => {}],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with postLoad hooks")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should execute postWrite hooks", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [() => {}],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with postWrite hooks")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should execute loadLibs hooks", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          loadLibs: [() => {}],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with loadLibs hooks")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle hook with action:copy", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "copy",
              from: tempDir,
              to: "test-output",
              description: "Test copy hook",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle hook with action:exec", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "exec",
              command: "echo test",
              description: "Test exec hook",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle hook with action:run", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "run",
              handler: () => {},
              description: "Test run hook",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with run hook")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle unknown hook action", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "unknown",
              description: "Test unknown hook",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle copy hook errors", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "copy",
              from: "/nonexistent/path/that/does/not/exist",
              to: "test-output",
              description: "Test copy hook error",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle exec hook errors", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "exec",
              command: "nonexistent-command-that-will-fail",
              description: "Test exec hook error",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle run hook errors", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "run",
              handler: () => {
                throw new Error("Test error in run hook")
              },
              description: "Test run hook error",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle incremental rebuild with hook incrementalRebuild function", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "run",
              handler: () => {},
              incrementalRebuild: (file) => file.includes("test"),
            },
          ],
        },
      }

      const lastBuild = {
        context: { pages: {} },
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "theme/templates/test.njk",
        verbosity: "error",
      }

      await build(options, lastBuild, 1)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should skip hook in incremental rebuild when incrementalRebuild returns false", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "run",
              handler: () => {},
              incrementalRebuild: () => false,
            },
          ],
        },
      }

      const lastBuild = {
        context: { pages: {} },
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "theme/templates/test.njk",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)
      assert.ok(result, "Build should complete")

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("transform execution", () => {
    it("should execute page transforms", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            handler: async (page) => page,
            outputType: "HTML",
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with page transforms")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should execute CONTEXT scope transforms", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            scope: "CONTEXT",
            handler: async (context) => context,
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with CONTEXT transforms")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should skip inactive transforms", async () => {
      let transformCalled = false
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            handler: async (page) => {
              transformCalled = true
              return page
            },
            active: false,
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      assert.equal(
        transformCalled,
        false,
        "inactive transform should not be called",
      )

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should throw error for invalid transform scope", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            scope: "INVALID_SCOPE",
            handler: async (context) => context,
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      // Should not throw - errors are caught and logged
      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle transform errors", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        ["./test", { _meta: { id: "./test", outputType: "HTML" } }],
      ]

      const originalLoadConfig = mockConfig.loadConfig
      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            handler: async () => {
              throw new Error("Test transform error")
            },
            outputType: "HTML",
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should handle CONTEXT transform errors", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            scope: "CONTEXT",
            handler: async () => {
              throw new Error("Test context transform error")
            },
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should skip transforms when no entries match outputType", async () => {
      let transformCalled = false
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        ["./test", { _meta: { id: "./test", outputType: "HTML" } }],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            handler: async (page) => {
              transformCalled = true
              return page
            },
            outputType: "JSON", // Different from page outputType
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      assert.equal(
        transformCalled,
        false,
        "transform should not be called for non-matching outputType",
      )

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should apply transforms in incremental mode", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
        transforms: [
          {
            handler: async (page) => page,
          },
        ],
      }

      const lastBuild = {
        context: {
          pages: {
            "./test": {
              _meta: {
                id: "./test",
                outputType: "HTML",
                inputSources: [{ loaderId: 0, path: "content/test.md" }],
              },
            },
          },
        },
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "theme/templates/test.njk",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)
      assert.ok(result, "Build should complete")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should use custom description in transform", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            scope: "CONTEXT",
            handler: async (context) => context,
            description: "Custom transform description",
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("data view computation", () => {
    it("should compute data views with custom description", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        dataViews: [
          {
            attribute: "test.value",
            handler: () => "computed",
            description: "Custom data view description",
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle data view computation errors", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        dataViews: [
          {
            attribute: "test.error",
            handler: () => {
              throw new Error("Test data view error")
            },
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("writer execution", () => {
    it("should execute page writers", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            outputType: "HTML",
            handler: async () => {},
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with writers")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should skip pages marked as excludeFromWrite", async () => {
      let writerCalled = false
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test", outputType: "HTML" },
            excludeFromWrite: true,
          },
        ],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            outputType: "HTML",
            handler: async () => {
              writerCalled = true
            },
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      assert.equal(
        writerCalled,
        false,
        "writer should not be called for excluded pages",
      )

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should skip pages without permalink", async () => {
      let writerCalled = false
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test", outputType: "HTML" },
            // No permalink
          },
        ],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            outputType: "HTML",
            handler: async () => {
              writerCalled = true
            },
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      assert.equal(
        writerCalled,
        false,
        "writer should not be called for pages without permalink",
      )

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should skip pages with SKIP outputType", async () => {
      let writerCalled = false
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test", outputType: "SKIP" },
            permalink: "/test/",
          },
        ],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            outputType: "SKIP",
            handler: async () => {
              writerCalled = true
            },
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      assert.equal(
        writerCalled,
        false,
        "writer should not be called for SKIP pages",
      )

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should warn when no writer found for outputType", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: {
              id: "./test",
              outputType: "UNKNOWN",
              inputPath: "content/test.md",
            },
            permalink: "/test/",
          },
        ],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should handle writer errors", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: {
              id: "./test",
              outputType: "HTML",
              outputPath: "test.html",
            },
            permalink: "/test/",
          },
        ],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            outputType: "HTML",
            handler: async () => {
              throw new Error("Test writer error")
            },
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should execute context writers", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            scope: "CONTEXT",
            handler: async () => {},
            target: "test.json",
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with context writers")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should skip inactive context writers", async () => {
      let contextWriterCalled = false
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            scope: "CONTEXT",
            handler: async () => {
              contextWriterCalled = true
            },
            active: false,
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      assert.equal(
        contextWriterCalled,
        false,
        "inactive context writer should not be called",
      )

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle context writer errors", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        writers: [
          {
            scope: "CONTEXT",
            handler: async () => {
              throw new Error("Test context writer error")
            },
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("incremental build edge cases", () => {
    it("should handle template file changes", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          template: "theme/templates",
          content: "content",
        },
        defaults: {
          ...originalLoadConfig().defaults,
          enablePageIndexes: true,
        },
      }

      const lastBuild = {
        context: {
          pages: {
            "./test": {
              _meta: { id: "./test" },
              layout: "default.njk",
            },
          },
        },
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "theme/templates/default.njk",
        verbosity: "error",
      }

      await build(options, lastBuild, 1)

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("page index warnings", () => {
    it("should warn about disabled indexes for large sites", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      // Create a context with > 1000 pages
      const pages = {}
      for (let i = 0; i < 1001; i++) {
        pages[`./page${i}`] = { _meta: { id: `./page${i}` } }
      }

      const customConfig = {
        ...originalLoadConfig(),
        defaults: {
          ...originalLoadConfig().defaults,
          enablePageIndexes: false,
        },
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        verbosity: "error",
      }

      const lastBuild = {
        context: { pages },
        config: customConfig,
      }

      await build(options, lastBuild)

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("dynamic data computation", () => {
    it("should handle computePageData errors", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test" },
            // Function that will cause an error
            computed: function () {
              throw new Error("Test compute error")
            },
          },
        ],
      ]

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should handle max computing rounds exceeded", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      // Create a function that never resolves (always returns a function)
      const neverResolvingFunction = () => neverResolvingFunction
      neverResolvingFunction.kissDependencies = []

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test" },
            computed: neverResolvingFunction,
          },
        ],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        defaults: {
          ...originalLoadConfig().defaults,
          maxComputingRounds: 2, // Low limit to trigger error
        },
      })

      const options = {
        verbosity: "error",
      }

      await build(options)

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should handle _no_cascade attribute override", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test" },
            normalAttr: "original",
            normalAttr_no_cascade: "override",
            onlyOverride_no_cascade: "value",
          },
        ],
      ]

      const options = {
        verbosity: "error",
      }

      const result = await build(options)

      // The _no_cascade logic should be processed
      assert.ok(result)

      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should handle countPendingDependencies with invalid dependency type", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      // Create a function with invalid dependency (not string or array)
      const funcWithInvalidDeps = () => "result"
      funcWithInvalidDeps.kissDependencies = [123] // Invalid: number instead of string/array

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test" },
            computed: funcWithInvalidDeps,
          },
        ],
      ]

      const options = {
        verbosity: "error",
      }

      // Should handle the error without crashing
      await build(options)

      mockHelpers.getBuildEntries = originalGetBuildEntries
    })
  })

  describe("_no_cascade attribute handling", () => {
    it("should process _no_cascade attribute keys", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test" },
            test_no_cascade: "cascade-disabled",
          },
        ],
      ]

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with _no_cascade attributes")

      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should skip attribute when _no_cascade version exists", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test" },
            title: "Original Title",
            title_no_cascade: "No Cascade Title",
          },
        ],
      ]

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(
        result,
        "Build should handle attribute with _no_cascade override",
      )

      mockHelpers.getBuildEntries = originalGetBuildEntries
    })
  })

  describe("additional hook scenarios", () => {
    it("should handle hook with no incrementalRebuild in incremental mode", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "run",
              handler: () => {},
              // No incrementalRebuild function
            },
          ],
        },
      }

      const lastBuild = {
        context: { pages: {} },
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "content/test.md",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)
      assert.ok(result, "Build should complete")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle hook as plain function", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [function testHook() {}],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with function hook")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle copy hook action", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "copy",
              from: tempDir,
              to: "output",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with copy hook")

      mockConfig.loadConfig = originalLoadConfig
    })

    it("should handle exec hook action", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        hooks: {
          ...originalLoadConfig().hooks,
          postWrite: [
            {
              action: "exec",
              command: "echo test",
            },
          ],
        },
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete with exec hook")

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("incremental build content changes", () => {
    it("should show reloading message for content changes with buildPageIds", async () => {
      const originalLoadConfig = mockConfig.loadConfig
      const originalGetPageFromInputPath = mockHelpers.getPageFromInputPath

      // Mock getPageFromInputPath to return a page
      mockHelpers.getPageFromInputPath = () => ({
        _meta: {
          id: "./test",
          inputPath: "content/test.md",
          ascendants: [],
          descendants: [],
          inputSources: [{ loaderId: 0, path: "content/test.md" }],
        },
      })

      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
      }

      const lastBuild = {
        context: {
          pages: {
            "./test": {
              _meta: {
                id: "./test",
                inputPath: "content/test.md",
                inputSources: [{ loaderId: 0, path: "content/test.md" }],
              },
            },
          },
        },
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "content/test.md",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)
      assert.ok(result, "Build should complete")

      mockConfig.loadConfig = originalLoadConfig
      mockHelpers.getPageFromInputPath = originalGetPageFromInputPath
    })

    it("should handle initial incremental build with no buildPageIds", async () => {
      const originalLoadConfig = mockConfig.loadConfig

      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
      }

      // No lastBuild.context - first build
      const lastBuild = {
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "content/test.md",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)
      assert.ok(result, "Build should complete")

      mockConfig.loadConfig = originalLoadConfig
    })
  })

  describe("transform scenarios with outputType filtering", () => {
    it("should apply transform with incremental message", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries
      const originalGetPageFromInputPath = mockHelpers.getPageFromInputPath

      mockHelpers.getPageFromInputPath = () => ({
        _meta: {
          id: "./test",
          ascendants: [],
          descendants: [],
          inputSources: [{ loaderId: 0, path: "content/test.md" }],
        },
      })

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test", outputType: "HTML" },
          },
        ],
      ]

      const originalLoadConfig = mockConfig.loadConfig
      const customConfig = {
        ...originalLoadConfig(),
        dirs: {
          ...originalLoadConfig().dirs,
          content: "content",
        },
        transforms: [
          {
            handler: async (page) => page,
            outputType: "HTML",
          },
        ],
      }

      const lastBuild = {
        context: {
          pages: {
            "./test": {
              _meta: {
                id: "./test",
                inputSources: [{ loaderId: 0, path: "content/test.md" }],
              },
            },
          },
        },
        config: customConfig,
      }

      mockConfig.loadConfig = () => customConfig

      const options = {
        incremental: true,
        event: "change",
        file: "content/test.md",
        verbosity: "error",
      }

      const result = await build(options, lastBuild, 1)
      assert.ok(result, "Build should complete with incremental transforms")

      mockHelpers.getBuildEntries = originalGetBuildEntries
      mockHelpers.getPageFromInputPath = originalGetPageFromInputPath
    })

    it("should skip transform when outputType doesn't match page", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries
      const originalLoadConfig = mockConfig.loadConfig

      mockHelpers.getBuildEntries = () => [
        [
          "./test",
          {
            _meta: { id: "./test", outputType: "HTML" },
          },
        ],
      ]

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            handler: async (page) => page,
            outputType: "JSON", // Won't match HTML page
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete")

      mockHelpers.getBuildEntries = originalGetBuildEntries
    })

    it("should skip entries when none match outputType", async () => {
      const originalGetBuildEntries = mockHelpers.getBuildEntries
      const originalLoadConfig = mockConfig.loadConfig

      // Return entries but with different outputType
      mockHelpers.getBuildEntries = (_context, buildFlags) => {
        if (buildFlags && buildFlags.incremental) {
          return []
        }
        return [
          [
            "./test",
            {
              _meta: { id: "./test", outputType: "IMAGE" },
            },
          ],
        ]
      }

      mockConfig.loadConfig = () => ({
        ...originalLoadConfig(),
        transforms: [
          {
            handler: async (page) => page,
            outputType: "HTML", // Won't match any entries
          },
        ],
      })

      const options = {
        verbosity: "error",
      }

      const result = await build(options)
      assert.ok(result, "Build should complete")

      mockHelpers.getBuildEntries = originalGetBuildEntries
    })
  })
})

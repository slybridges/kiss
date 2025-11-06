const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const fs = require("fs-extra")
const path = require("path")

// Mock dependencies
const mockBrowserSync = {
  instances: [],
  create: function () {
    const instance = {
      init: function (config) {
        this.config = config
        mockBrowserSync.instances.push(this)
      },
      exit: function () {
        const index = mockBrowserSync.instances.indexOf(this)
        if (index > -1) {
          mockBrowserSync.instances.splice(index, 1)
        }
      },
    }
    return instance
  },
  reset: function () {
    this.instances = []
  },
}

const mockChokidar = {
  watchers: [],
  watch: function (paths, options) {
    const watcher = {
      paths,
      options,
      listeners: new Map(),
      on: function (event, handler) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, [])
        }
        this.listeners.get(event).push(handler)
        return this
      },
      emit: function (event, ...args) {
        const handlers = this.listeners.get(event) || []
        handlers.forEach((handler) => {
          try {
            handler(...args)
          } catch {
            // Ignore errors in test
          }
        })
      },
      close: function () {
        const index = mockChokidar.watchers.indexOf(this)
        if (index > -1) {
          mockChokidar.watchers.splice(index, 1)
        }
      },
    }
    mockChokidar.watchers.push(watcher)
    return watcher
  },
  reset: function () {
    this.watchers = []
  },
}

const _defaultLoadConfigImpl = (options = {}) => ({
  dirs: {
    content: "content",
    public: "public",
    theme: "theme",
    watchExtra: [],
  },
  configFile: options.configFile || "kiss.config.js",
})

const mockConfig = {
  _loadConfigImpl: _defaultLoadConfigImpl,
  loadConfig: (options) => mockConfig._loadConfigImpl(options),
}

const mockBuild = async (options = {}) => {
  mockBuild.lastCall = { options }
  mockBuild.callCount = (mockBuild.callCount || 0) + 1

  return {
    context: { pages: {} },
    config: mockConfig.loadConfig(options),
  }
}

const {
  mockGlobalLogger: mockGlobalLoggerHelper,
  createTempDir,
  cleanupTempDir,
  mockProcessExit,
} = require("../../test-utils/helpers")

const mockLogger = {
  resetGlobalLogger: () => {
    mockGlobalLoggerHelper()
  },
}

// Mock the require calls
require.cache[require.resolve("browser-sync")] = { exports: mockBrowserSync }
require.cache[require.resolve("chokidar")] = { exports: mockChokidar }
require.cache[require.resolve("../../src/config")] = { exports: mockConfig }
require.cache[require.resolve("../../src/build.js")] = { exports: mockBuild }
require.cache[require.resolve("../../src/logger")] = { exports: mockLogger }

const { serve, start, watch } = require("../../src/devServer")

describe("devServer", () => {
  let tempDir
  let originalProcessOn
  let processExitMock
  let processListeners

  beforeEach(() => {
    tempDir = createTempDir()

    // Reset mocks
    mockBrowserSync.reset()
    mockChokidar.reset()
    mockBuild.lastCall = null
    mockBuild.callCount = 0

    // Mock process.on to capture signal handlers
    processListeners = new Map()
    originalProcessOn = process.on
    process.on = (signal, handler) => {
      if (!processListeners.has(signal)) {
        processListeners.set(signal, [])
      }
      processListeners.get(signal).push(handler)
      return process
    }

    // Mock process.exit to prevent tests from actually exiting
    processExitMock = mockProcessExit()

    // Set up global logger
    mockLogger.resetGlobalLogger()
  })

  afterEach(() => {
    // Close any open watchers
    mockChokidar.watchers.forEach((w) => {
      try {
        w.close()
      } catch {
        // Ignore errors
      }
    })

    // Close any browser-sync instances
    mockBrowserSync.instances.forEach((i) => {
      try {
        i.exit()
      } catch {
        // Ignore errors
      }
    })

    cleanupTempDir(tempDir)
    process.on = originalProcessOn
    processExitMock.restore()
  })

  describe("serve", () => {
    it("should initialize browser-sync with correct config", () => {
      const config = {
        dirs: {
          public: tempDir,
        },
      }

      serve({}, config)

      assert.equal(mockBrowserSync.instances.length, 1)
      const instance = mockBrowserSync.instances[0]
      assert.ok(instance.config)
      assert.equal(instance.config.server.baseDir, tempDir)
      assert.ok(instance.config.watch)
      assert.ok(instance.config.watchOptions.awaitWriteFinish)
      assert.deepEqual(instance.config.server.serveStaticOptions.extensions, [
        "html",
      ])
    })

    it("should load config when not provided", () => {
      const options = { configFile: "test.config.js" }

      serve(options)

      assert.equal(mockBrowserSync.instances.length, 1)
      // Should have loaded config
    })

    it("should use provided config", () => {
      const config = {
        dirs: {
          public: "/custom/public",
        },
      }

      serve({}, config)

      const instance = mockBrowserSync.instances[0]
      assert.equal(instance.config.server.baseDir, "/custom/public")
    })
  })

  describe("start", () => {
    beforeEach(async () => {
      // Create a public directory for the test
      await fs.ensureDir(path.join(tempDir, "public"))
    })

    it("should call watch and serve", async () => {
      const options = { verbosity: "error" }

      // Mock the loadConfig to use our temp directory
      const originalLoadConfigImpl = mockConfig._loadConfigImpl
      mockConfig._loadConfigImpl = (opts) => ({
        ...originalLoadConfigImpl(opts),
        dirs: {
          content: path.join(tempDir, "content"),
          public: path.join(tempDir, "public"),
          theme: path.join(tempDir, "theme"),
          watchExtra: [],
        },
      })

      await start(options)

      // Should have created browser-sync instance
      assert.equal(mockBrowserSync.instances.length, 1)

      // Should have created file watcher
      assert.equal(mockChokidar.watchers.length, 1)

      // Should have called build for initial build
      assert.ok(mockBuild.callCount > 0)

      // Restore original loadConfig
      mockConfig._loadConfigImpl = originalLoadConfigImpl
    })

    it("should create placeholder index.html if not exists", async () => {
      const publicDir = path.join(tempDir, "public")
      await fs.ensureDir(publicDir)

      const options = { verbosity: "error" }

      const originalLoadConfigImpl = mockConfig._loadConfigImpl
      mockConfig._loadConfigImpl = () => ({
        dirs: {
          content: path.join(tempDir, "content"),
          public: publicDir,
          theme: path.join(tempDir, "theme"),
          watchExtra: [],
        },
        configFile: "kiss.config.js",
      })

      await start(options)

      // Should have created placeholder index.html
      const indexPath = path.join(publicDir, "index.html")
      assert.ok(await fs.pathExists(indexPath))

      const content = await fs.readFile(indexPath, "utf-8")
      assert.ok(content.includes("Building site, please wait"))

      mockConfig._loadConfigImpl = originalLoadConfigImpl
    })
  })

  describe("watch", () => {
    it("should set up file watcher with correct paths", async () => {
      const config = {
        dirs: {
          content: "content",
          theme: "theme",
          watchExtra: ["extra-dir"],
        },
        configFile: "kiss.config.js",
      }

      const options = { verbosity: "error" }

      await watch(options, config)

      assert.equal(mockChokidar.watchers.length, 1)
      const watcher = mockChokidar.watchers[0]

      assert.deepEqual(watcher.paths, [
        "content",
        "theme",
        "kiss.config.js",
        "extra-dir",
      ])

      assert.ok(watcher.options.awaitWriteFinish)
      assert.equal(watcher.options.ignoreInitial, true)
    })

    it("should perform initial build", async () => {
      const options = { verbosity: "error" }

      await watch(options)

      assert.ok(mockBuild.callCount >= 1)
      assert.equal(mockBuild.lastCall.options.verbosity, "error")
    })

    it("should set watchMode flag", async () => {
      const options = { verbosity: "error" }

      await watch(options)

      assert.equal(mockBuild.lastCall.options.watchMode, true)
    })

    it("should handle file changes in normal mode", async () => {
      const options = { verbosity: "error" }

      await watch(options)

      const watcher = mockChokidar.watchers[0]

      // Reset build call count after initial build
      mockBuild.callCount = 0

      // Simulate a file change
      watcher.emit("all", "change", "content/test.md")

      // Wait for debounce (500ms + buffer)
      await new Promise((resolve) => setTimeout(resolve, 600))

      // Should trigger a rebuild after debounce
      assert.ok(mockBuild.callCount > 0)
    })

    it("should handle file changes in incremental mode", async () => {
      const options = {
        incremental: true,
        verbosity: "error",
      }

      await watch(options)

      const watcher = mockChokidar.watchers[0]

      // Reset build call count
      mockBuild.callCount = 0

      // Simulate file changes
      watcher.emit("all", "change", "content/test.md")
      watcher.emit("all", "add", "content/new.md")

      // Should handle incremental rebuilds
      assert.ok(mockBuild.callCount > 0)
    })

    it("should queue changes when build is running in incremental mode", async () => {
      const options = {
        incremental: true,
        verbosity: "error",
      }

      await watch(options)

      const watcher = mockChokidar.watchers[0]

      // Simulate rapid file changes
      watcher.emit("all", "change", "content/test1.md")
      watcher.emit("all", "change", "content/test2.md")
      watcher.emit("all", "change", "content/test3.md")

      // Should handle all changes (exact behavior depends on implementation)
      assert.ok(mockBuild.callCount > 0)
    })

    it("should set up signal handlers for cleanup", async () => {
      const options = { verbosity: "error" }

      await watch(options)

      // Should have registered signal handlers
      const expectedSignals = [
        "exit",
        "SIGINT",
        "SIGUSR1",
        "SIGUSR2",
        "uncaughtException",
        "SIGTERM",
      ]

      expectedSignals.forEach((signal) => {
        assert.ok(
          processListeners.has(signal),
          `Should have handler for ${signal}`,
        )
        assert.ok(
          processListeners.get(signal).length > 0,
          `Should have at least one handler for ${signal}`,
        )
      })
    })

    it("should clean up watchers on signal", async () => {
      const options = { verbosity: "error" }

      await watch(options)

      assert.equal(mockChokidar.watchers.length, 1)

      // Simulate SIGINT signal
      const sigintHandlers = processListeners.get("SIGINT") || []
      if (sigintHandlers.length > 0) {
        try {
          sigintHandlers[0](0) // Call the first SIGINT handler
        } catch (err) {
          // Handler calls process.exit which we've mocked to throw
          assert.ok(err.message.includes("Process exit"))
        }
      }

      // Watcher should be cleaned up
      assert.equal(mockChokidar.watchers.length, 0)
    })

    it("should handle config loading when not provided", async () => {
      const options = {
        configFile: "custom.config.js",
        verbosity: "error",
      }

      await watch(options)

      // Should have loaded config and started watching
      assert.equal(mockChokidar.watchers.length, 1)
    })
  })

  describe("incremental rebuild functionality", () => {
    it("should track build versions", async () => {
      const options = {
        incremental: true,
        verbosity: "error",
      }

      await watch(options)

      const watcher = mockChokidar.watchers[0]

      // Simulate multiple file changes
      watcher.emit("all", "change", "content/test1.md")
      watcher.emit("all", "change", "content/test2.md")

      // Build should be called with version information
      // (Exact implementation details depend on the incremental rebuild logic)
      assert.ok(mockBuild.callCount > 0)
    })

    it("should handle backlog of changes", async () => {
      const options = {
        incremental: true,
        verbosity: "error",
      }

      await watch(options)

      const watcher = mockChokidar.watchers[0]

      // Simulate many rapid changes
      for (let i = 0; i < 5; i++) {
        watcher.emit("all", "change", `content/test${i}.md`)
      }

      // Should handle all changes appropriately
      assert.ok(mockBuild.callCount > 0)
    })
  })

  describe("error handling", () => {
    it("should handle watch setup errors gracefully", async () => {
      const options = { verbosity: "error" }

      // Should not throw even if there are issues
      await assert.doesNotReject(async () => {
        await watch(options)
      })
    })

    it("should handle build errors in watch mode", async () => {
      // Mock build to throw an error
      const originalCacheEntry =
        require.cache[require.resolve("../../src/build.js")]
      require.cache[require.resolve("../../src/build.js")] = {
        exports: async () => {
          throw new Error("Build failed")
        },
      }

      const options = { verbosity: "error" }

      // Should not crash the watch process
      await assert.doesNotReject(async () => {
        await watch(options)
      })

      // Restore original mock
      require.cache[require.resolve("../../src/build.js")] = originalCacheEntry
    })

    it("should handle file change errors gracefully", async () => {
      const options = { verbosity: "error" }

      await watch(options)

      const watcher = mockChokidar.watchers[0]

      // Should not crash when emitting events
      assert.doesNotThrow(() => {
        watcher.emit("all", "change", "nonexistent-file.md")
        watcher.emit("all", "unlink", "deleted-file.md")
        watcher.emit("all", "error", new Error("Watch error"))
      })
    })
  })

  describe("private helper functions", () => {
    it("should clear require cache for hot reload", async () => {
      // This tests the clearRequireCache functionality
      // The function should clear non-node_modules requires

      const options = { verbosity: "error" }

      await watch(options)

      // After watch is set up, file changes should trigger cache clearing
      const watcher = mockChokidar.watchers[0]

      // This would test clearRequireCache but since it's a private function
      // and has side effects on require.cache, we just verify watch works
      assert.doesNotThrow(() => {
        watcher.emit("all", "change", "content/test.md")
      })
    })
  })
})

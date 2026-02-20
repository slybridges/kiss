const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const { loadConfig, defaultConfig } = require("../../../src/config")
const {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  mockGlobalLogger,
  restoreGlobalLogger,
  clearRequireCache,
} = require("../../../test-utils/helpers")

describe("loadConfig", () => {
  let tempDir
  let originalLogger

  beforeEach(() => {
    tempDir = createTempDir()
    // Mock global.logger
    originalLogger = mockGlobalLogger()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
    restoreGlobalLogger(originalLogger)
    // Clear require cache for config files
    clearRequireCache(tempDir)
  })

  it("should load default config when no config file specified", () => {
    // Create a minimal config file
    const configPath = path.join(tempDir, "kiss.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              url: "https://test.com",
              title: "Test Site",
            }
          }
        }
      }
    `
    createTestFile(tempDir, "kiss.config.js", configContent)

    const config = loadConfig({ configFile: configPath })
    assert.equal(config.context.site.url, "https://test.com")
    assert.equal(config.context.site.title, "Test Site")
  })

  it("should merge with default config", () => {
    const configPath = path.join(tempDir, "custom.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              url: "https://custom.com",
              title: "Custom Site",
              description: "Custom Description"
            }
          },
          dirs: {
            ...defaultConfig.dirs,
            content: "custom-content"
          }
        }
      }
    `
    createTestFile(tempDir, "custom.config.js", configContent)

    const config = loadConfig({ configFile: configPath })
    assert.equal(config.context.site.url, "https://custom.com")
    assert.equal(config.context.site.title, "Custom Site")
    assert.equal(config.dirs.content, "custom-content")
    // Check that other default dirs are preserved
    assert.equal(config.dirs.public, "public")
  })

  it("should throw error for missing config file", () => {
    const configPath = path.join(tempDir, "nonexistent.config.js")

    assert.throws(() => {
      loadConfig({ configFile: configPath })
    }, /Error loading/)
  })

  it("should throw error for invalid config file", () => {
    const configPath = path.join(tempDir, "invalid.config.js")
    const configContent = `
      module.exports = "not a function"
    `
    createTestFile(tempDir, "invalid.config.js", configContent)

    assert.throws(() => {
      loadConfig({ configFile: configPath })
    }, /Error loading/)
  })

  it("should validate site URL", () => {
    let errorMessage = ""
    global.logger.error = (msg) => {
      errorMessage = msg
    }

    const configPath = path.join(tempDir, "no-url.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              title: "No URL Site"
            }
          }
        }
      }
    `
    createTestFile(tempDir, "no-url.config.js", configContent)

    loadConfig({ configFile: configPath })
    assert(errorMessage.includes("context.site.url"))
    assert(errorMessage.includes("required"))
  })

  it("should warn for missing site title", () => {
    const warnings = []
    global.logger.warn = (msg) => {
      warnings.push(msg)
    }

    const configPath = path.join(tempDir, "no-title.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              url: "https://test.com"
            }
          }
        }
      }
    `
    createTestFile(tempDir, "no-title.config.js", configContent)

    loadConfig({ configFile: configPath })
    const titleWarning = warnings.find(
      (w) => w.includes("site title") || w.includes("site.title"),
    )
    assert(titleWarning, "Should warn about missing site title")
  })

  it("should warn for missing site image", () => {
    const warnings = []
    global.logger.warn = (msg) => {
      warnings.push(msg)
    }

    const configPath = path.join(tempDir, "no-image.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              url: "https://test.com",
              title: "Test Site"
            }
          }
        }
      }
    `
    createTestFile(tempDir, "no-image.config.js", configContent)

    loadConfig({ configFile: configPath })
    const imageWarning = warnings.find((w) => w.includes("default image"))
    assert(imageWarning, "Should warn about missing default image")
  })

  it("should handle config that returns modified defaultConfig", () => {
    const configPath = path.join(tempDir, "modify.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        defaultConfig.context.site.url = "https://modified.com"
        defaultConfig.context.site.title = "Modified Site"
        return defaultConfig
      }
    `
    createTestFile(tempDir, "modify.config.js", configContent)

    const config = loadConfig({ configFile: configPath })
    assert.equal(config.context.site.url, "https://modified.com")
    assert.equal(config.context.site.title, "Modified Site")
    // Should have all default properties
    assert(config.dirs)
    assert(config.defaults)
    assert(config.hooks)
  })

  it("should preserve configFile path in config", () => {
    const configPath = path.join(tempDir, "custom.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              url: "https://test.com",
              title: "Test"
            }
          }
        }
      }
    `
    createTestFile(tempDir, "custom.config.js", configContent)

    const config = loadConfig({ configFile: configPath })
    assert.equal(config.configFile, configPath)
  })

  it("should handle config with custom hooks", () => {
    const configPath = path.join(tempDir, "hooks.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        const customLoader = { handler: () => {}, namespace: "custom" }
        const customTransform = { handler: () => {}, outputType: "HTML" }

        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              url: "https://test.com",
              title: "Test"
            }
          },
          loaders: [...defaultConfig.loaders, customLoader],
          transforms: [...defaultConfig.transforms, customTransform]
        }
      }
    `
    createTestFile(tempDir, "hooks.config.js", configContent)

    const config = loadConfig({ configFile: configPath })
    assert(config.loaders.length > defaultConfig.loaders.length)
    assert(config.transforms.length > defaultConfig.transforms.length)
  })

  it("should handle config with syntax errors", () => {
    const configPath = path.join(tempDir, "syntax-error.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            site: {
              url: "https://test.com"
              title: "Missing comma"
            }
          }
        }
      }
    `
    createTestFile(tempDir, "syntax-error.config.js", configContent)

    assert.throws(() => {
      loadConfig({ configFile: configPath })
    }, /Error loading/)
  })

  it("should handle config that throws an error", () => {
    const configPath = path.join(tempDir, "throwing.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        throw new Error("Config error!")
      }
    `
    createTestFile(tempDir, "throwing.config.js", configContent)

    assert.throws(() => {
      loadConfig({ configFile: configPath })
    }, /Error loading/)
  })

  it("should validate invalid site URL", () => {
    let errorMessage = ""
    global.logger.error = (msg) => {
      errorMessage = msg
    }

    const configPath = path.join(tempDir, "invalid-url.config.js")
    const configContent = `
      module.exports = (defaultConfig) => {
        return {
          ...defaultConfig,
          context: {
            ...defaultConfig.context,
            site: {
              url: "not-a-url",
              title: "Test"
            }
          }
        }
      }
    `
    createTestFile(tempDir, "invalid-url.config.js", configContent)

    loadConfig({ configFile: configPath })
    assert(errorMessage.includes("valid URL"))
  })
})

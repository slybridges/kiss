const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const fs = require("fs-extra")
const path = require("path")
const jsonContextWriter = require("../../../src/writers/jsonContextWriter")
const {
  createTempDir,
  cleanupTempDir,
  createMockConfig,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../../test-utils/helpers")

describe("jsonContextWriter", () => {
  let tempDir
  let publicDir
  let config
  let originalLogger

  beforeEach(() => {
    tempDir = createTempDir()
    publicDir = path.join(tempDir, "public")
    fs.ensureDirSync(publicDir)

    config = createMockConfig({
      dirs: {
        public: publicDir,
      },
    })

    // Mock global.logger
    originalLogger = mockGlobalLogger()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
    restoreGlobalLogger(originalLogger)
  })

  it("should warn and skip when no target specified", async () => {
    let warnMessage = ""
    global.logger.warn = (message) => {
      warnMessage = message
    }

    const context = { site: { title: "Test" } }

    const result = await jsonContextWriter(context, {}, config)

    assert.equal(result, undefined)
    assert.ok(warnMessage.includes("No 'target' passed in options"))
  })

  it("should write JSON context to target file", async () => {
    const context = {
      site: {
        title: "Test Site",
        url: "https://example.com",
        description: "A test site",
      },
      pages: {
        "./index": {
          title: "Home Page",
          content: "Welcome to the home page",
          _meta: { id: "./index" },
        },
        "./about": {
          title: "About Page",
          content: "About us information",
          _meta: { id: "./about" },
        },
      },
      collections: {
        posts: {
          _id: "./posts",
          allPosts: [],
        },
      },
    }

    const options = {
      target: "context.json",
    }

    await jsonContextWriter(context, options, config)

    const jsonPath = path.join(publicDir, "context.json")
    assert.ok(await fs.pathExists(jsonPath), "JSON file should be created")

    const jsonContent = await fs.readFile(jsonPath, "utf-8")
    const parsedData = JSON.parse(jsonContent)

    assert.equal(parsedData.site.title, "Test Site")
    assert.equal(parsedData.site.url, "https://example.com")
    assert.ok(parsedData.pages["./index"])
    assert.equal(parsedData.pages["./index"].title, "Home Page")
    assert.ok(parsedData.collections.posts)
  })

  it("should omit specified fields from output", async () => {
    const context = {
      site: {
        title: "Test Site",
        secretKey: "super-secret",
        apiToken: "token-123",
      },
      pages: {
        "./index": {
          title: "Home Page",
          content: "Public content",
          privateNotes: "Internal notes",
          _meta: {
            id: "./index",
            buildVersion: 1,
            internalFlag: true,
          },
        },
      },
      internalData: {
        config: "sensitive-config",
      },
    }

    const options = {
      target: "context.json",
      omit: [
        "secretKey",
        "apiToken",
        "privateNotes",
        "_meta.buildVersion",
        "internalData",
      ],
    }

    await jsonContextWriter(context, options, config)

    const jsonPath = path.join(publicDir, "context.json")
    const jsonContent = await fs.readFile(jsonPath, "utf-8")
    const parsedData = JSON.parse(jsonContent)

    // Should include allowed fields
    assert.equal(parsedData.site.title, "Test Site")
    assert.equal(parsedData.pages["./index"].title, "Home Page")
    assert.equal(parsedData.pages["./index"].content, "Public content")
    assert.equal(parsedData.pages["./index"]._meta.id, "./index")
    assert.equal(parsedData.pages["./index"]._meta.internalFlag, true)

    // Should omit specified fields
    assert.equal(parsedData.site.secretKey, undefined)
    assert.equal(parsedData.site.apiToken, undefined)
    assert.equal(parsedData.pages["./index"].privateNotes, undefined)
    assert.equal(parsedData.pages["./index"]._meta.buildVersion, undefined)
    assert.equal(parsedData.internalData, undefined)
  })

  it("should handle custom indentation", async () => {
    const context = {
      site: { title: "Test Site" },
      pages: {
        "./index": { title: "Home" },
      },
    }

    const options = {
      target: "indented.json",
      space: 4, // 4-space indentation
    }

    await jsonContextWriter(context, options, config)

    const jsonContent = await fs.readFile(
      path.join(publicDir, "indented.json"),
      "utf-8",
    )

    // Check that it's properly indented with 4 spaces
    const lines = jsonContent.split("\n")
    const indentedLine = lines.find((line) =>
      line.includes('"title": "Test Site"'),
    )
    assert.ok(
      indentedLine && indentedLine.startsWith("    "),
      "Should be indented with 4 spaces",
    )
  })

  it("should handle no indentation when space is 0", async () => {
    const context = {
      site: { title: "Test Site" },
      pages: {},
    }

    const options = {
      target: "minified.json",
      space: 0, // No indentation
    }

    await jsonContextWriter(context, options, config)

    const jsonContent = await fs.readFile(
      path.join(publicDir, "minified.json"),
      "utf-8",
    )

    // Should be minified (no newlines or extra spaces)
    assert.ok(!jsonContent.includes("\n"), "Should not contain newlines")
    assert.ok(jsonContent.includes('{"site":{"title":"Test Site"},"pages":{}}'))
  })

  it("should create nested output directories", async () => {
    const context = {
      site: { title: "Test Site" },
    }

    const options = {
      target: "data/exports/context.json",
    }

    await jsonContextWriter(context, options, config)

    const jsonPath = path.join(publicDir, "data", "exports", "context.json")
    assert.ok(
      await fs.pathExists(jsonPath),
      "JSON file should be created in nested directory",
    )

    const jsonContent = await fs.readFile(jsonPath, "utf-8")
    const parsedData = JSON.parse(jsonContent)
    assert.equal(parsedData.site.title, "Test Site")
  })

  it("should handle complex nested data structures", async () => {
    const context = {
      site: {
        title: "Complex Site",
        config: {
          theme: {
            colors: {
              primary: "#007bff",
              secondary: "#6c757d",
            },
            fonts: ["Arial", "Helvetica", "sans-serif"],
          },
        },
      },
      pages: {
        "./complex": {
          title: "Complex Page",
          metadata: {
            tags: ["web", "development", "javascript"],
            author: {
              name: "John Doe",
              email: "john@example.com",
              social: {
                twitter: "@johndoe",
                github: "johndoe",
              },
            },
          },
          _meta: {
            id: "./complex",
            stats: {
              wordCount: 1250,
              readingTime: 5,
            },
          },
        },
      },
    }

    const options = {
      target: "complex.json",
      space: 2,
    }

    await jsonContextWriter(context, options, config)

    const jsonPath = path.join(publicDir, "complex.json")
    const jsonContent = await fs.readFile(jsonPath, "utf-8")
    const parsedData = JSON.parse(jsonContent)

    // Verify nested structure is preserved
    assert.equal(parsedData.site.config.theme.colors.primary, "#007bff")
    assert.deepEqual(parsedData.site.config.theme.fonts, [
      "Arial",
      "Helvetica",
      "sans-serif",
    ])
    assert.deepEqual(parsedData.pages["./complex"].metadata.tags, [
      "web",
      "development",
      "javascript",
    ])
    assert.equal(
      parsedData.pages["./complex"].metadata.author.social.twitter,
      "@johndoe",
    )
    assert.equal(parsedData.pages["./complex"]._meta.stats.wordCount, 1250)
  })

  it("should handle circular references gracefully", async () => {
    const context = {
      site: { title: "Test Site" },
      pages: {},
    }

    // Create a circular reference
    context.self = context

    const options = {
      target: "circular.json",
    }

    // This should throw an error due to circular reference
    await assert.rejects(
      async () => await jsonContextWriter(context, options, config),
      {
        name: "TypeError",
        message: /circular structure/i,
      },
    )
  })

  it("should handle empty context", async () => {
    const context = {}

    const options = {
      target: "empty.json",
    }

    await jsonContextWriter(context, options, config)

    const jsonContent = await fs.readFile(
      path.join(publicDir, "empty.json"),
      "utf-8",
    )
    const parsedData = JSON.parse(jsonContent)
    assert.deepEqual(parsedData, {})
  })

  it("should handle null and undefined values", async () => {
    const context = {
      site: {
        title: "Test Site",
        description: null,
        author: undefined,
        published: false,
        count: 0,
      },
      pages: null,
    }

    const options = {
      target: "nulls.json",
    }

    await jsonContextWriter(context, options, config)

    const jsonContent = await fs.readFile(
      path.join(publicDir, "nulls.json"),
      "utf-8",
    )
    const parsedData = JSON.parse(jsonContent)

    assert.equal(parsedData.site.title, "Test Site")
    assert.equal(parsedData.site.description, null)
    assert.equal(parsedData.site.author, undefined)
    assert.equal(parsedData.site.published, false)
    assert.equal(parsedData.site.count, 0)
    assert.equal(parsedData.pages, null)
  })

  it("should overwrite existing files", async () => {
    const jsonPath = path.join(publicDir, "overwrite.json")

    // Create initial file
    await fs.writeFile(jsonPath, JSON.stringify({ old: "data" }))

    const context = {
      site: { title: "New Data" },
    }

    const options = {
      target: "overwrite.json",
    }

    await jsonContextWriter(context, options, config)

    const jsonContent = await fs.readFile(jsonPath, "utf-8")
    const parsedData = JSON.parse(jsonContent)

    assert.equal(parsedData.site.title, "New Data")
    assert.equal(parsedData.old, undefined)
  })

  it("should handle special characters and Unicode", async () => {
    const context = {
      site: {
        title: "Test Site with émojis 🚀",
        description: "Special chars: áéíóú ñ ü © ® ™",
        quotes: "Mixed \"quotes\" and 'apostrophes'",
        unicode: "Math symbols: ∑ ∞ π ≈ ≠",
      },
    }

    const options = {
      target: "unicode.json",
    }

    await jsonContextWriter(context, options, config)

    const jsonContent = await fs.readFile(
      path.join(publicDir, "unicode.json"),
      "utf-8",
    )
    const parsedData = JSON.parse(jsonContent)

    assert.equal(parsedData.site.title, "Test Site with émojis 🚀")
    assert.equal(parsedData.site.description, "Special chars: áéíóú ñ ü © ® ™")
    assert.equal(parsedData.site.quotes, "Mixed \"quotes\" and 'apostrophes'")
    assert.equal(parsedData.site.unicode, "Math symbols: ∑ ∞ π ≈ ≠")
  })

  it("should return the result of outputFile", async () => {
    const context = { site: { title: "Test" } }

    const options = {
      target: "return-test.json",
    }

    const result = await jsonContextWriter(context, options, config)

    // fs-extra's outputFile returns undefined on success
    assert.equal(result, undefined)
  })
})

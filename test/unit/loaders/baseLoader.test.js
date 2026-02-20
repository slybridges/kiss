const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const { baseLoader } = require("../../../src/loaders")
const {
  createMockConfig,
  createMockPage,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../../test-utils/helpers")

describe("baseLoader", () => {
  let config
  let mockPages
  let originalLogger

  beforeEach(() => {
    originalLogger = mockGlobalLogger()
    config = createMockConfig()
    mockPages = {}
  })

  afterEach(() => {
    restoreGlobalLogger(originalLogger)
  })

  it("should create basic page structure", () => {
    const result = baseLoader("content/test.md", {}, {}, mockPages, config)

    assert(result._meta)
    assert.equal(result._meta.id, "./test.md")
    assert.equal(result._meta.inputPath, "content/test.md")
    assert.equal(result._meta.basename, "test.md")
    assert.equal(result._meta.isDirectory, false)
    assert.equal(result._meta.parent, ".")
    assert.equal(result._meta.source, "file")
    assert.equal(result._meta.outputType, "HTML")
  })

  it("should handle nested paths", () => {
    const result = baseLoader(
      "content/blog/article.md",
      {},
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.id, "./blog/article.md")
    assert.equal(result._meta.parent, "./blog")
    assert.equal(result._meta.basename, "article.md")
  })

  it("should merge with parent data", () => {
    const parentPage = createMockPage({
      parentField: "from parent",
      sharedField: "parent value",
      _meta: {
        id: "./blog",
        parent: ".",
        isDirectory: true,
      },
    })
    mockPages["./blog"] = parentPage

    const result = baseLoader(
      "content/blog/post.md",
      {},
      { sharedField: "child value" },
      mockPages,
      config,
    )

    assert.equal(result.parentField, "from parent")
    assert.equal(result.sharedField, "child value") // Child overrides parent
  })

  it("should handle index files", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./blog",
        parent: ".",
        basename: "blog",
        isDirectory: false,
      },
    })
    mockPages["./blog"] = parentPage

    const result = baseLoader(
      "content/blog/index.md",
      {},
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.id, "./blog")
    assert.equal(result._meta.parent, ".")
    assert.equal(result._meta.basename, "blog")
    assert.equal(result._meta.isDirectory, true)
  })

  it("should handle post files", () => {
    const parentPage = createMockPage({
      title: "Parent Title",
      _meta: {
        id: "./blog",
        parent: ".",
        basename: "blog",
      },
    })
    mockPages["./blog"] = parentPage

    const result = baseLoader(
      "content/blog/post.md",
      {},
      { title: "Post Title" },
      mockPages,
      config,
    )

    assert.equal(result._meta.id, "./blog")
    assert.equal(result._meta.parent, ".")
    assert.equal(result._meta.basename, "blog")
    assert.equal(result.title, "Post Title")
  })

  it("should track input sources", () => {
    const result = baseLoader(
      "content/test.md",
      { file: { loaderId: "markdown" } },
      {},
      mockPages,
      config,
    )

    assert(Array.isArray(result._meta.inputSources))
    assert.equal(result._meta.inputSources.length, 1)
    assert.equal(result._meta.inputSources[0].path, "content/test.md")
    assert.equal(result._meta.inputSources[0].loaderId, "markdown")
  })

  it("should append to existing input sources", () => {
    const existingPage = createMockPage({
      _meta: {
        id: "./test.md",
        inputSources: [{ path: "content/test.js", loaderId: "js" }],
      },
    })
    mockPages["./test.md"] = existingPage

    const result = baseLoader(
      "content/test.md",
      { file: { loaderId: "markdown" } },
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.inputSources.length, 2)
    assert.equal(result._meta.inputSources[0].path, "content/test.js")
    assert.equal(result._meta.inputSources[1].path, "content/test.md")
  })

  it("should not duplicate input sources", () => {
    const existingPage = createMockPage({
      _meta: {
        id: "./test.md",
        inputSources: [{ path: "content/test.md", loaderId: "markdown" }],
      },
    })
    mockPages["./test.md"] = existingPage

    const result = baseLoader(
      "content/test.md",
      { file: { loaderId: "markdown" } },
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.inputSources.length, 1)
  })

  it("should handle file stats", () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const result = baseLoader(
      "content/test.md",
      {
        file: {
          stats: {
            ctime: yesterday,
            mtime: now,
          },
        },
      },
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.fileCreated, yesterday)
    assert.equal(result._meta.fileModified, now)
  })

  it("should handle build version", () => {
    const result = baseLoader(
      "content/test.md",
      { buildVersion: 42 },
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.buildVersion, 42)
  })

  it("should handle custom options", () => {
    const result = baseLoader(
      "content/test.md",
      {
        id: "./custom-id",
        outputType: "JSON",
        collectionGroup: "custom-group",
        source: "computed",
      },
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.id, "./custom-id")
    assert.equal(result._meta.outputType, "JSON")
    assert.equal(result._meta.collectionGroup, "custom-group")
    assert.equal(result._meta.source, "computed")
  })

  it("should handle directory paths", () => {
    const result = baseLoader(
      "content/blog/",
      { isDirectory: true },
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.isDirectory, true)
    assert.equal(result._meta.collectionGroup, "directory")
  })

  it("should handle root content directory", () => {
    const result = baseLoader("content", {}, {}, mockPages, config)

    assert.equal(result._meta.id, ".")
    assert.equal(result._meta.basename, "")
    assert.equal(result._meta.parent, null)
  })

  it("should deep merge metadata", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./parent",
        custom: {
          deep: {
            value: "parent",
          },
        },
      },
    })
    mockPages["./parent"] = parentPage

    const result = baseLoader(
      "content/parent/child.md",
      {},
      {
        _meta: {
          custom: {
            deep: {
              other: "child",
            },
          },
        },
      },
      mockPages,
      config,
    )

    assert.equal(result._meta.custom.deep.value, "parent")
    assert.equal(result._meta.custom.deep.other, "child")
  })

  it("should handle index files with different output types", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./blog",
        parent: ".",
        basename: "blog",
      },
    })
    mockPages["./blog"] = parentPage

    // Index files always use parent directory id, regardless of outputType
    const result = baseLoader(
      "content/blog/index.json",
      {
        outputType: "JSON",
      },
      {},
      mockPages,
      config,
    )

    // Index files represent their directory
    assert.equal(result._meta.id, "./blog")
    assert.equal(result._meta.outputType, "JSON")
  })

  it("should handle missing parent gracefully", () => {
    const result = baseLoader(
      "content/orphan/child.md",
      {},
      {},
      mockPages,
      config,
    )

    assert.equal(result._meta.id, "./orphan/child.md")
    assert.equal(result._meta.parent, "./orphan")
    // Should work even though parent doesn't exist
  })
})

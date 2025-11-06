const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computePermalink = require("../../../src/data/computePermalink")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("computePermalink", () => {
  let config
  let pages
  let context

  beforeEach(() => {
    config = createMockConfig()
    pages = {}
    context = { pages }
  })

  it("should compute permalink for simple HTML file", () => {
    const page = createMockPage({
      _meta: {
        inputPath: "content/about.md",
        outputType: "HTML",
        parent: null,
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/about")
  })

  it("should compute permalink for nested HTML file", () => {
    // Add parent page if needed
    pages["./blog"] = createMockPage({
      permalink: "/blog/",
      _meta: {
        id: "./blog",
      },
    })

    const page = createMockPage({
      _meta: {
        inputPath: "content/blog/post-1.md",
        outputType: "HTML",
        parent: "./blog",
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/blog/post-1")
  })

  it("should handle index files", () => {
    const page = createMockPage({
      _meta: {
        inputPath: "content/blog/index.md",
        outputType: "HTML",
        parent: null,
        isDirectory: true,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/blog/")
  })

  it("should handle post files", () => {
    const page = createMockPage({
      _meta: {
        inputPath: "content/blog/post.md",
        outputType: "HTML",
        parent: null,
        isDirectory: true,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/blog/")
  })

  it("should preserve non-HTML file extensions", () => {
    const page = createMockPage({
      _meta: {
        inputPath: "content/data.json",
        outputType: "JSON",
        parent: null,
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/data.json")
  })

  it("should use custom slug when provided", () => {
    const page = createMockPage({
      slug: "custom-slug",
      _meta: {
        inputPath: "content/about.md",
        outputType: "HTML",
        parent: null,
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    // path.join removes leading slash when joining empty base with slug
    assert.equal(result, "custom-slug")
  })

  it("should use custom slug for index files", () => {
    const page = createMockPage({
      slug: "custom-index",
      _meta: {
        inputPath: "content/blog/index.md",
        outputType: "HTML",
        parent: null,
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    // Custom slug replaces entire path when no parent
    assert.equal(result, "custom-index/")
  })

  it("should inherit parent permalink", () => {
    const parentPage = createMockPage({
      permalink: "/parent-custom/",
      _meta: {
        id: "./blog",
        isDirectory: true,
      },
    })
    pages["./blog"] = parentPage

    const page = createMockPage({
      _meta: {
        inputPath: "content/blog/child.md",
        outputType: "HTML",
        parent: "./blog",
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/parent-custom/child")
  })

  it("should return function if parent permalink is function", () => {
    const parentPage = createMockPage({
      permalink: () => "/computed/",
      _meta: {
        id: "./blog",
      },
    })
    pages["./blog"] = parentPage

    const page = createMockPage({
      _meta: {
        inputPath: "content/blog/child.md",
        outputType: "HTML",
        parent: "./blog",
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, computePermalink)
  })

  it("should add trailing slash for directories", () => {
    const page = createMockPage({
      _meta: {
        inputPath: "content/blog",
        outputType: "HTML",
        parent: null,
        isDirectory: true,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/blog/")
  })

  it("should handle deeply nested paths", () => {
    // Add parent page
    pages["./docs/api/v2"] = createMockPage({
      permalink: "/docs/api/v2/",
      _meta: {
        id: "./docs/api/v2",
      },
    })

    const page = createMockPage({
      _meta: {
        inputPath: "content/docs/api/v2/reference.md",
        outputType: "HTML",
        parent: "./docs/api/v2",
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/docs/api/v2/reference")
  })

  it("should handle root content directory", () => {
    const page = createMockPage({
      _meta: {
        inputPath: "content/index.md",
        outputType: "HTML",
        parent: null,
        isDirectory: true,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/")
  })

  it("should handle custom content directory", () => {
    config.dirs.content = "src/content"
    const page = createMockPage({
      _meta: {
        inputPath: "src/content/about.md",
        outputType: "HTML",
        parent: null,
        isDirectory: false,
      },
    })

    const result = computePermalink(page, config, context)
    assert.equal(result, "/about")
  })

  it("should handle content directory with trailing slash", () => {
    const customConfig = {
      ...config,
      dirs: { ...config.dirs, content: "content/" },
    }
    const page = createMockPage({
      _meta: {
        inputPath: "content/about.md",
        outputType: "HTML",
        parent: null,
        isDirectory: false,
      },
    })

    const result = computePermalink(page, customConfig, context)
    assert.equal(result, "/about")
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computePermalink.kissDependencies))
    assert(computePermalink.kissDependencies.includes("slug"))
    assert.deepEqual(computePermalink.kissDependencies[1], [
      "_meta.parent",
      "permalink",
    ])
  })
})

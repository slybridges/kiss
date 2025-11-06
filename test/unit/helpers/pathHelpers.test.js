const { describe, it } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const { getFullPath, getInputPath } = require("../../../src/helpers")
const { createMockPage } = require("../../../test-utils/helpers")

describe("getFullPath", () => {
  it("should handle relative paths", () => {
    const result = getFullPath("image.jpg", "/blog/")
    assert.equal(result, "/blog/image.jpg")
  })

  it("should handle absolute paths", () => {
    const result = getFullPath("/assets/image.jpg", "/blog/")
    assert.equal(result, "/assets/image.jpg")
  })

  it("should handle absolute paths with absoluteBase", () => {
    const result = getFullPath("/assets/image.jpg", "/blog/", {
      absoluteBase: "/root",
    })
    assert.equal(result, "/root/assets/image.jpg")
  })

  it("should not change URLs", () => {
    const url = "https://example.com/image.jpg"
    const result = getFullPath(url, "/blog/")
    assert.equal(result, url)
  })

  it("should handle parent directory references", () => {
    const result = getFullPath("../image.jpg", "/blog/post/")
    assert.equal(result, "/blog/image.jpg")
  })

  it("should handle current directory references", () => {
    const result = getFullPath("./image.jpg", "/blog/")
    assert.equal(result, "/blog/image.jpg")
  })

  it("should throw error for non-string pathname", () => {
    assert.throws(() => {
      getFullPath(123, "/blog/")
    }, /expected path to be a string/)
  })

  it("should handle invalid paths without throwing when throwIfInvalid is false", () => {
    const result = getFullPath("#anchor", "/blog/")
    assert.equal(result, "#anchor")
  })

  it("should throw for invalid paths when throwIfInvalid is true", () => {
    assert.throws(() => {
      getFullPath("#anchor", "/blog/", {
        throwIfInvalid: true,
      })
    }, /Path .* is invalid/)
  })

  it("should throw for invalid basePath", () => {
    assert.throws(() => {
      getFullPath("image.jpg", "mailto:test@example.com")
    }, /basePath .* is invalid/)
  })

  it("should handle empty pathname", () => {
    const result = getFullPath("", "/blog/")
    assert.equal(result, "/blog/")
  })
})

describe("getInputPath", () => {
  it("should compute input path from permalink", () => {
    const pages = {
      "./blog": createMockPage({
        permalink: "/blog/",
        _meta: {
          id: "./blog",
          inputPath: "content/blog",
          isDirectory: true,
        },
      }),
    }
    const indexes = {
      permalinkIndex: { "/blog/": "./blog" },
    }

    const result = getInputPath("/blog/post.md", pages, "content", indexes)
    assert.equal(result, "content/blog/post.md")
  })

  it("should handle nested permalinks", () => {
    const pages = {
      "./blog/2024": createMockPage({
        permalink: "/blog/2024/",
        _meta: {
          id: "./blog/2024",
          inputPath: "content/blog/2024",
          isDirectory: true,
        },
      }),
    }
    const indexes = {
      permalinkIndex: { "/blog/2024/": "./blog/2024" },
    }

    const result = getInputPath("/blog/2024/post.md", pages, "content", indexes)
    assert.equal(result, "content/blog/2024/post.md")
  })

  it("should return default path when no parent found", () => {
    const pages = {}
    const indexes = { permalinkIndex: {} }

    const result = getInputPath("/unknown/path.md", pages, "content", indexes)
    assert.equal(result, "content/unknown/path.md")
  })

  it("should handle parent that is a file not directory", () => {
    const pages = {
      "./blog/about": createMockPage({
        permalink: "/blog/about/",
        _meta: {
          id: "./blog/about",
          inputPath: "content/blog/about.md",
          isDirectory: false,
        },
      }),
    }
    const indexes = {
      permalinkIndex: { "/blog/about/": "./blog/about" },
    }

    const result = getInputPath("/blog/about/sub.md", pages, "content", indexes)
    assert.equal(result, "content/blog/sub.md")
  })
})

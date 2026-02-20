const { describe, it } = require("node:test")
const assert = require("assert/strict")
const { computePageId, computeParentId } = require("../../../src/helpers")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computePageId", () => {
  const config = createMockConfig()

  it("should handle root directory", () => {
    const result = computePageId("content", config)
    assert.equal(result, ".")
  })

  it("should handle simple file path", () => {
    const result = computePageId("content/about.md", config)
    assert.equal(result, "./about.md")
  })

  it("should handle nested directory", () => {
    const result = computePageId("content/blog/post1.md", config)
    assert.equal(result, "./blog/post1.md")
  })

  it("should remove 'post' basename", () => {
    const result = computePageId("content/blog/post.md", config)
    assert.equal(result, "./blog")
  })

  it("should remove 'index' basename", () => {
    const result = computePageId("content/blog/index.md", config)
    assert.equal(result, "./blog")
  })

  it("should handle multiple nested post/index", () => {
    const result = computePageId("content/blog/2024/index.md", config)
    assert.equal(result, "./blog/2024")
  })

  it("should handle content dir with trailing slash", () => {
    const configWithSlash = createMockConfig({
      dirs: { content: "content/" },
    })
    const result = computePageId("content/page.md", configWithSlash)
    assert.equal(result, "./page.md")
  })

  it("should handle deep nesting", () => {
    const result = computePageId("content/a/b/c/d/e/f/g/h/i/j/page.md", config)
    assert.equal(result, "./a/b/c/d/e/f/g/h/i/j/page.md")
  })

  it("should handle special characters in path", () => {
    const result = computePageId("content/hello-world_2024.md", config)
    assert.equal(result, "./hello-world_2024.md")
  })
})

describe("computeParentId", () => {
  const config = createMockConfig()

  it("should return '.' for root level files", () => {
    const result = computeParentId("content/page.md", config)
    assert.equal(result, ".")
  })

  it("should return parent directory for nested files", () => {
    const result = computeParentId("content/blog/post.md", config)
    assert.equal(result, "./blog")
  })

  it("should handle deep nesting", () => {
    const result = computeParentId("content/blog/2024/01/post.md", config)
    assert.equal(result, "./blog/2024/01")
  })

  it("should return null for root content directory", () => {
    const result = computeParentId("content", config)
    assert.equal(result, null)
  })

  it("should handle index files correctly", () => {
    const result = computeParentId("content/blog/index.md", config)
    assert.equal(result, "./blog")
  })

  it("should handle post files correctly", () => {
    const result = computeParentId("content/blog/post.md", config)
    assert.equal(result, "./blog")
  })
})

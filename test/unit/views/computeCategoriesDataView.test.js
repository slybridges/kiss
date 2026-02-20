const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeCategoriesDataView = require("../../../src/views/computeCategoriesDataView")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeCategoriesDataView", () => {
  let config

  beforeEach(() => {
    config = createMockConfig({
      libs: {
        unslugify: (str) => {
          // Simple unslugify implementation
          return str.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        },
      },
    })
  })

  it("should return empty array when no directories exist", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./file": { _meta: { id: "./file", isDirectory: false, parent: "." } },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)
    assert.deepEqual(result, [])
  })

  it("should compute categories from directories", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./tech": {
          _meta: {
            id: "./tech",
            isDirectory: true,
            parent: ".",
            basename: "tech",
            descendants: ["./tech/post1"],
          },
        },
        "./tech/post1": {
          _meta: { id: "./tech/post1", isPost: true, parent: "./tech" },
        },
        "./design": {
          _meta: {
            id: "./design",
            isDirectory: true,
            parent: ".",
            basename: "design",
            descendants: ["./design/post2"],
          },
        },
        "./design/post2": {
          _meta: { id: "./design/post2", isPost: true, parent: "./design" },
        },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)

    assert.equal(result.length, 2)

    const techCategory = result.find((cat) => cat.name === "Tech")
    assert.ok(techCategory)
    assert.equal(techCategory.entry._meta.id, "./tech")
    assert.equal(techCategory.count, 1)

    const designCategory = result.find((cat) => cat.name === "Design")
    assert.ok(designCategory)
    assert.equal(designCategory.entry._meta.id, "./design")
    assert.equal(techCategory.count, 1)
  })

  it("should handle nested directory structure", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./tech": {
          _meta: {
            id: "./tech",
            isDirectory: true,
            parent: ".",
            basename: "tech",
            descendants: ["./tech/frontend", "./tech/frontend/post1"],
          },
        },
        "./tech/frontend": {
          _meta: {
            id: "./tech/frontend",
            isDirectory: true,
            parent: "./tech",
            basename: "frontend",
            descendants: ["./tech/frontend/post1"],
          },
        },
        "./tech/frontend/post1": {
          _meta: {
            id: "./tech/frontend/post1",
            isPost: true,
            parent: "./tech/frontend",
          },
        },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)

    assert.equal(result.length, 1)
    const techCategory = result[0]
    assert.equal(techCategory.name, "Tech")
    assert.equal(techCategory.count, 1) // Total descendants that are posts

    // Should have children
    assert.equal(techCategory.children.length, 1)
    const frontendSubcategory = techCategory.children[0]
    assert.equal(frontendSubcategory.name, "Frontend")
    assert.equal(frontendSubcategory.count, 1)
  })

  it("should handle custom parent option", () => {
    const context = {
      pages: {
        "./custom": {
          _meta: {
            id: "./custom",
            isDirectory: true,
            parent: "./parent",
            basename: "custom-category",
            descendants: [],
          },
        },
      },
    }

    const result = computeCategoriesDataView(
      context,
      { parent: "./parent" },
      config,
    )

    assert.equal(result.length, 1)
    assert.equal(result[0].name, "Custom Category")
    assert.equal(result[0].entry._meta.id, "./custom")
  })

  it("should count only post descendants", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./category": {
          _meta: {
            id: "./category",
            isDirectory: true,
            parent: ".",
            basename: "category",
            descendants: [
              "./category/post1",
              "./category/page1",
              "./category/index",
            ],
          },
        },
        "./category/post1": {
          _meta: { id: "./category/post1", isPost: true, parent: "./category" },
        },
        "./category/page1": {
          _meta: {
            id: "./category/page1",
            isPost: false,
            parent: "./category",
          },
        },
        "./category/index": {
          _meta: {
            id: "./category/index",
            isPost: false,
            parent: "./category",
          },
        },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)

    assert.equal(result.length, 1)
    assert.equal(result[0].count, 1) // Only the post should be counted
  })

  it("should handle directories with no posts", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./empty": {
          _meta: {
            id: "./empty",
            isDirectory: true,
            parent: ".",
            basename: "empty",
            descendants: [],
          },
        },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)

    assert.equal(result.length, 1)
    assert.equal(result[0].name, "Empty")
    assert.equal(result[0].count, 0)
  })

  it("should unslugify category names", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./web-development": {
          _meta: {
            id: "./web-development",
            isDirectory: true,
            parent: ".",
            basename: "web-development",
            descendants: [],
          },
        },
        "./ui-ux": {
          _meta: {
            id: "./ui-ux",
            isDirectory: true,
            parent: ".",
            basename: "ui-ux",
            descendants: [],
          },
        },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)

    assert.equal(result.length, 2)
    const names = result.map((cat) => cat.name).sort()
    assert.deepEqual(names, ["Ui Ux", "Web Development"])
  })

  it("should handle deep nesting", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./level1": {
          _meta: {
            id: "./level1",
            isDirectory: true,
            parent: ".",
            basename: "level1",
            descendants: [
              "./level1/level2",
              "./level1/level2/level3",
              "./level1/level2/level3/post",
            ],
          },
        },
        "./level1/level2": {
          _meta: {
            id: "./level1/level2",
            isDirectory: true,
            parent: "./level1",
            basename: "level2",
            descendants: [
              "./level1/level2/level3",
              "./level1/level2/level3/post",
            ],
          },
        },
        "./level1/level2/level3": {
          _meta: {
            id: "./level1/level2/level3",
            isDirectory: true,
            parent: "./level1/level2",
            basename: "level3",
            descendants: ["./level1/level2/level3/post"],
          },
        },
        "./level1/level2/level3/post": {
          _meta: {
            id: "./level1/level2/level3/post",
            isPost: true,
            parent: "./level1/level2/level3",
          },
        },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)

    assert.equal(result.length, 1)
    const level1 = result[0]
    assert.equal(level1.name, "Level1")
    assert.equal(level1.count, 1)

    assert.equal(level1.children.length, 1)
    const level2 = level1.children[0]
    assert.equal(level2.name, "Level2")
    assert.equal(level2.count, 1)

    assert.equal(level2.children.length, 1)
    const level3 = level2.children[0]
    assert.equal(level3.name, "Level3")
    assert.equal(level3.count, 1)
  })

  it("should handle mixed directory and file structure", () => {
    const context = {
      pages: {
        ".": { _meta: { id: ".", parent: null } },
        "./posts": {
          _meta: {
            id: "./posts",
            isDirectory: true,
            parent: ".",
            basename: "posts",
            descendants: [
              "./posts/post1",
              "./posts/tech",
              "./posts/tech/post2",
            ],
          },
        },
        "./posts/post1": {
          _meta: { id: "./posts/post1", isPost: true, parent: "./posts" },
        },
        "./posts/tech": {
          _meta: {
            id: "./posts/tech",
            isDirectory: true,
            parent: "./posts",
            basename: "tech",
            descendants: ["./posts/tech/post2"],
          },
        },
        "./posts/tech/post2": {
          _meta: {
            id: "./posts/tech/post2",
            isPost: true,
            parent: "./posts/tech",
          },
        },
      },
    }

    const result = computeCategoriesDataView(context, {}, config)

    assert.equal(result.length, 1)
    const postsCategory = result[0]
    assert.equal(postsCategory.name, "Posts")
    assert.equal(postsCategory.count, 2) // Both posts should be counted

    assert.equal(postsCategory.children.length, 1)
    const techSubcategory = postsCategory.children[0]
    assert.equal(techSubcategory.name, "Tech")
    assert.equal(techSubcategory.count, 1) // Only the tech post
  })
})

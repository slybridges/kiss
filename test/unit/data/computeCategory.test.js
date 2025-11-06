const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeCategory = require("../../../src/data/computeCategory")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("computeCategory", () => {
  let config
  let pages
  let context

  beforeEach(() => {
    config = createMockConfig()
    pages = {}
    context = { pages }
  })

  it("should return parent basename for pages with parent", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./blog",
        basename: "blog",
      },
    })
    pages["./blog"] = parentPage

    const page = createMockPage({
      _meta: {
        parent: "./blog",
      },
    })

    const result = computeCategory(page, config, context)
    assert.equal(result, "blog")
  })

  it("should remove index extension from parent basename", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./docs",
        basename: "index.md",
      },
    })
    pages["./docs"] = parentPage

    const page = createMockPage({
      _meta: {
        parent: "./docs",
      },
    })

    const result = computeCategory(page, config, context)
    assert.equal(result, "")
  })

  it("should handle various index extensions", () => {
    const testCases = [
      { basename: "index.html", expected: "" },
      { basename: "index.js", expected: "" },
      { basename: "index.json", expected: "" },
      { basename: "index.md", expected: "" },
    ]

    testCases.forEach(({ basename, expected }) => {
      const parentPage = createMockPage({
        _meta: {
          id: "./test",
          basename,
        },
      })
      pages["./test"] = parentPage

      const page = createMockPage({
        _meta: {
          parent: "./test",
        },
      })

      const result = computeCategory(page, config, context)
      assert.equal(result, expected)
    })
  })

  it("should return empty string for pages without parent", () => {
    const page = createMockPage({
      _meta: {
        parent: null,
      },
    })

    const result = computeCategory(page, config, context)
    assert.equal(result, "")
  })

  it("should handle nested categories", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./docs/api",
        basename: "api",
      },
    })
    pages["./docs/api"] = parentPage

    const page = createMockPage({
      _meta: {
        parent: "./docs/api",
      },
    })

    const result = computeCategory(page, config, context)
    assert.equal(result, "api")
  })

  it("should preserve parent basename without extension", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./tutorials",
        basename: "tutorials",
      },
    })
    pages["./tutorials"] = parentPage

    const page = createMockPage({
      _meta: {
        parent: "./tutorials",
      },
    })

    const result = computeCategory(page, config, context)
    assert.equal(result, "tutorials")
  })

  it("should handle parent with complex basename", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./my-category",
        basename: "my-category.test",
      },
    })
    pages["./my-category"] = parentPage

    const page = createMockPage({
      _meta: {
        parent: "./my-category",
      },
    })

    const result = computeCategory(page, config, context)
    assert.equal(result, "my-category.test")
  })

  it("should handle parent with empty basename", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./test",
        basename: "",
      },
    })
    pages["./test"] = parentPage

    const page = createMockPage({
      _meta: {
        parent: "./test",
      },
    })

    const result = computeCategory(page, config, context)
    assert.equal(result, "")
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeCategory.kissDependencies))
    assert(computeCategory.kissDependencies.includes("_meta.parent"))
  })
})

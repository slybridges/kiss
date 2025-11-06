const { describe, it } = require("node:test")
const assert = require("assert/strict")
const indexingIndex = require("../../../src/indexing")

describe("indexing/index", () => {
  it("should export buildPageIndexes function", () => {
    assert.ok(indexingIndex.buildPageIndexes)
    assert.equal(typeof indexingIndex.buildPageIndexes, "function")
  })

  it("should export all lookup helper functions", () => {
    const expectedHelpers = [
      "findInIndex",
      "findPageByPermalink",
      "findPageByInputPath",
      "findPageByIdAndLang",
      "findPageByDerivative",
      "findParentByPermalink",
      "findPageByInputSource",
    ]

    expectedHelpers.forEach((helperName) => {
      assert.ok(indexingIndex[helperName], `Should export ${helperName}`)
      assert.equal(
        typeof indexingIndex[helperName],
        "function",
        `${helperName} should be a function`,
      )
    })
  })

  it("should export correct number of functions", () => {
    const exportedKeys = Object.keys(indexingIndex)
    assert.equal(exportedKeys.length, 8) // 1 main function + 7 helper functions
  })

  it("should export functions with correct names", () => {
    const expectedExports = [
      "buildPageIndexes",
      "findInIndex",
      "findPageByPermalink",
      "findPageByInputPath",
      "findPageByIdAndLang",
      "findPageByDerivative",
      "findParentByPermalink",
      "findPageByInputSource",
    ]

    const actualExports = Object.keys(indexingIndex).sort()
    const sortedExpected = expectedExports.sort()

    assert.deepEqual(actualExports, sortedExpected)
  })

  it("should maintain compatibility with module architecture", () => {
    // Test that the main function works
    const pages = {
      "./test": {
        permalink: "/test/",
        _meta: { id: "./test" },
      },
    }

    const indexes = indexingIndex.buildPageIndexes(pages)
    assert.ok(indexes)
    assert.ok(indexes.byPermalink instanceof Map)

    // Test that helpers work with the built indexes
    const found = indexingIndex.findPageByPermalink(indexes, "/test/", pages)
    assert.equal(found, pages["./test"])
  })
})

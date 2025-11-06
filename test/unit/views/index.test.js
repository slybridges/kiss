const { describe, it } = require("node:test")
const assert = require("assert/strict")
const viewsIndex = require("../../../src/views")

describe("views/index", () => {
  it("should export all view functions", () => {
    assert.ok(viewsIndex.computeCategoriesDataView)
    assert.ok(viewsIndex.computeCollectionDataView)
    assert.ok(viewsIndex.computeIterableCollectionDataView)
    assert.ok(viewsIndex.computeSiteLastUpdatedDataView)

    assert.equal(typeof viewsIndex.computeCategoriesDataView, "function")
    assert.equal(typeof viewsIndex.computeCollectionDataView, "function")
    assert.equal(
      typeof viewsIndex.computeIterableCollectionDataView,
      "function",
    )
    assert.equal(typeof viewsIndex.computeSiteLastUpdatedDataView, "function")
  })

  it("should export correct number of functions", () => {
    const exportedKeys = Object.keys(viewsIndex)
    assert.equal(exportedKeys.length, 4)
  })

  it("should export functions with correct names", () => {
    const expectedExports = [
      "computeCategoriesDataView",
      "computeCollectionDataView",
      "computeIterableCollectionDataView",
      "computeSiteLastUpdatedDataView",
    ]

    const actualExports = Object.keys(viewsIndex).sort()
    const sortedExpected = expectedExports.sort()

    assert.deepEqual(actualExports, sortedExpected)
  })
})

const { describe, it } = require("node:test")
const assert = require("assert/strict")
const dataModule = require("../../../src/data")

describe("data module exports", () => {
  it("should export all computation functions", () => {
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeCategory"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeCreated"))
    assert(
      Object.prototype.hasOwnProperty.call(dataModule, "computeDescription"),
    )
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeImage"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeLayout"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeMeta"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeModified"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computePermalink"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeTitle"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "computeURL"))
    assert(Object.prototype.hasOwnProperty.call(dataModule, "initialPageData"))
  })

  it("should export correct function types", () => {
    assert.equal(typeof dataModule.computeCategory, "function")
    assert.equal(typeof dataModule.computeCreated, "function")
    assert.equal(typeof dataModule.computeDescription, "function")
    assert.equal(typeof dataModule.computeImage, "function")
    assert.equal(typeof dataModule.computeLayout, "function")
    assert.equal(typeof dataModule.computeMeta, "object")
    assert.equal(typeof dataModule.computeModified, "function")
    assert.equal(typeof dataModule.computePermalink, "function")
    assert.equal(typeof dataModule.computeTitle, "function")
    assert.equal(typeof dataModule.computeURL, "function")
    assert.equal(typeof dataModule.initialPageData, "object")
  })

  it("should export computeMeta sub-functions", () => {
    assert(
      Object.prototype.hasOwnProperty.call(
        dataModule.computeMeta,
        "computeAscendants",
      ),
    )
    assert(
      Object.prototype.hasOwnProperty.call(
        dataModule.computeMeta,
        "computeChildren",
      ),
    )
    assert(
      Object.prototype.hasOwnProperty.call(
        dataModule.computeMeta,
        "computeDescendants",
      ),
    )
    assert(
      Object.prototype.hasOwnProperty.call(
        dataModule.computeMeta,
        "computeIsCollection",
      ),
    )
    assert(
      Object.prototype.hasOwnProperty.call(
        dataModule.computeMeta,
        "computeIsPost",
      ),
    )
    assert(
      Object.prototype.hasOwnProperty.call(
        dataModule.computeMeta,
        "computeOutputPath",
      ),
    )

    assert.equal(typeof dataModule.computeMeta.computeAscendants, "function")
    assert.equal(typeof dataModule.computeMeta.computeChildren, "function")
    assert.equal(typeof dataModule.computeMeta.computeDescendants, "function")
    assert.equal(typeof dataModule.computeMeta.computeIsCollection, "function")
    assert.equal(typeof dataModule.computeMeta.computeIsPost, "function")
    assert.equal(typeof dataModule.computeMeta.computeOutputPath, "function")
  })

  it("should match individual module exports", () => {
    const computeCategory = require("../../../src/data/computeCategory")
    const computeCreated = require("../../../src/data/computeCreated")
    const computeDescription = require("../../../src/data/computeDescription")
    const computeImage = require("../../../src/data/computeImage")
    const computeLayout = require("../../../src/data/computeLayout")
    const computeMeta = require("../../../src/data/computeMeta")
    const computeModified = require("../../../src/data/computeModified")
    const computePermalink = require("../../../src/data/computePermalink")
    const computeTitle = require("../../../src/data/computeTitle")
    const computeURL = require("../../../src/data/computeURL")
    const initialPageData = require("../../../src/data/initialPageData")

    assert.equal(dataModule.computeCategory, computeCategory)
    assert.equal(dataModule.computeCreated, computeCreated)
    assert.equal(dataModule.computeDescription, computeDescription)
    assert.equal(dataModule.computeImage, computeImage)
    assert.equal(dataModule.computeLayout, computeLayout)
    assert.equal(dataModule.computeMeta, computeMeta)
    assert.equal(dataModule.computeModified, computeModified)
    assert.equal(dataModule.computePermalink, computePermalink)
    assert.equal(dataModule.computeTitle, computeTitle)
    assert.equal(dataModule.computeURL, computeURL)
    assert.equal(dataModule.initialPageData, initialPageData)
  })
})

const { describe, it } = require("node:test")
const assert = require("assert/strict")
const initialPageData = require("../../../src/data/initialPageData")

describe("initialPageData", () => {
  it("should have all expected properties", () => {
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "author"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "category"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "cover"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "created"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "description"))
    assert(
      Object.prototype.hasOwnProperty.call(
        initialPageData,
        "excludeFromCollection",
      ),
    )
    assert(
      Object.prototype.hasOwnProperty.call(
        initialPageData,
        "excludeFromSitemap",
      ),
    )
    assert(
      Object.prototype.hasOwnProperty.call(initialPageData, "excludeFromWrite"),
    )
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "image"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "layout"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "modified"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "permalink"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "slug"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "title"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "url"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "_meta"))
    assert(Object.prototype.hasOwnProperty.call(initialPageData, "_html"))
  })

  it("should have correct default values", () => {
    assert.deepEqual(initialPageData.author, {
      name: null,
      email: null,
      uri: null,
    })
    assert.equal(initialPageData.cover, null)
    assert.equal(initialPageData.excludeFromCollection, false)
    assert.equal(initialPageData.excludeFromSitemap, false)
    assert.equal(initialPageData.excludeFromWrite, false)
    assert.equal(initialPageData.slug, null)
    assert.equal(initialPageData._html, null)
  })

  it("should have computation functions for dynamic fields", () => {
    assert.equal(typeof initialPageData.category, "function")
    assert.equal(typeof initialPageData.created, "function")
    assert.equal(typeof initialPageData.description, "function")
    assert.equal(typeof initialPageData.image, "function")
    assert.equal(typeof initialPageData.layout, "function")
    assert.equal(typeof initialPageData.modified, "function")
    assert.equal(typeof initialPageData.permalink, "function")
    assert.equal(typeof initialPageData.title, "function")
    assert.equal(typeof initialPageData.url, "function")
  })

  it("should have correct _meta structure", () => {
    const meta = initialPageData._meta

    assert(Object.prototype.hasOwnProperty.call(meta, "ascendants"))
    assert(Object.prototype.hasOwnProperty.call(meta, "id"))
    assert(Object.prototype.hasOwnProperty.call(meta, "basename"))
    assert(Object.prototype.hasOwnProperty.call(meta, "children"))
    assert(Object.prototype.hasOwnProperty.call(meta, "descendants"))
    assert(Object.prototype.hasOwnProperty.call(meta, "fileCreated"))
    assert(Object.prototype.hasOwnProperty.call(meta, "fileModified"))
    assert(Object.prototype.hasOwnProperty.call(meta, "inputPath"))
    assert(Object.prototype.hasOwnProperty.call(meta, "inputSources"))
    assert(Object.prototype.hasOwnProperty.call(meta, "isCollection"))
    assert(Object.prototype.hasOwnProperty.call(meta, "isDirectory"))
    assert(Object.prototype.hasOwnProperty.call(meta, "isPost"))
    assert(Object.prototype.hasOwnProperty.call(meta, "outputPath"))
    assert(Object.prototype.hasOwnProperty.call(meta, "parent"))
    assert(Object.prototype.hasOwnProperty.call(meta, "outputType"))
  })

  it("should have correct _meta default values", () => {
    const meta = initialPageData._meta

    assert.equal(meta.id, "")
    assert.equal(meta.basename, "")
    assert.equal(meta.fileCreated, null)
    assert.equal(meta.fileModified, null)
    assert.equal(meta.inputPath, "")
    assert.deepEqual(meta.inputSources, [])
    assert.equal(meta.isDirectory, false)
    assert.equal(meta.parent, null)
    assert.equal(meta.outputType, null)
  })

  it("should have computation functions for _meta dynamic fields", () => {
    const meta = initialPageData._meta

    assert.equal(typeof meta.ascendants, "function")
    assert.equal(typeof meta.children, "function")
    assert.equal(typeof meta.descendants, "function")
    assert.equal(typeof meta.isCollection, "function")
    assert.equal(typeof meta.isPost, "function")
    assert.equal(typeof meta.outputPath, "function")
  })

  it("should import correct computation functions", () => {
    const computeCategory = require("../../../src/data/computeCategory")
    const computeCreated = require("../../../src/data/computeCreated")
    const computeDescription = require("../../../src/data/computeDescription")
    const computeImage = require("../../../src/data/computeImage")
    const computeLayout = require("../../../src/data/computeLayout")
    const computeModified = require("../../../src/data/computeModified")
    const computePermalink = require("../../../src/data/computePermalink")
    const computeTitle = require("../../../src/data/computeTitle")
    const computeURL = require("../../../src/data/computeURL")
    const {
      computeAscendants,
      computeChildren,
      computeDescendants,
      computeIsCollection,
      computeIsPost,
      computeOutputPath,
    } = require("../../../src/data/computeMeta")

    assert.equal(initialPageData.category, computeCategory)
    assert.equal(initialPageData.created, computeCreated)
    assert.equal(initialPageData.description, computeDescription)
    assert.equal(initialPageData.image, computeImage)
    assert.equal(initialPageData.layout, computeLayout)
    assert.equal(initialPageData.modified, computeModified)
    assert.equal(initialPageData.permalink, computePermalink)
    assert.equal(initialPageData.title, computeTitle)
    assert.equal(initialPageData.url, computeURL)

    assert.equal(initialPageData._meta.ascendants, computeAscendants)
    assert.equal(initialPageData._meta.children, computeChildren)
    assert.equal(initialPageData._meta.descendants, computeDescendants)
    assert.equal(initialPageData._meta.isCollection, computeIsCollection)
    assert.equal(initialPageData._meta.isPost, computeIsPost)
    assert.equal(initialPageData._meta.outputPath, computeOutputPath)
  })
})

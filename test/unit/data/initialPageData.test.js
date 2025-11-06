const { describe, it } = require("node:test")
const assert = require("assert/strict")
const initialPageData = require("../../../src/data/initialPageData")

describe("initialPageData", () => {
  it("should have all expected properties", () => {
    assert(initialPageData.hasOwnProperty("author"))
    assert(initialPageData.hasOwnProperty("category"))
    assert(initialPageData.hasOwnProperty("cover"))
    assert(initialPageData.hasOwnProperty("created"))
    assert(initialPageData.hasOwnProperty("description"))
    assert(initialPageData.hasOwnProperty("excludeFromCollection"))
    assert(initialPageData.hasOwnProperty("excludeFromSitemap"))
    assert(initialPageData.hasOwnProperty("excludeFromWrite"))
    assert(initialPageData.hasOwnProperty("image"))
    assert(initialPageData.hasOwnProperty("layout"))
    assert(initialPageData.hasOwnProperty("modified"))
    assert(initialPageData.hasOwnProperty("permalink"))
    assert(initialPageData.hasOwnProperty("slug"))
    assert(initialPageData.hasOwnProperty("title"))
    assert(initialPageData.hasOwnProperty("url"))
    assert(initialPageData.hasOwnProperty("_meta"))
    assert(initialPageData.hasOwnProperty("_html"))
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

    assert(meta.hasOwnProperty("ascendants"))
    assert(meta.hasOwnProperty("id"))
    assert(meta.hasOwnProperty("basename"))
    assert(meta.hasOwnProperty("children"))
    assert(meta.hasOwnProperty("descendants"))
    assert(meta.hasOwnProperty("fileCreated"))
    assert(meta.hasOwnProperty("fileModified"))
    assert(meta.hasOwnProperty("inputPath"))
    assert(meta.hasOwnProperty("inputSources"))
    assert(meta.hasOwnProperty("isCollection"))
    assert(meta.hasOwnProperty("isDirectory"))
    assert(meta.hasOwnProperty("isPost"))
    assert(meta.hasOwnProperty("outputPath"))
    assert(meta.hasOwnProperty("parent"))
    assert(meta.hasOwnProperty("outputType"))
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

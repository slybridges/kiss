const { describe, it } = require("node:test")
const assert = require("assert/strict")
const writersIndex = require("../../../src/writers")

describe("writers/index", () => {
  it("should export all writer functions", () => {
    assert.ok(writersIndex.htmlWriter)
    assert.ok(writersIndex.imageWriter)
    assert.ok(writersIndex.jsonContextWriter)
    assert.ok(writersIndex.rssContextWriter)
    assert.ok(writersIndex.sitemapContextWriter)
    assert.ok(writersIndex.staticWriter)

    assert.equal(typeof writersIndex.htmlWriter, "function")
    assert.equal(typeof writersIndex.imageWriter, "function")
    assert.equal(typeof writersIndex.jsonContextWriter, "function")
    assert.equal(typeof writersIndex.rssContextWriter, "function")
    assert.equal(typeof writersIndex.sitemapContextWriter, "function")
    assert.equal(typeof writersIndex.staticWriter, "function")
  })

  it("should export correct number of writers", () => {
    const exportedKeys = Object.keys(writersIndex)
    assert.equal(exportedKeys.length, 6)
  })

  it("should export writers with correct names", () => {
    const expectedExports = [
      "htmlWriter",
      "imageWriter",
      "jsonContextWriter",
      "rssContextWriter",
      "sitemapContextWriter",
      "staticWriter",
    ]

    const actualExports = Object.keys(writersIndex).sort()
    const sortedExpected = expectedExports.sort()

    assert.deepEqual(actualExports, sortedExpected)
  })
})

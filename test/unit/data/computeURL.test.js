const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeURL = require("../../../src/data/computeURL")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeURL", () => {
  let config
  let context

  beforeEach(() => {
    config = createMockConfig()
    context = {
      site: {
        url: "https://example.com",
      },
    }
  })

  it("should return null if no permalink", () => {
    const result = computeURL({}, config, context)
    assert.equal(result, null)
  })

  it("should return permalink if no site.url", () => {
    context.site.url = null
    const result = computeURL({ permalink: "/about" }, config, context)
    assert.equal(result, "/about")
  })

  it("should return absolute URL with site.url", () => {
    const result = computeURL({ permalink: "/about" }, config, context)
    assert.equal(result, "https://example.com/about")
  })

  it("should handle root permalink", () => {
    const result = computeURL({ permalink: "/" }, config, context)
    assert.equal(result, "https://example.com/")
  })

  it("should handle nested paths", () => {
    const result = computeURL({ permalink: "/blog/post-1" }, config, context)
    assert.equal(result, "https://example.com/blog/post-1")
  })

  it("should handle trailing slashes", () => {
    const result = computeURL({ permalink: "/blog/" }, config, context)
    assert.equal(result, "https://example.com/blog/")
  })

  it("should handle site.url with trailing slash", () => {
    context.site.url = "https://example.com/"
    const result = computeURL({ permalink: "/about" }, config, context)
    assert.equal(result, "https://example.com/about")
  })

  it("should handle site.url with path", () => {
    context.site.url = "https://example.com/subsite"
    const result = computeURL({ permalink: "/about" }, config, context)
    assert.equal(result, "https://example.com/about")
  })

  it("should handle empty permalink", () => {
    const result = computeURL({ permalink: "" }, config, context)
    assert.equal(result, null)
  })

  it("should handle undefined site object", () => {
    context = {}
    const result = computeURL({ permalink: "/about" }, config, context)
    assert.equal(result, "/about")
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeURL.kissDependencies))
    assert(computeURL.kissDependencies.includes("permalink"))
  })
})

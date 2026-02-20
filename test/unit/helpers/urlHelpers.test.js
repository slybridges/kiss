const { describe, it } = require("node:test")
const assert = require("assert/strict")
const { getAbsoluteURL, isValidURL } = require("../../../src/helpers")

describe("isValidURL", () => {
  it("should return true for valid URLs", () => {
    assert.equal(isValidURL("https://example.com"), true)
    assert.equal(isValidURL("http://localhost:3000"), true)
    assert.equal(isValidURL("https://example.com/path"), true)
    assert.equal(isValidURL("ftp://example.com"), true)
    assert.equal(isValidURL("file:///path/to/file"), true)
    assert.equal(isValidURL("mailto:test@example.com"), true)
    assert.equal(isValidURL("tel:+1234567890"), true)
  })

  it("should return false for invalid URLs", () => {
    assert.equal(isValidURL("/path/to/page"), false)
    assert.equal(isValidURL("relative/path"), false)
    assert.equal(isValidURL(""), false)
    assert.equal(isValidURL("not a url"), false)
  })

  it("should return false for non-string inputs", () => {
    assert.equal(isValidURL(null), false)
    assert.equal(isValidURL(undefined), false)
    assert.equal(isValidURL(123), false)
    assert.equal(isValidURL({}), false)
  })
})

describe("getAbsoluteURL", () => {
  const baseURL = "https://example.com"

  it("should return already absolute URLs unchanged", () => {
    const url = "https://other.com/page"
    assert.equal(getAbsoluteURL(url, baseURL), url)
  })

  it("should handle relative paths", () => {
    assert.equal(getAbsoluteURL("/page", baseURL), "https://example.com/page")
    assert.equal(
      getAbsoluteURL("/blog/post", baseURL),
      "https://example.com/blog/post",
    )
    assert.equal(
      getAbsoluteURL("page.html", baseURL),
      "https://example.com/page.html",
    )
  })

  it("should handle paths with subdirectories", () => {
    const baseWithPath = "https://example.com/subdir/"
    assert.equal(
      getAbsoluteURL("page.html", baseWithPath),
      "https://example.com/subdir/page.html",
    )
    assert.equal(
      getAbsoluteURL("../other.html", baseWithPath),
      "https://example.com/other.html",
    )
  })

  it("should not modify special prefixes", () => {
    assert.equal(getAbsoluteURL("#anchor", baseURL), "#anchor")
    assert.equal(
      getAbsoluteURL("mailto:test@example.com", baseURL),
      "mailto:test@example.com",
    )
    assert.equal(getAbsoluteURL("tel:+1234567890", baseURL), "tel:+1234567890")
  })

  it("should handle empty URL", () => {
    assert.equal(getAbsoluteURL("", baseURL), "https://example.com/")
  })

  it("should throw error for invalid baseURL", () => {
    assert.throws(() => {
      getAbsoluteURL("/page", "not-a-url")
    }, /baseURL but be a valid URL/)
  })

  it("should handle query strings and fragments", () => {
    assert.equal(
      getAbsoluteURL("/page?query=1", baseURL),
      "https://example.com/page?query=1",
    )
    assert.equal(
      getAbsoluteURL("/page#section", baseURL),
      "https://example.com/page#section",
    )
  })
})

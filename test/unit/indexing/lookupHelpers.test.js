const { describe, it } = require("node:test")
const assert = require("assert/strict")
const {
  findInIndex,
  findPageByPermalink,
  findPageByInputPath,
  findPageByIdAndLang,
  findPageByDerivative,
  findParentByPermalink,
  findPageByInputSource,
} = require("../../../src/indexing/lookupHelpers")

describe("lookupHelpers", () => {
  describe("findInIndex", () => {
    it("should find item using index when available", () => {
      const indexes = {
        testIndex: new Map([
          ["key1", "value1"],
          ["key2", "value2"],
        ]),
      }

      const result = findInIndex(indexes, "testIndex", "key1")
      assert.equal(result, "value1")
    })

    it("should return null when item not found in index and no fallback", () => {
      const indexes = {
        testIndex: new Map([["key1", "value1"]]),
      }

      const result = findInIndex(indexes, "testIndex", "nonexistent")
      assert.equal(result, null)
    })

    it("should use fallback function when item not found in index", () => {
      const indexes = {
        testIndex: new Map([["key1", "value1"]]),
      }

      const fallback = () => "fallback-result"
      const result = findInIndex(indexes, "testIndex", "nonexistent", fallback)
      assert.equal(result, "fallback-result")
    })

    it("should use fallback when indexes is null", () => {
      const fallback = () => "fallback-result"
      const result = findInIndex(null, "testIndex", "key1", fallback)
      assert.equal(result, "fallback-result")
    })

    it("should use fallback when specific index doesn't exist", () => {
      const indexes = {
        otherIndex: new Map([["key1", "value1"]]),
      }

      const fallback = () => "fallback-result"
      const result = findInIndex(indexes, "nonexistentIndex", "key1", fallback)
      assert.equal(result, "fallback-result")
    })

    it("should return null when no indexes and no fallback", () => {
      const result = findInIndex(null, "testIndex", "key1")
      assert.equal(result, null)
    })
  })

  describe("findPageByPermalink", () => {
    const mockPages = {
      "./index": { permalink: "/", _meta: { id: "./index" } },
      "./about": { permalink: "/about/", _meta: { id: "./about" } },
      "./contact": { permalink: "/contact/", _meta: { id: "./contact" } },
    }

    it("should find page using index when available", () => {
      const indexes = {
        byPermalink: new Map([
          ["/", mockPages["./index"]],
          ["/about/", mockPages["./about"]],
        ]),
      }

      const result = findPageByPermalink(indexes, "/about/", mockPages)
      assert.equal(result, mockPages["./about"])
    })

    it("should fallback to O(n) search when index unavailable", () => {
      const result = findPageByPermalink(null, "/contact/", mockPages)
      assert.equal(result, mockPages["./contact"])
    })

    it("should fallback when permalink not in index", () => {
      const indexes = {
        byPermalink: new Map([["/", mockPages["./index"]]]),
      }

      const result = findPageByPermalink(indexes, "/about/", mockPages)
      assert.equal(result, mockPages["./about"])
    })

    it("should return null when page not found", () => {
      const indexes = {
        byPermalink: new Map(),
      }

      const result = findPageByPermalink(indexes, "/nonexistent/", mockPages)
      assert.equal(result, null)
    })
  })

  describe("findPageByInputPath", () => {
    const mockPages = {
      "./index": {
        _meta: { id: "./index", inputPath: "content/index.md" },
      },
      "./about": {
        _meta: { id: "./about", inputPath: "content/about.html" },
      },
    }

    it("should find page using index when available", () => {
      const indexes = {
        byInputPath: new Map([
          ["content/index.md", mockPages["./index"]],
          ["content/about.html", mockPages["./about"]],
        ]),
      }

      const result = findPageByInputPath(
        indexes,
        "content/about.html",
        mockPages,
      )
      assert.equal(result, mockPages["./about"])
    })

    it("should fallback to O(n) search when index unavailable", () => {
      const result = findPageByInputPath(null, "content/index.md", mockPages)
      assert.equal(result, mockPages["./index"])
    })

    it("should return null when page not found", () => {
      const indexes = {
        byInputPath: new Map(),
      }

      const result = findPageByInputPath(indexes, "nonexistent.md", mockPages)
      assert.equal(result, null)
    })
  })

  describe("findPageByIdAndLang", () => {
    const mockPages = {
      "./index-en": { id: "index", lang: "en", _meta: { id: "./index-en" } },
      "./index-fr": { id: "index", lang: "fr", _meta: { id: "./index-fr" } },
      "./about-en": { id: "about", lang: "en", _meta: { id: "./about-en" } },
    }

    it("should find page using index when available", () => {
      const indexes = {
        byIdAndLang: new Map([
          ["index:en", mockPages["./index-en"]],
          ["index:fr", mockPages["./index-fr"]],
          ["about:en", mockPages["./about-en"]],
        ]),
      }

      const result = findPageByIdAndLang(indexes, "index", "fr", mockPages)
      assert.equal(result, mockPages["./index-fr"])
    })

    it("should fallback to O(n) search when index unavailable", () => {
      const result = findPageByIdAndLang(null, "about", "en", mockPages)
      assert.equal(result, mockPages["./about-en"])
    })

    it("should return null when page not found", () => {
      const indexes = {
        byIdAndLang: new Map(),
      }

      const result = findPageByIdAndLang(
        indexes,
        "nonexistent",
        "en",
        mockPages,
      )
      assert.equal(result, null)
    })
  })

  describe("findPageByDerivative", () => {
    const mockPages = {
      "./image1": {
        derivatives: [
          { permalink: "/images/photo-400w.webp" },
          { permalink: "/images/photo-800w.webp" },
        ],
        _meta: { id: "./image1" },
      },
      "./image2": {
        derivatives: [{ permalink: "/images/banner.jpg" }],
        _meta: { id: "./image2" },
      },
    }

    it("should find page using index when available", () => {
      const indexes = {
        byDerivative: new Map([
          ["/images/photo-400w.webp", mockPages["./image1"]],
          ["/images/photo-800w.webp", mockPages["./image1"]],
          ["/images/banner.jpg", mockPages["./image2"]],
        ]),
      }

      const result = findPageByDerivative(
        indexes,
        "/images/photo-800w.webp",
        mockPages,
      )
      assert.equal(result, mockPages["./image1"])
    })

    it("should fallback to O(n) search when index unavailable", () => {
      const result = findPageByDerivative(null, "/images/banner.jpg", mockPages)
      assert.equal(result, mockPages["./image2"])
    })

    it("should return null when derivative not found", () => {
      const indexes = {
        byDerivative: new Map(),
      }

      const result = findPageByDerivative(
        indexes,
        "/images/nonexistent.jpg",
        mockPages,
      )
      assert.equal(result, null)
    })
  })

  describe("findParentByPermalink", () => {
    const mockPages = {
      "./": { permalink: "/", _meta: { id: "./" } },
      "./posts": { permalink: "/posts/", _meta: { id: "./posts" } },
      "./about": { permalink: "/about/", _meta: { id: "./about" } },
    }

    it("should find parent using index when available", () => {
      const indexes = {
        byParentPermalink: new Map([
          ["/", mockPages["./"]],
          ["/posts/", mockPages["./posts"]],
          ["/about/", mockPages["./about"]],
        ]),
      }

      const result = findParentByPermalink(indexes, "/posts/", mockPages)
      assert.equal(result, mockPages["./posts"])
    })

    it("should fallback to O(n) search when index unavailable", () => {
      const result = findParentByPermalink(null, "/about/", mockPages)
      assert.equal(result, mockPages["./about"])
    })

    it("should return null when parent not found", () => {
      const indexes = {
        byParentPermalink: new Map(),
      }

      const result = findParentByPermalink(indexes, "/nonexistent/", mockPages)
      assert.equal(result, null)
    })
  })

  describe("findPageByInputSource", () => {
    const mockPages = {
      "./page1": {
        _meta: {
          id: "./page1",
          inputSources: [
            { path: "content/page1.md" },
            { path: "content/data/page1.json" },
          ],
        },
      },
      "./page2": {
        _meta: {
          id: "./page2",
          inputSources: [{ path: "content/page2.html" }],
        },
      },
    }

    it("should find page using index when available", () => {
      const indexes = {
        byInputSource: new Map([
          ["content/page1.md", mockPages["./page1"]],
          ["content/data/page1.json", mockPages["./page1"]],
          ["content/page2.html", mockPages["./page2"]],
        ]),
      }

      const result = findPageByInputSource(
        indexes,
        "content/data/page1.json",
        mockPages,
      )
      assert.equal(result, mockPages["./page1"])
    })

    it("should fallback to O(n) search when index unavailable", () => {
      const result = findPageByInputSource(
        null,
        "content/page2.html",
        mockPages,
      )
      assert.equal(result, mockPages["./page2"])
    })

    it("should return null when source not found", () => {
      const indexes = {
        byInputSource: new Map(),
      }

      const result = findPageByInputSource(indexes, "nonexistent.md", mockPages)
      assert.equal(result, null)
    })
  })

  describe("integration scenarios", () => {
    it("should handle complex lookup scenarios", () => {
      const mockPages = {
        "./index-en": {
          id: "index",
          lang: "en",
          permalink: "/",
          derivatives: [{ permalink: "/images/hero-en.webp" }],
          _meta: {
            id: "./index-en",
            inputPath: "content/index.en.md",
            inputSources: [
              { path: "content/index.en.md" },
              { path: "content/data/site.en.json" },
            ],
          },
        },
      }

      const indexes = {
        byPermalink: new Map([["/", mockPages["./index-en"]]]),
        byInputPath: new Map([
          ["content/index.en.md", mockPages["./index-en"]],
        ]),
        byIdAndLang: new Map([["index:en", mockPages["./index-en"]]]),
        byDerivative: new Map([
          ["/images/hero-en.webp", mockPages["./index-en"]],
        ]),
        byParentPermalink: new Map([["/", mockPages["./index-en"]]]),
        byInputSource: new Map([
          ["content/index.en.md", mockPages["./index-en"]],
          ["content/data/site.en.json", mockPages["./index-en"]],
        ]),
      }

      // All lookup methods should find the same page
      assert.equal(
        findPageByPermalink(indexes, "/", mockPages),
        mockPages["./index-en"],
      )
      assert.equal(
        findPageByInputPath(indexes, "content/index.en.md", mockPages),
        mockPages["./index-en"],
      )
      assert.equal(
        findPageByIdAndLang(indexes, "index", "en", mockPages),
        mockPages["./index-en"],
      )
      assert.equal(
        findPageByDerivative(indexes, "/images/hero-en.webp", mockPages),
        mockPages["./index-en"],
      )
      assert.equal(
        findParentByPermalink(indexes, "/", mockPages),
        mockPages["./index-en"],
      )
      assert.equal(
        findPageByInputSource(indexes, "content/data/site.en.json", mockPages),
        mockPages["./index-en"],
      )
    })

    it("should handle missing indexes gracefully", () => {
      const mockPages = {
        "./test": { permalink: "/test/", _meta: { id: "./test" } },
      }

      // Test with completely missing indexes
      assert.equal(
        findPageByPermalink(undefined, "/test/", mockPages),
        mockPages["./test"],
      )
      assert.equal(findPageByInputPath({}, "path.md", mockPages), null)

      // Test with partial indexes
      const partialIndexes = {
        byPermalink: new Map(),
        // Missing other indexes
      }

      assert.equal(
        findPageByPermalink(partialIndexes, "/nonexistent/", mockPages),
        null,
      )
      assert.equal(
        findPageByInputPath(partialIndexes, "path.md", mockPages),
        null,
      )
    })
  })
})

const { describe, it } = require("node:test")
const assert = require("assert/strict")
const buildPageIndexes = require("../../../src/indexing/buildPageIndexes")

describe("buildPageIndexes", () => {
  it("should create empty indexes for empty pages object", () => {
    const pages = {}
    const indexes = buildPageIndexes(pages)

    assert.ok(indexes.byPermalink instanceof Map)
    assert.ok(indexes.byInputPath instanceof Map)
    assert.ok(indexes.byIdAndLang instanceof Map)
    assert.ok(indexes.byDerivative instanceof Map)
    assert.ok(indexes.byParentPermalink instanceof Map)
    assert.ok(indexes.byInputSource instanceof Map)

    assert.equal(indexes.byPermalink.size, 0)
    assert.equal(indexes.byInputPath.size, 0)
    assert.equal(indexes.byIdAndLang.size, 0)
    assert.equal(indexes.byDerivative.size, 0)
    assert.equal(indexes.byParentPermalink.size, 0)
    assert.equal(indexes.byInputSource.size, 0)
  })

  it("should index pages by permalink", () => {
    const pages = {
      "./index": {
        permalink: "/",
        _meta: { id: "./index" },
      },
      "./about": {
        permalink: "/about/",
        _meta: { id: "./about" },
      },
      "./posts/first": {
        permalink: "/posts/first/",
        _meta: { id: "./posts/first" },
      },
    }

    const indexes = buildPageIndexes(pages)

    assert.equal(indexes.byPermalink.get("/"), pages["./index"])
    assert.equal(indexes.byPermalink.get("/about/"), pages["./about"])
    assert.equal(
      indexes.byPermalink.get("/posts/first/"),
      pages["./posts/first"],
    )
    assert.equal(indexes.byPermalink.size, 3)
  })

  it("should index pages by input path", () => {
    const pages = {
      "./index": {
        _meta: {
          id: "./index",
          inputPath: "content/index.md",
        },
      },
      "./about": {
        _meta: {
          id: "./about",
          inputPath: "content/about.html",
        },
      },
    }

    const indexes = buildPageIndexes(pages)

    assert.equal(indexes.byInputPath.get("content/index.md"), pages["./index"])
    assert.equal(
      indexes.byInputPath.get("content/about.html"),
      pages["./about"],
    )
    assert.equal(indexes.byInputPath.size, 2)
  })

  it("should index pages by ID and language", () => {
    const pages = {
      "./index-en": {
        id: "index",
        lang: "en",
        _meta: { id: "./index-en" },
      },
      "./index-fr": {
        id: "index",
        lang: "fr",
        _meta: { id: "./index-fr" },
      },
      "./about-en": {
        id: "about",
        lang: "en",
        _meta: { id: "./about-en" },
      },
    }

    const indexes = buildPageIndexes(pages)

    assert.equal(indexes.byIdAndLang.get("index:en"), pages["./index-en"])
    assert.equal(indexes.byIdAndLang.get("index:fr"), pages["./index-fr"])
    assert.equal(indexes.byIdAndLang.get("about:en"), pages["./about-en"])
    assert.equal(indexes.byIdAndLang.size, 3)
  })

  it("should index parent permalinks for directories", () => {
    const pages = {
      "./": {
        permalink: "/",
        _meta: { id: "./" },
      },
      "./posts": {
        permalink: "/posts/",
        _meta: { id: "./posts" },
      },
      "./posts/tech": {
        permalink: "/posts/tech/",
        _meta: { id: "./posts/tech" },
      },
      "./about": {
        permalink: "/about/", // Directory-like permalink
        _meta: { id: "./about" },
      },
      "./single": {
        permalink: "/single", // Non-directory permalink
        _meta: { id: "./single" },
      },
    }

    const indexes = buildPageIndexes(pages)

    // Should index directory-like permalinks (ending with /)
    assert.equal(indexes.byParentPermalink.get("/"), pages["./"])
    assert.equal(indexes.byParentPermalink.get("/posts/"), pages["./posts"])
    assert.equal(
      indexes.byParentPermalink.get("/posts/tech/"),
      pages["./posts/tech"],
    )
    assert.equal(indexes.byParentPermalink.get("/about/"), pages["./about"])

    // Should not index non-directory permalinks
    assert.equal(indexes.byParentPermalink.get("/single"), undefined)

    assert.equal(indexes.byParentPermalink.size, 4)
  })

  it("should index image derivatives", () => {
    const pages = {
      "./image1": {
        derivatives: [
          { permalink: "/images/photo-400w.webp" },
          { permalink: "/images/photo-800w.webp" },
        ],
        _meta: { id: "./image1" },
      },
      "./image2": {
        derivatives: [
          { permalink: "/images/banner-lg.jpg" },
          { permalink: "/images/banner-sm.jpg" },
        ],
        _meta: { id: "./image2" },
      },
    }

    const indexes = buildPageIndexes(pages)

    assert.equal(
      indexes.byDerivative.get("/images/photo-400w.webp"),
      pages["./image1"],
    )
    assert.equal(
      indexes.byDerivative.get("/images/photo-800w.webp"),
      pages["./image1"],
    )
    assert.equal(
      indexes.byDerivative.get("/images/banner-lg.jpg"),
      pages["./image2"],
    )
    assert.equal(
      indexes.byDerivative.get("/images/banner-sm.jpg"),
      pages["./image2"],
    )
    assert.equal(indexes.byDerivative.size, 4)
  })

  it("should index input sources", () => {
    const pages = {
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

    const indexes = buildPageIndexes(pages)

    assert.equal(
      indexes.byInputSource.get("content/page1.md"),
      pages["./page1"],
    )
    assert.equal(
      indexes.byInputSource.get("content/data/page1.json"),
      pages["./page1"],
    )
    assert.equal(
      indexes.byInputSource.get("content/page2.html"),
      pages["./page2"],
    )
    assert.equal(indexes.byInputSource.size, 3)
  })

  it("should handle pages with missing optional fields", () => {
    const pages = {
      "./minimal": {
        title: "Minimal Page",
        _meta: { id: "./minimal" },
        // Missing: permalink, inputPath, id, lang, derivatives, inputSources
      },
      "./partial": {
        permalink: "/partial/",
        id: "partial",
        // Missing lang, so no ID+lang index entry should be created
        _meta: {
          id: "./partial",
          inputPath: "content/partial.md",
          // Missing inputSources
        },
        // Missing derivatives
      },
    }

    const indexes = buildPageIndexes(pages)

    // Should index available fields
    assert.equal(indexes.byPermalink.get("/partial/"), pages["./partial"])
    assert.equal(
      indexes.byInputPath.get("content/partial.md"),
      pages["./partial"],
    )
    assert.equal(indexes.byParentPermalink.get("/partial/"), pages["./partial"])

    // Should not create entries for missing fields
    assert.equal(indexes.byPermalink.get(undefined), undefined)
    assert.equal(indexes.byIdAndLang.get("partial:undefined"), undefined)

    // Total sizes should reflect only valid entries
    assert.equal(indexes.byPermalink.size, 1)
    assert.equal(indexes.byInputPath.size, 1)
    assert.equal(indexes.byIdAndLang.size, 0)
    assert.equal(indexes.byDerivative.size, 0)
    assert.equal(indexes.byParentPermalink.size, 1)
    assert.equal(indexes.byInputSource.size, 0)
  })

  it("should handle complex real-world scenario", () => {
    const pages = {
      "./": {
        permalink: "/",
        id: "home",
        lang: "en",
        _meta: {
          id: "./",
          inputPath: "content/index.md",
          inputSources: [
            { path: "content/index.md" },
            { path: "content/data/site.json" },
          ],
        },
      },
      "./posts": {
        permalink: "/posts/",
        id: "posts",
        lang: "en",
        _meta: {
          id: "./posts",
          inputPath: "content/posts/index.md",
          inputSources: [{ path: "content/posts/index.md" }],
        },
      },
      "./posts/first-post": {
        permalink: "/posts/first-post/",
        id: "first-post",
        lang: "en",
        _meta: {
          id: "./posts/first-post",
          inputPath: "content/posts/first-post.md",
          inputSources: [{ path: "content/posts/first-post.md" }],
        },
      },
      "./images/hero": {
        derivatives: [
          { permalink: "/images/hero-400w.webp" },
          { permalink: "/images/hero-800w.webp" },
          { permalink: "/images/hero-1200w.jpg" },
        ],
        _meta: {
          id: "./images/hero",
          inputPath: "content/images/hero.jpg",
          inputSources: [{ path: "content/images/hero.jpg" }],
        },
      },
    }

    const indexes = buildPageIndexes(pages)

    // Verify all index types are populated correctly
    assert.equal(indexes.byPermalink.size, 3) // 3 pages with permalinks
    assert.equal(indexes.byInputPath.size, 4) // 4 pages with input paths
    assert.equal(indexes.byIdAndLang.size, 3) // 3 pages with id and lang
    assert.equal(indexes.byDerivative.size, 3) // 3 image derivatives
    assert.equal(indexes.byParentPermalink.size, 3) // 3 directory-like permalinks (all end with /)
    assert.equal(indexes.byInputSource.size, 5) // 5 input sources total

    // Spot check some specific entries
    assert.equal(indexes.byPermalink.get("/"), pages["./"])
    assert.equal(
      indexes.byIdAndLang.get("first-post:en"),
      pages["./posts/first-post"],
    )
    assert.equal(
      indexes.byDerivative.get("/images/hero-800w.webp"),
      pages["./images/hero"],
    )
    assert.equal(
      indexes.byInputSource.get("content/data/site.json"),
      pages["./"],
    )
  })

  it("should handle derivatives without permalinks", () => {
    const pages = {
      "./image": {
        derivatives: [
          { permalink: "/images/valid.webp" },
          { outputPath: "/public/images/no-permalink.jpg" }, // No permalink
          {}, // Empty derivative
        ],
        _meta: { id: "./image" },
      },
    }

    const indexes = buildPageIndexes(pages)

    // Only derivatives with permalinks should be indexed
    assert.equal(
      indexes.byDerivative.get("/images/valid.webp"),
      pages["./image"],
    )
    assert.equal(
      indexes.byDerivative.get("/public/images/no-permalink.jpg"),
      undefined,
    )
    assert.equal(indexes.byDerivative.size, 1)
  })

  it("should handle input sources without paths", () => {
    const pages = {
      "./page": {
        _meta: {
          id: "./page",
          inputSources: [
            { path: "content/valid.md" },
            { loader: "markdown" }, // No path
            {}, // Empty source
          ],
        },
      },
    }

    const indexes = buildPageIndexes(pages)

    // Only input sources with paths should be indexed
    assert.equal(indexes.byInputSource.get("content/valid.md"), pages["./page"])
    assert.equal(indexes.byInputSource.size, 1)
  })

  it("should return all expected index types", () => {
    const pages = {}
    const indexes = buildPageIndexes(pages)

    const expectedIndexes = [
      "byPermalink",
      "byInputPath",
      "byIdAndLang",
      "byDerivative",
      "byParentPermalink",
      "byInputSource",
    ]

    const actualIndexes = Object.keys(indexes).sort()
    assert.deepEqual(actualIndexes, expectedIndexes.sort())
  })
})

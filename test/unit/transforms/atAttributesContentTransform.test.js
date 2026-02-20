const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const atAttributesContentTransform = require("../../../src/transforms/atAttributesContentTransform")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("atAttributesContentTransform", () => {
  let config
  let context
  let options

  beforeEach(() => {
    options = {}
    config = createMockConfig({
      dirs: {
        content: "content",
      },
    })
    context = {
      site: {
        title: "Test Site",
        url: "https://example.com",
        lang: "en",
      },
      pages: {},
      _pageIndexes: null, // Will be set per test if needed
    }
  })

  describe("@data attributes", () => {
    it("should resolve @data attributes from context", () => {
      const page = createMockPage({
        title: "Page with @data:site.title",
        description: "URL is @data:site.url",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )

      assert.equal(result.title, "Page with Test Site")
      assert.equal(result.description, "URL is https://example.com")
    })

    it("should handle nested @data paths", () => {
      context.deeply = {
        nested: {
          value: "found it",
        },
      }

      const page = createMockPage({
        content: "Value: @data:deeply.nested.value",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.content, "Value: found it")
    })

    it("should handle missing @data attributes", () => {
      const page = createMockPage({
        content: "Missing: @data:nonexistent.path",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep original value on error
      assert.equal(result.content, "Missing: nonexistent.path")
    })
  })

  describe("@file attributes", () => {
    it("should resolve @file attributes to page permalinks", () => {
      const imagePage = createMockPage({
        permalink: "/images/test.jpg",
        _meta: {
          id: "./images/test.jpg",
          inputPath: "content/images/test.jpg",
        },
      })
      context.pages["./images/test.jpg"] = imagePage

      const page = createMockPage({
        image: "@file:/images/test.jpg",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.image, "/images/test.jpg")
    })

    it("should handle missing @file", () => {
      const page = createMockPage({
        image: "@file:/missing/image.jpg",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep the path part on error
      assert.equal(result.image, "/missing/image.jpg")
    })

    it("should require absolute paths for @file", () => {
      const page = createMockPage({
        image: "@file:relative/path.jpg",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep original value on error
      assert.equal(result.image, "relative/path.jpg")
    })
  })

  describe("@id attributes", () => {
    it("should resolve @id attributes to page permalinks", () => {
      const aboutPage = createMockPage({
        permalink: "/about/",
        _meta: { id: "./about" },
        id: "about",
        lang: "en",
      })
      context.pages["./about"] = aboutPage

      const page = createMockPage({
        link: "@id:about",
        lang: "en",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.link, "/about/")
    })

    it("should handle @id with fallback", () => {
      const homePage = createMockPage({
        permalink: "/",
        _meta: { id: "./home" },
        id: "home",
        lang: "en",
      })
      context.pages["./home"] = homePage

      const page = createMockPage({
        link: "@id:missing:home",
        lang: "en",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.link, "/")
    })

    it("should handle @id with language", () => {
      const aboutFr = createMockPage({
        permalink: "/fr/about/",
        _meta: { id: "./fr/about" },
        id: "about",
        lang: "fr",
      })
      context.pages["./fr/about"] = aboutFr

      const page = createMockPage({
        link: "@id:about::fr",
        lang: "en",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.link, "/fr/about/")
    })

    it("should fallback to default language", () => {
      const aboutEn = createMockPage({
        permalink: "/about/",
        _meta: { id: "./about" },
        id: "about",
        lang: "en",
      })
      context.pages["./about"] = aboutEn
      context.site.lang = "en"

      const page = createMockPage({
        link: "@id:about",
        lang: "fr",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.link, "/about/")
    })
  })

  describe("@permalink attributes", () => {
    it("should resolve @permalink attributes", () => {
      const targetPage = createMockPage({
        permalink: "/target/page/",
        _meta: { id: "./target" },
      })
      context.pages["./target"] = targetPage

      const page = createMockPage({
        ref: "@permalink:/target/page/",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.ref, "/target/page/")
    })

    it("should handle derivatives in @permalink", () => {
      const imagePage = createMockPage({
        permalink: "/images/original.jpg",
        derivatives: [
          { permalink: "/images/thumb.jpg" },
          { permalink: "/images/large.jpg" },
        ],
        _meta: { id: "./images/original" },
      })
      context.pages["./images/original"] = imagePage

      const page = createMockPage({
        thumb: "@permalink:/images/thumb.jpg",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.thumb, "/images/thumb.jpg")
    })

    it("should require @permalink to start with /", () => {
      const page = createMockPage({
        link: "@permalink:relative/path",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep original value on error
      assert.equal(result.link, "relative/path")
    })

    it("should suggest alternate permalink with/without trailing slash", () => {
      const targetPage = createMockPage({
        permalink: "/target/page/",
        _meta: { id: "./target" },
      })
      context.pages["./target"] = targetPage

      const page = createMockPage({
        link: "@permalink:/target/page",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep original value when not found but alternate exists
      assert.equal(result.link, "/target/page")
    })

    it("should handle missing @permalink", () => {
      const page = createMockPage({
        link: "@permalink:/missing/page/",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.link, "/missing/page/")
    })
  })

  describe("performance optimizations", () => {
    it("should skip processing if no @ symbols", () => {
      const page = createMockPage({
        title: "No attributes here",
        content: "Just plain text",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )

      // Should return unchanged
      assert.equal(result.title, "No attributes here")
      assert.equal(result.content, "Just plain text")
    })

    it("should skip processing if @ present but no valid attributes", () => {
      const page = createMockPage({
        title: "Contact us at admin@example.com",
        content: "Email: support@test.org",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )

      // Should return unchanged (email addresses don't match attribute pattern)
      assert.equal(result.title, "Contact us at admin@example.com")
      assert.equal(result.content, "Email: support@test.org")
    })

    it("should handle multiple identical attributes efficiently", () => {
      const aboutPage = createMockPage({
        permalink: "/about/",
        _meta: { id: "./about" },
        id: "about",
        lang: "en",
      })
      context.pages["./about"] = aboutPage

      const page = createMockPage({
        link1: "@id:about",
        link2: "@id:about",
        link3: "@id:about",
        lang: "en",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.link1, "/about/")
      assert.equal(result.link2, "/about/")
      assert.equal(result.link3, "/about/")
    })
  })

  describe("with indexes", () => {
    beforeEach(() => {
      context._pageIndexes = {
        byPermalink: new Map(),
        byInputPath: new Map(),
        byIdAndLang: new Map(),
        byDerivative: new Map(),
      }
    })

    it("should use indexes for faster lookups", () => {
      const aboutPage = createMockPage({
        permalink: "/about/",
        _meta: {
          id: "./about",
          inputPath: "content/about.md",
        },
        id: "about",
        lang: "en",
      })

      context.pages["./about"] = aboutPage
      context._pageIndexes.byPermalink.set("/about/", aboutPage)
      context._pageIndexes.byInputPath.set("content/about.md", aboutPage)
      context._pageIndexes.byIdAndLang.set("about:en", aboutPage)

      const page = createMockPage({
        link1: "@permalink:/about/",
        link2: "@file:/about.md",
        link3: "@id:about",
        lang: "en",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.link1, "/about/")
      assert.equal(result.link2, "/about/")
      assert.equal(result.link3, "/about/")
    })

    it("should use byDerivative index for derivative permalinks", () => {
      const imagePage = createMockPage({
        permalink: "/images/original.jpg",
        derivatives: [
          { permalink: "/images/thumb.jpg" },
          { permalink: "/images/large.jpg" },
        ],
        _meta: { id: "./images/original" },
      })

      context.pages["./images/original"] = imagePage
      context._pageIndexes.byPermalink.set("/images/original.jpg", imagePage)
      context._pageIndexes.byDerivative.set("/images/thumb.jpg", imagePage)
      context._pageIndexes.byDerivative.set("/images/large.jpg", imagePage)

      const page = createMockPage({
        thumb: "@permalink:/images/thumb.jpg",
        large: "@permalink:/images/large.jpg",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.thumb, "/images/thumb.jpg")
      assert.equal(result.large, "/images/large.jpg")
    })
  })

  describe("error handling", () => {
    it("should handle pages marked as excludeFromWrite", () => {
      const draftPage = createMockPage({
        permalink: "/draft/",
        excludeFromWrite: true,
        _meta: { id: "./draft" },
      })
      context.pages["./draft"] = draftPage

      const page = createMockPage({
        link: "@permalink:/draft/",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep original value
      assert.equal(result.link, "/draft/")
    })

    it("should handle page missing required attribute", () => {
      const brokenPage = createMockPage({
        _meta: { id: "./broken" },
        id: "broken",
        lang: "en",
      })
      // Explicitly remove permalink to test missing attribute error
      delete brokenPage.permalink
      context.pages["./broken"] = brokenPage

      const page = createMockPage({
        link: "@id:broken",
        lang: "en",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep original value on error
      assert.equal(result.link, "broken")
    })

    it("should handle @id fallback not found", () => {
      const page = createMockPage({
        link: "@id:missing:alsomissing",
        lang: "en",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep the id part
      assert.equal(result.link, "missing:alsomissing")
    })

    it("should handle @id not found in current language", () => {
      const page = createMockPage({
        link: "@id:nonexistent",
        lang: "fr",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep the id part
      assert.equal(result.link, "nonexistent")
    })

    it("should handle unknown @attribute types", () => {
      const page = createMockPage({
        unknown: "@unknown:value",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      // Should keep the value part
      assert.equal(result.unknown, "value")
    })

    it("should handle complex nested structures", () => {
      const page = createMockPage({
        nested: {
          deep: {
            attr: "@data:site.url",
          },
          array: [{ item: "@data:site.title" }, "@data:site.lang"],
        },
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.nested.deep.attr, "https://example.com")
      assert.equal(result.nested.array[0].item, "Test Site")
      assert.equal(result.nested.array[1], "en")
    })
  })

  describe("JSON safety", () => {
    it("should handle special characters in replacements", () => {
      context.site.title = 'Site with "quotes" and \\ backslashes'

      const page = createMockPage({
        title: "@data:site.title",
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.title, 'Site with "quotes" and \\ backslashes')
    })

    it("should preserve functions in pages", () => {
      const testFunc = () => "test"
      const page = createMockPage({
        title: "@data:site.title",
        myFunction: testFunc,
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.title, "Test Site")
      assert.equal(typeof result.myFunction, "function")
      assert.equal(result.myFunction(), "test")
    })

    it("should preserve dates", () => {
      const testDate = new Date("2024-01-01")
      const page = createMockPage({
        title: "@data:site.title",
        created: testDate,
        _meta: { id: "./test" },
      })

      const result = atAttributesContentTransform(
        page,
        options,
        config,
        context,
      )
      assert.equal(result.title, "Test Site")
      assert(result.created instanceof Date)
      assert.equal(result.created.toISOString(), testDate.toISOString())
    })
  })
})

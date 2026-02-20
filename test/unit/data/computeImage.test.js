const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeImage = require("../../../src/data/computeImage")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("computeImage", () => {
  let config
  let pages
  let context

  beforeEach(() => {
    config = createMockConfig()
    pages = {}
    context = {
      pages,
      site: {
        image: "/default-site-image.jpg",
      },
    }
  })

  describe("cover image", () => {
    it("should use cover image if specified", () => {
      const imagePage = createMockPage({
        permalink: "/images/cover.jpg",
        _meta: {
          id: "./images/cover.jpg",
          outputType: "IMAGE",
        },
      })
      pages["./images/cover.jpg"] = imagePage

      const page = createMockPage({
        cover: "/images/cover.jpg",
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "/images/cover.jpg")
    })

    it("should handle external cover image", () => {
      const page = createMockPage({
        cover: "https://example.com/image.jpg",
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "https://example.com/image.jpg")
    })

    it("should handle data URI cover image", () => {
      const page = createMockPage({
        cover: "data:image/png;base64,iVBORw0KG...",
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "data:image/png;base64,iVBORw0KG...")
    })

    it("should handle @attribute cover image", () => {
      const page = createMockPage({
        cover: "@file:/images/cover.jpg",
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "@file:/images/cover.jpg")
    })
  })

  describe("explicit image property", () => {
    it("should use image property if no cover", () => {
      const imagePage = createMockPage({
        permalink: "/images/main.jpg",
        _meta: {
          id: "./images/main.jpg",
          outputType: "IMAGE",
        },
      })
      pages["./images/main.jpg"] = imagePage

      const page = createMockPage({
        image: "/images/main.jpg",
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "/images/main.jpg")
    })

    it("should prefer cover over image", () => {
      const coverPage = createMockPage({
        permalink: "/images/cover.jpg",
        _meta: { id: "./images/cover.jpg" },
      })
      const imagePage = createMockPage({
        permalink: "/images/main.jpg",
        _meta: { id: "./images/main.jpg" },
      })
      pages["./images/cover.jpg"] = coverPage
      pages["./images/main.jpg"] = imagePage

      const page = createMockPage({
        cover: "/images/cover.jpg",
        image: "/images/main.jpg",
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "/images/cover.jpg")
    })
  })

  describe("content extraction", () => {
    it("should extract first image from content", () => {
      const imagePage = createMockPage({
        permalink: "/images/content.jpg",
        _meta: { id: "./images/content.jpg" },
      })
      pages["./images/content.jpg"] = imagePage

      const page = createMockPage({
        content:
          '<p>Text</p><img src="/images/content.jpg" alt="Test"><p>More text</p>',
        permalink: "/post",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "/images/content.jpg")
    })

    it("should handle multiple images in content", () => {
      const image1 = createMockPage({
        permalink: "/images/first.jpg",
        _meta: { id: "./images/first.jpg" },
      })
      const image2 = createMockPage({
        permalink: "/images/second.jpg",
        _meta: { id: "./images/second.jpg" },
      })
      pages["./images/first.jpg"] = image1
      pages["./images/second.jpg"] = image2

      const page = createMockPage({
        content: '<img src="/images/first.jpg"><img src="/images/second.jpg">',
        permalink: "/post",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "/images/first.jpg")
    })

    it("should handle external images in content", () => {
      const page = createMockPage({
        content: '<img src="https://example.com/external.jpg">',
        permalink: "/post",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "https://example.com/external.jpg")
    })

    it("should handle protocol-relative URLs", () => {
      const page = createMockPage({
        content: '<img src="//cdn.example.com/image.jpg">',
        permalink: "/post",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "//cdn.example.com/image.jpg")
    })
  })

  describe("descendants search", () => {
    it("should find image in descendants for collections", () => {
      const descendantPage = createMockPage({
        _meta: { id: "./blog/post1" },
        content: '<img src="/images/post.jpg">',
      })
      const imagePage = createMockPage({
        permalink: "/images/post.jpg",
        _meta: { id: "./images/post.jpg" },
      })
      pages["./blog/post1"] = descendantPage
      pages["./images/post.jpg"] = imagePage

      const page = createMockPage({
        content: undefined, // No content so it searches descendants
        _meta: {
          descendants: ["./blog/post1"],
        },
        permalink: "/blog",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: false,
      })
      assert.equal(result, "/images/post.jpg")
    })

    it("should return first found image from descendants", () => {
      const desc1 = createMockPage({
        _meta: { id: "./blog/post1" },
      })
      const desc2 = createMockPage({
        _meta: { id: "./blog/post2" },
        cover: "/images/found.jpg",
      })
      const imagePage = createMockPage({
        permalink: "/images/found.jpg",
        _meta: { id: "./images/found.jpg" },
      })
      pages["./blog/post1"] = desc1
      pages["./blog/post2"] = desc2
      pages["./images/found.jpg"] = imagePage

      const page = createMockPage({
        content: undefined, // No content so it searches descendants
        _meta: {
          descendants: ["./blog/post1", "./blog/post2"],
        },
        permalink: "/blog",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: false,
      })
      assert.equal(result, "/images/found.jpg")
    })

    it("should handle empty descendants", () => {
      const page = createMockPage({
        _meta: {
          descendants: [],
        },
        permalink: "/blog",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: false,
      })
      assert.equal(result, null)
    })
  })

  describe("default image", () => {
    it("should return site default image when setDefaultImage is true", () => {
      const page = createMockPage({
        permalink: "/about",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: true,
      })
      assert.equal(result, "/default-site-image.jpg")
    })

    it("should return null when setDefaultImage is false", () => {
      const page = createMockPage({
        permalink: "/about",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: false,
      })
      assert.equal(result, null)
    })

    it("should default to setDefaultImage true", () => {
      const page = createMockPage({
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "/default-site-image.jpg")
    })

    it("should handle missing site.image", () => {
      context.site.image = null
      const page = createMockPage({
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, null)
    })
  })

  describe("recursive search", () => {
    it("should handle recursive descendant search", () => {
      const grandchild = createMockPage({
        _meta: { id: "./blog/2024/post1" },
        content: '<img src="/images/deep.jpg">',
      })
      const child = createMockPage({
        content: undefined, // No content so it searches its descendants
        _meta: {
          id: "./blog/2024",
          descendants: ["./blog/2024/post1"],
        },
      })
      const imagePage = createMockPage({
        permalink: "/images/deep.jpg",
        _meta: { id: "./images/deep.jpg" },
      })
      pages["./blog/2024/post1"] = grandchild
      pages["./blog/2024"] = child
      pages["./images/deep.jpg"] = imagePage

      const page = createMockPage({
        content: undefined, // No content so it searches descendants
        _meta: {
          descendants: ["./blog/2024"],
        },
        permalink: "/blog",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: false,
      })
      assert.equal(result, "/images/deep.jpg")
    })
  })

  describe("error handling", () => {
    it("should handle missing image page", () => {
      const page = createMockPage({
        cover: "/images/missing.jpg",
        permalink: "/about",
      })

      const result = computeImage(page, config, context)
      assert.equal(result, "/images/missing.jpg")
    })

    it("should handle malformed HTML", () => {
      const page = createMockPage({
        content: '<img src="/images/test.jpg"',
        permalink: "/post",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: false,
      })
      assert.equal(result, null)
    })

    it("should handle img without src", () => {
      const page = createMockPage({
        content: '<img alt="No source">',
        permalink: "/post",
      })

      const result = computeImage(page, config, context, {
        setDefaultImage: false,
      })
      assert.equal(result, null)
    })
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeImage.kissDependencies))
    assert(computeImage.kissDependencies.includes("content"))
    assert(computeImage.kissDependencies.includes("permalink"))
    assert(computeImage.kissDependencies.includes("_meta.descendants"))
  })
})

const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const nunjucksContentTransform = require("../../../src/transforms/nunjucksContentTransform")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("nunjucksContentTransform", () => {
  let config
  let context
  let options

  beforeEach(() => {
    options = {}
    context = {
      site: {
        title: "Test Site",
        url: "https://example.com",
      },
      pages: {},
      collections: {
        _type: "collection",
        _id: ".",
        blog: {
          _type: "collection",
          _id: "./blog",
          posts: [],
        },
      },
    }
    config = createMockConfig({
      libs: {
        nunjucks: {
          render: (template, ctx) => {
            // Simple mock that returns template name and some context
            return `<html>Template: ${template}, Title: ${ctx.title || "No title"}, Site: ${ctx.site?.title || "No site"}</html>`
          },
        },
      },
    })
  })

  it("should render page with nunjucks template", () => {
    const page = createMockPage({
      title: "Test Page",
      layout: "default.njk",
      _meta: {
        isCollection: false,
      },
    })

    const result = nunjucksContentTransform(page, options, config, context)

    assert(result._html)
    assert(result._html.includes("Template: default.njk"))
    assert(result._html.includes("Title: Test Page"))
    assert(result._html.includes("Site: Test Site"))
  })

  it("should include collection data for collection pages", () => {
    const page = createMockPage({
      title: "Blog Collection",
      layout: "collection.njk",
      _meta: {
        id: "./blog",
        isCollection: true,
      },
    })

    config.libs.nunjucks.render = (template, ctx) => {
      return `Collection: ${ctx.collection?._id || "none"}, Title: ${ctx.title}`
    }

    const result = nunjucksContentTransform(page, options, config, context)

    assert(result._html)
    assert(result._html.includes("Collection: ./blog"))
    assert(result._html.includes("Title: Blog Collection"))
  })

  it("should merge context and page data", () => {
    const page = createMockPage({
      title: "Page Title",
      customField: "custom value",
      layout: "post.njk",
      _meta: {
        isCollection: false,
      },
    })

    config.libs.nunjucks.render = (template, ctx) => {
      return JSON.stringify({
        hasTitle: !!ctx.title,
        hasCustomField: !!ctx.customField,
        hasSite: !!ctx.site,
        hasPages: !!ctx.pages,
      })
    }

    const result = nunjucksContentTransform(page, options, config, context)
    const parsed = JSON.parse(result._html)

    assert.equal(parsed.hasTitle, true)
    assert.equal(parsed.hasCustomField, true)
    assert.equal(parsed.hasSite, true)
    assert.equal(parsed.hasPages, true)
  })

  it("should handle pages without collection", () => {
    const page = createMockPage({
      title: "Regular Page",
      layout: "default.njk",
      _meta: {
        id: "./about",
        isCollection: false,
      },
    })

    // Remove collections from context
    context.collections = {}

    config.libs.nunjucks.render = (template, ctx) => {
      return `Collection: ${ctx.collection || "none"}`
    }

    const result = nunjucksContentTransform(page, options, config, context)
    assert(result._html.includes("Collection: none"))
  })

  it("should handle missing nunjucks library", () => {
    const page = createMockPage({
      layout: "default.njk",
    })

    config.libs.nunjucks = undefined

    assert.throws(() => {
      nunjucksContentTransform(page, options, config, context)
    })
  })

  it("should handle missing layout", () => {
    const page = createMockPage({
      title: "No Layout",
      layout: undefined,
    })

    config.libs.nunjucks.render = (template) => {
      return `Template: ${template || "undefined"}`
    }

    const result = nunjucksContentTransform(page, options, config, context)
    assert(result._html.includes("Template: undefined"))
  })

  it("should preserve page reference", () => {
    const page = createMockPage({
      title: "Test",
      layout: "default.njk",
    })

    const result = nunjucksContentTransform(page, options, config, context)

    // Should return the same page object, just with _html added
    assert.equal(result, page)
    assert(result._html)
  })

  it("should handle nested collection structure", () => {
    context.collections = {
      _type: "collection",
      _id: ".",
      docs: {
        _type: "collection",
        _id: "./docs",
        api: {
          _type: "collection",
          _id: "./docs/api",
          endpoints: [],
        },
      },
    }

    const page = createMockPage({
      title: "API Docs",
      layout: "api.njk",
      _meta: {
        id: "./docs/api",
        isCollection: true,
      },
    })

    config.libs.nunjucks.render = (template, ctx) => {
      return `Found: ${ctx.collection?._id || "not found"}`
    }

    const result = nunjucksContentTransform(page, options, config, context)
    assert(result._html.includes("Found: ./docs/api"))
  })
})

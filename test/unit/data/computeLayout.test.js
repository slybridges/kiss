const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeLayout = require("../../../src/data/computeLayout")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeLayout", () => {
  let config

  beforeEach(() => {
    config = createMockConfig({
      templates: {
        default: "default.njk",
        post: "post.njk",
        collection: "collection.njk",
      },
    })
  })

  it("should return post template for posts", () => {
    const page = {
      _meta: {
        isPost: true,
        isCollection: false,
      },
    }

    const result = computeLayout(page, config)
    assert.equal(result, "post.njk")
  })

  it("should return collection template for collections", () => {
    const page = {
      _meta: {
        isPost: false,
        isCollection: true,
      },
    }

    const result = computeLayout(page, config)
    assert.equal(result, "collection.njk")
  })

  it("should return default template for regular pages", () => {
    const page = {
      _meta: {
        isPost: false,
        isCollection: false,
      },
    }

    const result = computeLayout(page, config)
    assert.equal(result, "default.njk")
  })

  it("should prioritize post over collection", () => {
    const page = {
      _meta: {
        isPost: true,
        isCollection: true,
      },
    }

    const result = computeLayout(page, config)
    assert.equal(result, "post.njk")
  })

  it("should use custom template names from config", () => {
    config.templates = {
      default: "base.html",
      post: "article.html",
      collection: "list.html",
    }

    const postPage = {
      _meta: {
        isPost: true,
        isCollection: false,
      },
    }

    const result = computeLayout(postPage, config)
    assert.equal(result, "article.html")
  })

  it("should fallback to default names if not in config", () => {
    config.templates = {}

    const page = {
      _meta: {
        isPost: true,
        isCollection: false,
      },
    }

    const result = computeLayout(page, config)
    assert.equal(result, "post.njk")
  })

  it("should handle undefined templates config", () => {
    config.templates = undefined

    const page = {
      _meta: {
        isPost: false,
        isCollection: true,
      },
    }

    const result = computeLayout(page, config)
    assert.equal(result, "collection.njk")
  })

  it("should handle null template values", () => {
    config.templates = {
      default: null,
      post: null,
      collection: null,
    }

    const page = {
      _meta: {
        isPost: true,
        isCollection: false,
      },
    }

    const result = computeLayout(page, config)
    assert.equal(result, "post.njk")
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeLayout.kissDependencies))
    assert(computeLayout.kissDependencies.includes("_meta.isCollection"))
    assert(computeLayout.kissDependencies.includes("_meta.isPost"))
  })
})

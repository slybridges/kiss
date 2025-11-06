const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeTitle = require("../../../src/data/computeTitle")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeTitle", () => {
  let config

  beforeEach(() => {
    config = createMockConfig({
      libs: {
        unslugify: (str) => {
          // Simple unslugify implementation
          return str.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        },
      },
    })
  })

  it("should use baseTitle if provided", () => {
    const page = {
      _meta: {
        baseTitle: "Custom Title",
        basename: "slug-name",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "Custom Title")
  })

  it("should unslugify basename if no baseTitle", () => {
    const page = {
      _meta: {
        basename: "about-us",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "About Us")
  })

  it("should handle single word basename", () => {
    const page = {
      _meta: {
        basename: "contact",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "Contact")
  })

  it("should handle basename with extension", () => {
    const page = {
      _meta: {
        basename: "page.md",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "Page.Md")
  })

  it("should handle empty basename", () => {
    const page = {
      _meta: {
        basename: "",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "")
  })

  it("should handle complex slugs", () => {
    const page = {
      _meta: {
        basename: "the-quick-brown-fox",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "The Quick Brown Fox")
  })

  it("should prefer baseTitle over basename", () => {
    const page = {
      _meta: {
        baseTitle: "Override Title",
        basename: "different-slug",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "Override Title")
  })

  it("should handle falsy baseTitle", () => {
    const page = {
      _meta: {
        baseTitle: "",
        basename: "fallback-slug",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "Fallback Slug")
  })

  it("should handle null baseTitle", () => {
    const page = {
      _meta: {
        baseTitle: null,
        basename: "null-test",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "Null Test")
  })

  it("should handle undefined baseTitle", () => {
    const page = {
      _meta: {
        basename: "undefined-test",
      },
    }

    const result = computeTitle(page, config)
    assert.equal(result, "Undefined Test")
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeTitle.kissDependencies))
    assert(computeTitle.kissDependencies.includes("_meta.basename"))
    assert(computeTitle.kissDependencies.includes("_meta.baseTitle"))
  })
})

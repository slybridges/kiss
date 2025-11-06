const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeCreated = require("../../../src/data/computeCreated")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("computeCreated", () => {
  let config
  let pages
  let context

  beforeEach(() => {
    config = createMockConfig({
      defaults: {
        pagePublishedAttribute: "created",
      },
    })
    pages = {}
    context = { pages }
  })

  it("should use fileCreated for non-collection pages", () => {
    const fileCreated = new Date("2024-01-01")
    const page = createMockPage({
      _meta: {
        fileCreated,
        isCollection: false,
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, fileCreated)
  })

  it("should return undefined if no fileCreated for non-collection", () => {
    const page = createMockPage({
      _meta: {
        isCollection: false,
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, undefined)
  })

  it("should find earliest date in descendants for collections", () => {
    const date1 = new Date("2024-01-01")
    const date2 = new Date("2024-02-01")
    const date3 = new Date("2023-12-01")

    pages["./post1"] = createMockPage({ created: date1 })
    pages["./post2"] = createMockPage({ created: date2 })
    pages["./post3"] = createMockPage({ created: date3 })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2", "./post3"],
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, date3)
  })

  it("should skip invalid dates in descendants", () => {
    const validDate = new Date("2024-01-01")

    pages["./post1"] = createMockPage({ created: "not-a-date" })
    pages["./post2"] = createMockPage({ created: null })
    pages["./post3"] = createMockPage({ created: validDate })
    pages["./post4"] = createMockPage({ created: undefined })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2", "./post3", "./post4"],
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, validDate)
  })

  it("should handle empty descendants", () => {
    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: [],
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, undefined)
  })

  it("should fallback to fileCreated if no valid descendant dates", () => {
    const fileCreated = new Date("2024-01-01")

    pages["./post1"] = createMockPage({ created: "invalid" })
    pages["./post2"] = createMockPage({ created: null })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2"],
        fileCreated,
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, fileCreated)
  })

  it("should handle missing pages in descendants", () => {
    const validDate = new Date("2024-01-01")
    pages["./post1"] = createMockPage({ created: validDate })
    // "./post2" doesn't exist in pages

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2"],
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, validDate)
  })

  it("should use custom pagePublishedAttribute", () => {
    config.defaults.pagePublishedAttribute = "publishedAt"
    const date = new Date("2024-01-01")

    pages["./post1"] = createMockPage({
      publishedAt: date,
      created: new Date("2024-02-01"),
    })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1"],
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, date)
  })

  it("should handle dates that are not Date objects", () => {
    pages["./post1"] = createMockPage({ created: { notADate: true } })
    pages["./post2"] = createMockPage({ created: 12345 })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2"],
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result, undefined)
  })

  it("should find earliest among multiple valid dates", () => {
    const dates = [
      new Date("2024-03-15"),
      new Date("2024-01-10"),
      new Date("2024-06-01"),
      new Date("2023-12-25"),
      new Date("2024-02-20"),
    ]

    dates.forEach((date, i) => {
      pages[`./post${i}`] = createMockPage({ created: date })
    })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: dates.map((_, i) => `./post${i}`),
      },
    })

    const result = computeCreated(page, config, context)
    assert.equal(result.toISOString(), "2023-12-25T00:00:00.000Z")
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeCreated.kissDependencies))
    assert.deepEqual(computeCreated.kissDependencies[0], [
      "_meta.descendants",
      "created",
    ])
  })
})

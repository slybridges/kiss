const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeModified = require("../../../src/data/computeModified")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("computeModified", () => {
  let config
  let pages
  let context

  beforeEach(() => {
    config = createMockConfig({
      defaults: {
        pageUpdatedAttribute: "modified",
      },
    })
    pages = {}
    context = { pages }
  })

  it("should use fileModified for non-collection pages", () => {
    const fileModified = new Date("2024-06-01")
    const page = createMockPage({
      _meta: {
        fileModified,
        isCollection: false,
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, fileModified)
  })

  it("should return undefined if no fileModified for non-collection", () => {
    const page = createMockPage({
      _meta: {
        isCollection: false,
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, undefined)
  })

  it("should find latest date in descendants for collections", () => {
    const date1 = new Date("2024-01-01")
    const date2 = new Date("2024-06-01")
    const date3 = new Date("2024-03-01")

    pages["./post1"] = createMockPage({ modified: date1 })
    pages["./post2"] = createMockPage({ modified: date2 })
    pages["./post3"] = createMockPage({ modified: date3 })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2", "./post3"],
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, date2)
  })

  it("should skip invalid dates in descendants", () => {
    const validDate = new Date("2024-05-01")

    pages["./post1"] = createMockPage({ modified: "not-a-date" })
    pages["./post2"] = createMockPage({ modified: null })
    pages["./post3"] = createMockPage({ modified: validDate })
    pages["./post4"] = createMockPage({ modified: undefined })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2", "./post3", "./post4"],
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, validDate)
  })

  it("should handle empty descendants", () => {
    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: [],
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, undefined)
  })

  it("should fallback to fileModified if no valid descendant dates", () => {
    const fileModified = new Date("2024-05-01")

    pages["./post1"] = createMockPage({ modified: "invalid" })
    pages["./post2"] = createMockPage({ modified: null })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2"],
        fileModified,
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, fileModified)
  })

  it("should handle missing pages in descendants", () => {
    const validDate = new Date("2024-05-01")
    pages["./post1"] = createMockPage({ modified: validDate })
    // "./post2" doesn't exist in pages

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2"],
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, validDate)
  })

  it("should use custom pageUpdatedAttribute", () => {
    config.defaults.pageUpdatedAttribute = "updatedAt"
    const date = new Date("2024-05-01")

    pages["./post1"] = createMockPage({
      updatedAt: date,
      modified: new Date("2024-02-01"),
    })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1"],
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, date)
  })

  it("should handle dates that are not Date objects", () => {
    pages["./post1"] = createMockPage({ modified: { notADate: true } })
    pages["./post2"] = createMockPage({ modified: 12345 })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1", "./post2"],
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result, undefined)
  })

  it("should find latest among multiple valid dates", () => {
    const dates = [
      new Date("2024-03-15"),
      new Date("2024-01-10"),
      new Date("2024-12-25"),
      new Date("2024-06-01"),
      new Date("2024-02-20"),
    ]

    dates.forEach((date, i) => {
      pages[`./post${i}`] = createMockPage({ modified: date })
    })

    const page = createMockPage({
      _meta: {
        isCollection: true,
        descendants: dates.map((_, i) => `./post${i}`),
      },
    })

    const result = computeModified(page, config, context)
    assert.equal(result.toISOString(), "2024-12-25T00:00:00.000Z")
  })

  it("should handle collection flag properly", () => {
    const fileModified = new Date("2024-05-01")
    const descendantDate = new Date("2024-06-01")

    pages["./post1"] = createMockPage({ modified: descendantDate })

    // Not a collection, should use fileModified
    const page1 = createMockPage({
      _meta: {
        isCollection: false,
        descendants: ["./post1"],
        fileModified,
      },
    })

    const result1 = computeModified(page1, config, context)
    assert.equal(result1, fileModified)

    // Is a collection, should use descendant date
    const page2 = createMockPage({
      _meta: {
        isCollection: true,
        descendants: ["./post1"],
        fileModified,
      },
    })

    const result2 = computeModified(page2, config, context)
    assert.equal(result2, descendantDate)
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeModified.kissDependencies))
    assert(computeModified.kissDependencies.includes("_meta.isCollection"))
    assert(computeModified.kissDependencies.includes("_meta.descendants"))
    assert.deepEqual(computeModified.kissDependencies[2], [
      "_meta.descendants",
      "modified",
    ])
  })
})

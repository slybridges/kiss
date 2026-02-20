const { describe, it } = require("node:test")
const assert = require("assert/strict")
const {
  getBuildEntries,
  sortPages,
  sortPageIds,
} = require("../../../src/helpers")
const {
  createMockPage,
  createMockContext,
} = require("../../../test-utils/helpers")

describe("getBuildEntries", () => {
  it("should return all pages when no buildPageIds specified", () => {
    const context = createMockContext({
      pages: {
        "./page1": createMockPage({ _meta: { id: "./page1" } }),
        "./page2": createMockPage({ _meta: { id: "./page2" } }),
        "./page3": createMockPage({ _meta: { id: "./page3" } }),
      },
    })
    const buildFlags = {}

    const result = getBuildEntries(context, buildFlags)
    assert.equal(result.length, 3)
    assert.equal(result[0][0], "./page1")
    assert.equal(result[1][0], "./page2")
    assert.equal(result[2][0], "./page3")
  })

  it("should return only specified pages when buildPageIds provided", () => {
    const context = createMockContext({
      pages: {
        "./page1": createMockPage({ _meta: { id: "./page1" } }),
        "./page2": createMockPage({ _meta: { id: "./page2" } }),
        "./page3": createMockPage({ _meta: { id: "./page3" } }),
      },
    })
    const buildFlags = { buildPageIds: ["./page1", "./page3"] }

    const result = getBuildEntries(context, buildFlags)
    assert.equal(result.length, 2)
    assert.equal(result[0][0], "./page1")
    assert.equal(result[1][0], "./page3")
  })

  it("should include images when includingImages is true", () => {
    const context = createMockContext({
      pages: {
        "./page1": createMockPage({ _meta: { id: "./page1" } }),
        "./image1": createMockPage({
          _meta: { id: "./image1", outputType: "IMAGE" },
          sources: ["./page1"],
        }),
        "./image2": createMockPage({
          _meta: { id: "./image2", outputType: "IMAGE" },
          sources: ["./page2"],
        }),
      },
    })
    const buildFlags = { buildPageIds: ["./page1"] }

    const result = getBuildEntries(context, buildFlags, {
      includingImages: true,
    })
    assert.equal(result.length, 2)
    assert.equal(result[0][0], "./page1")
    assert.equal(result[1][0], "./image1")
  })

  it("should filter out undefined pages", () => {
    const context = createMockContext({
      pages: {
        "./page1": createMockPage({ _meta: { id: "./page1" } }),
        "./page2": undefined,
        "./page3": createMockPage({ _meta: { id: "./page3" } }),
      },
    })
    const buildFlags = {}

    const result = getBuildEntries(context, buildFlags)
    assert.equal(result.length, 2)
    assert.equal(result[0][0], "./page1")
    assert.equal(result[1][0], "./page3")
  })

  it("should handle empty buildPageIds array", () => {
    const context = createMockContext({
      pages: {
        "./page1": createMockPage({ _meta: { id: "./page1" } }),
        "./page2": createMockPage({ _meta: { id: "./page2" } }),
      },
    })
    const buildFlags = { buildPageIds: [] }

    const result = getBuildEntries(context, buildFlags)
    assert.equal(result.length, 2)
  })

  it("should avoid duplicate entries", () => {
    const context = createMockContext({
      pages: {
        "./page1": createMockPage({ _meta: { id: "./page1" } }),
      },
    })
    const buildFlags = { buildPageIds: ["./page1", "./page1", "./page1"] }

    const result = getBuildEntries(context, buildFlags)
    assert.equal(result.length, 1)
    assert.equal(result[0][0], "./page1")
  })
})

describe("sortPages", () => {
  it("should sort pages by attribute ascending", () => {
    const pages = [
      createMockPage({ title: "C", order: 3 }),
      createMockPage({ title: "A", order: 1 }),
      createMockPage({ title: "B", order: 2 }),
    ]

    const result = sortPages(pages, "order")
    assert.equal(result[0].order, 1)
    assert.equal(result[1].order, 2)
    assert.equal(result[2].order, 3)
  })

  it("should sort pages by attribute descending with - prefix", () => {
    const pages = [
      createMockPage({ title: "C", order: 3 }),
      createMockPage({ title: "A", order: 1 }),
      createMockPage({ title: "B", order: 2 }),
    ]

    const result = sortPages(pages, "-order")
    assert.equal(result[0].order, 3)
    assert.equal(result[1].order, 2)
    assert.equal(result[2].order, 1)
  })

  it("should sort by nested attributes", () => {
    const pages = [
      createMockPage({ meta: { priority: 3 } }),
      createMockPage({ meta: { priority: 1 } }),
      createMockPage({ meta: { priority: 2 } }),
    ]

    const result = sortPages(pages, "meta.priority")
    assert.equal(result[0].meta.priority, 1)
    assert.equal(result[1].meta.priority, 2)
    assert.equal(result[2].meta.priority, 3)
  })

  it("should handle undefined values", () => {
    const pages = [
      createMockPage({ order: 2 }),
      createMockPage({ order: undefined }),
      createMockPage({ order: 1 }),
      createMockPage({ order: undefined }),
    ]

    const result = sortPages(pages, "order")
    assert.equal(result[0].order, 1)
    assert.equal(result[1].order, 2)
    assert.equal(result[2].order, undefined)
    assert.equal(result[3].order, undefined)
  })

  it("should skip undefined values when skipUndefinedSort is true", () => {
    const pages = [
      createMockPage({ order: 2 }),
      createMockPage({ order: undefined }),
      createMockPage({ order: 1 }),
      createMockPage({ order: undefined }),
    ]

    const result = sortPages(pages, "order", { skipUndefinedSort: true })
    assert.equal(result.length, 2)
    assert.equal(result[0].order, 1)
    assert.equal(result[1].order, 2)
  })

  it("should sort alphabetically by string attributes", () => {
    const pages = [
      createMockPage({ title: "Zebra" }),
      createMockPage({ title: "Apple" }),
      createMockPage({ title: "Banana" }),
    ]

    const result = sortPages(pages, "title")
    assert.equal(result[0].title, "Apple")
    assert.equal(result[1].title, "Banana")
    assert.equal(result[2].title, "Zebra")
  })

  it("should sort by dates", () => {
    const pages = [
      createMockPage({ date: "2024-03-01" }),
      createMockPage({ date: "2024-01-01" }),
      createMockPage({ date: "2024-02-01" }),
    ]

    const result = sortPages(pages, "date")
    assert.equal(result[0].date, "2024-01-01")
    assert.equal(result[1].date, "2024-02-01")
    assert.equal(result[2].date, "2024-03-01")
  })
})

describe("sortPageIds", () => {
  it("should sort page ids by page attributes", () => {
    const pages = {
      "./page1": createMockPage({ order: 3, _meta: { id: "./page1" } }),
      "./page2": createMockPage({ order: 1, _meta: { id: "./page2" } }),
      "./page3": createMockPage({ order: 2, _meta: { id: "./page3" } }),
    }
    const ids = ["./page1", "./page2", "./page3"]

    const result = sortPageIds(ids, pages, "order")
    assert.deepEqual(result, ["./page2", "./page3", "./page1"])
  })

  it("should handle descending sort", () => {
    const pages = {
      "./page1": createMockPage({ order: 3, _meta: { id: "./page1" } }),
      "./page2": createMockPage({ order: 1, _meta: { id: "./page2" } }),
      "./page3": createMockPage({ order: 2, _meta: { id: "./page3" } }),
    }
    const ids = ["./page1", "./page2", "./page3"]

    const result = sortPageIds(ids, pages, "-order")
    assert.deepEqual(result, ["./page1", "./page3", "./page2"])
  })

  it("should skip undefined sort values when specified", () => {
    const pages = {
      "./page1": createMockPage({ order: 3, _meta: { id: "./page1" } }),
      "./page2": createMockPage({ _meta: { id: "./page2" } }),
      "./page3": createMockPage({ order: 2, _meta: { id: "./page3" } }),
    }
    const ids = ["./page1", "./page2", "./page3"]

    const result = sortPageIds(ids, pages, "order", {
      skipUndefinedSort: true,
    })
    assert.deepEqual(result, ["./page3", "./page1"])
  })
})

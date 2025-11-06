const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeSiteLastUpdatedDataView = require("../../../src/views/computeSiteLastUpdatedDataView")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeSiteLastUpdatedDataView", () => {
  let config

  beforeEach(() => {
    config = createMockConfig({
      defaults: {
        pageUpdatedAttribute: "modified",
      },
    })
  })

  it("should return null when no pages exist", () => {
    const pages = {}
    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, null)
  })

  it("should return null when no pages have updated attribute", () => {
    const pages = {
      "./page1": { title: "Page 1", _meta: { id: "./page1" } },
      "./page2": { title: "Page 2", _meta: { id: "./page2" } },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, null)
  })

  it("should return the most recent update date", () => {
    const date1 = new Date("2023-01-01")
    const date2 = new Date("2023-01-15")
    const date3 = new Date("2023-01-10")

    const pages = {
      "./page1": { title: "Page 1", modified: date1, _meta: { id: "./page1" } },
      "./page2": { title: "Page 2", modified: date2, _meta: { id: "./page2" } },
      "./page3": { title: "Page 3", modified: date3, _meta: { id: "./page3" } },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, date2) // Most recent date
  })

  it("should ignore pages with undefined updated attribute", () => {
    const date1 = new Date("2023-01-01")
    const date2 = new Date("2023-01-15")

    const pages = {
      "./page1": { title: "Page 1", modified: date1, _meta: { id: "./page1" } },
      "./page2": { title: "Page 2", _meta: { id: "./page2" } }, // No modified
      "./page3": { title: "Page 3", modified: date2, _meta: { id: "./page3" } },
      "./page4": { title: "Page 4", modified: null, _meta: { id: "./page4" } }, // null modified
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, date2) // Most recent non-null/undefined date
  })

  it("should work with custom page updated attribute", () => {
    const customConfig = createMockConfig({
      defaults: {
        pageUpdatedAttribute: "lastModified",
      },
    })

    const date1 = new Date("2023-01-01")
    const date2 = new Date("2023-01-15")

    const pages = {
      "./page1": {
        title: "Page 1",
        lastModified: date1,
        _meta: { id: "./page1" },
      },
      "./page2": {
        title: "Page 2",
        lastModified: date2,
        _meta: { id: "./page2" },
      },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, customConfig)
    assert.equal(result, date2)
  })

  it("should handle nested attribute paths", () => {
    const nestedConfig = createMockConfig({
      defaults: {
        pageUpdatedAttribute: "meta.updated",
      },
    })

    const date1 = new Date("2023-01-01")
    const date2 = new Date("2023-01-15")

    const pages = {
      "./page1": {
        title: "Page 1",
        meta: { updated: date1 },
        _meta: { id: "./page1" },
      },
      "./page2": {
        title: "Page 2",
        meta: { updated: date2 },
        _meta: { id: "./page2" },
      },
      "./page3": {
        title: "Page 3",
        meta: {}, // No updated field
        _meta: { id: "./page3" },
      },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, nestedConfig)
    assert.equal(result, date2)
  })

  it("should handle single page", () => {
    const date = new Date("2023-01-01")
    const pages = {
      "./page1": { title: "Page 1", modified: date, _meta: { id: "./page1" } },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, date)
  })

  it("should handle pages with same updated date", () => {
    const date = new Date("2023-01-01")
    const pages = {
      "./page1": { title: "Page 1", modified: date, _meta: { id: "./page1" } },
      "./page2": { title: "Page 2", modified: date, _meta: { id: "./page2" } },
      "./page3": { title: "Page 3", modified: date, _meta: { id: "./page3" } },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, date)
  })

  it("should work with string dates", () => {
    const date1 = "2023-01-01"
    const date2 = "2023-01-15"
    const date3 = "2023-01-10"

    const pages = {
      "./page1": { title: "Page 1", modified: date1, _meta: { id: "./page1" } },
      "./page2": { title: "Page 2", modified: date2, _meta: { id: "./page2" } },
      "./page3": { title: "Page 3", modified: date3, _meta: { id: "./page3" } },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, date2) // Lexicographically latest
  })

  it("should work with numeric timestamps", () => {
    const timestamp1 = 1672531200000 // 2023-01-01
    const timestamp2 = 1673740800000 // 2023-01-15
    const timestamp3 = 1673395200000 // 2023-01-10

    const pages = {
      "./page1": {
        title: "Page 1",
        modified: timestamp1,
        _meta: { id: "./page1" },
      },
      "./page2": {
        title: "Page 2",
        modified: timestamp2,
        _meta: { id: "./page2" },
      },
      "./page3": {
        title: "Page 3",
        modified: timestamp3,
        _meta: { id: "./page3" },
      },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, timestamp2) // Highest timestamp
  })

  it("should handle mixed date types", () => {
    const dateObj = new Date("2023-01-15")
    const dateString = "2023-01-01"
    const timestamp = 1673049600000 // 2023-01-07

    const pages = {
      "./page1": {
        title: "Page 1",
        modified: dateObj,
        _meta: { id: "./page1" },
      },
      "./page2": {
        title: "Page 2",
        modified: dateString,
        _meta: { id: "./page2" },
      },
      "./page3": {
        title: "Page 3",
        modified: timestamp,
        _meta: { id: "./page3" },
      },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, dateObj) // Date object should be the latest
  })

  it("should handle empty pages object", () => {
    const pages = {}
    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)
    assert.equal(result, null)
  })

  it("should work with skipUndefinedSort option", () => {
    const date1 = new Date("2023-01-01")
    const date2 = new Date("2023-01-15")

    const pages = {
      "./page1": { title: "Page 1", modified: date1, _meta: { id: "./page1" } },
      "./page2": { title: "Page 2", _meta: { id: "./page2" } }, // undefined modified
      "./page3": { title: "Page 3", modified: date2, _meta: { id: "./page3" } },
    }

    const result = computeSiteLastUpdatedDataView({ pages }, {}, config)

    // Should skip undefined values and return the most recent defined value
    assert.equal(result, date2)
  })
})

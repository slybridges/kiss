const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const { jsonLoader } = require("../../../src/loaders")
const {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createMockConfig,
} = require("../../../test-utils/helpers")

describe("jsonLoader", () => {
  let tempDir
  let config

  beforeEach(() => {
    tempDir = createTempDir()
    config = createMockConfig({
      defaults: {
        pagePublishedAttribute: "created",
        pageUpdatedAttribute: "modified",
      },
    })
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  it("should load JSON file", () => {
    const data = {
      title: "JSON Page",
      description: "A JSON page",
      tags: ["json", "test"],
    }
    const filePath = createTestFile(tempDir, "test.json", JSON.stringify(data))

    const result = jsonLoader(filePath, {}, {}, {}, config)
    assert.equal(result.title, "JSON Page")
    assert.equal(result.description, "A JSON page")
    assert.deepEqual(result.tags, ["json", "test"])
  })

  it("should merge with existing page data", () => {
    const data = {
      title: "New Title",
      newField: "new",
    }
    const filePath = createTestFile(tempDir, "test.json", JSON.stringify(data))
    const existingPage = {
      existingField: "existing",
      title: "Old Title",
    }

    const result = jsonLoader(filePath, {}, existingPage, {}, config)
    assert.equal(result.title, "New Title")
    assert.equal(result.newField, "new")
    assert.equal(result.existingField, "existing")
  })

  it("should parse ISO date strings for published attribute", () => {
    const data = {
      title: "Date Test",
      created: "2024-01-01T12:00:00Z",
      modified: "2024-06-01T12:00:00Z",
    }
    const filePath = createTestFile(tempDir, "test.json", JSON.stringify(data))

    const result = jsonLoader(filePath, {}, {}, {}, config)
    assert.equal(result.title, "Date Test")
    // Now that the typo is fixed, date parsing should work
    assert(result.created instanceof Date)
    assert.equal(result.created.toISOString(), "2024-01-01T12:00:00.000Z")
    assert(result.modified instanceof Date)
    assert.equal(result.modified.toISOString(), "2024-06-01T12:00:00.000Z")
  })

  it("should handle dates that are already Date objects", () => {
    // This would not normally happen with JSON, but testing the logic
    const data = {
      title: "Date Object Test",
      created: new Date("2024-01-01T12:00:00Z"),
      modified: new Date("2024-06-01T12:00:00Z"),
    }
    // We need to stringify and parse to simulate JSON loading
    const jsonData = JSON.stringify({
      title: data.title,
      created: data.created.toISOString(),
      modified: data.modified.toISOString(),
    })
    const filePath = createTestFile(tempDir, "test.json", jsonData)

    const result = jsonLoader(filePath, {}, {}, {}, config)
    // Now both should be parsed as Date objects
    assert(result.created instanceof Date)
    assert.equal(result.created.toISOString(), "2024-01-01T12:00:00.000Z")
    assert(result.modified instanceof Date)
  })

  it("should handle custom date attribute names", () => {
    const customConfig = createMockConfig({
      defaults: {
        pagePublishedAttribute: "publishedAt",
        pageUpdatedAttribute: "updatedAt",
      },
    })

    const data = {
      title: "Custom Attributes",
      publishedAt: "2024-01-01T12:00:00Z",
      updatedAt: "2024-06-01T12:00:00Z",
    }
    const filePath = createTestFile(tempDir, "test.json", JSON.stringify(data))

    const result = jsonLoader(filePath, {}, {}, {}, customConfig)
    // Now both should be parsed as Date objects
    assert(result.publishedAt instanceof Date)
    assert.equal(result.publishedAt.toISOString(), "2024-01-01T12:00:00.000Z")
    assert(result.updatedAt instanceof Date)
  })

  it("should handle nested JSON structures", () => {
    const data = {
      title: "Nested JSON",
      meta: {
        author: "Test Author",
        keywords: ["test", "json", "nested"],
      },
      content: {
        sections: [
          { id: 1, text: "Section 1" },
          { id: 2, text: "Section 2" },
        ],
      },
    }
    const filePath = createTestFile(tempDir, "test.json", JSON.stringify(data))

    const result = jsonLoader(filePath, {}, {}, {}, config)
    assert.equal(result.title, "Nested JSON")
    assert.equal(result.meta.author, "Test Author")
    assert.deepEqual(result.meta.keywords, ["test", "json", "nested"])
    assert.equal(result.content.sections.length, 2)
    assert.equal(result.content.sections[0].text, "Section 1")
  })

  it("should handle empty JSON object", () => {
    const filePath = createTestFile(tempDir, "empty.json", "{}")

    const result = jsonLoader(filePath, {}, { existing: "value" }, {}, config)
    assert.equal(result.existing, "value")
  })

  it("should handle JSON arrays by spreading into object", () => {
    const data = [
      { id: 1, name: "Item 1" },
      { id: 2, name: "Item 2" },
    ]
    const filePath = createTestFile(tempDir, "array.json", JSON.stringify(data))

    const result = jsonLoader(filePath, {}, {}, {}, config)
    // When spreading an array into an object, indices become keys
    assert.equal(typeof result, "object")
    assert(!Array.isArray(result))
    assert.equal(result["0"].name, "Item 1")
    assert.equal(result["1"].name, "Item 2")
  })

  it("should handle various JSON data types", () => {
    const data = {
      string: "text",
      number: 42,
      float: 3.14,
      boolean: true,
      falseValue: false,
      nullValue: null,
      array: [1, 2, 3],
      object: { key: "value" },
    }
    const filePath = createTestFile(tempDir, "types.json", JSON.stringify(data))

    const result = jsonLoader(filePath, {}, {}, {}, config)
    assert.equal(result.string, "text")
    assert.equal(result.number, 42)
    assert.equal(result.float, 3.14)
    assert.equal(result.boolean, true)
    assert.equal(result.falseValue, false)
    assert.equal(result.nullValue, null)
    assert.deepEqual(result.array, [1, 2, 3])
    assert.deepEqual(result.object, { key: "value" })
  })

  it("should handle invalid JSON gracefully", () => {
    const filePath = createTestFile(tempDir, "invalid.json", "{ invalid json }")

    assert.throws(() => {
      jsonLoader(filePath, {}, {}, {}, config)
    }, /JSON/)
  })

  it("should handle special characters in JSON", () => {
    const data = {
      title: "Special Characters: \"quotes\", 'apostrophes', & ampersands",
      unicode: "Unicode: 你好, مرحبا, 🎉",
      escaped: "Escaped: \\n\\t\\\\",
    }
    const filePath = createTestFile(
      tempDir,
      "special.json",
      JSON.stringify(data),
    )

    const result = jsonLoader(filePath, {}, {}, {}, config)
    assert(result.title.includes("quotes"))
    assert(result.unicode.includes("你好"))
    assert(result.escaped.includes("\\n"))
  })
})

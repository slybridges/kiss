const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const { jsLoader } = require("../../../src/loaders")
const {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  clearRequireCache,
} = require("../../../test-utils/helpers")

describe("jsLoader", () => {
  let tempDir

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
    // Clear require cache for test files
    clearRequireCache(tempDir)
  })

  it("should load JavaScript module that exports an object", () => {
    const content = `
      module.exports = {
        title: "JS Page",
        description: "A JavaScript page",
        custom: "value"
      }
    `
    const filePath = createTestFile(tempDir, "test.js", content)

    const result = jsLoader(filePath, {}, {})
    assert.equal(result.title, "JS Page")
    assert.equal(result.description, "A JavaScript page")
    assert.equal(result.custom, "value")
  })

  it("should merge with existing page data", () => {
    const content = `
      module.exports = {
        title: "New Title",
        newField: "new"
      }
    `
    const filePath = createTestFile(tempDir, "test.js", content)
    const existingPage = {
      existingField: "existing",
      title: "Old Title",
    }

    const result = jsLoader(filePath, {}, existingPage)
    assert.equal(result.title, "New Title")
    assert.equal(result.newField, "new")
    assert.equal(result.existingField, "existing")
  })

  it("should handle function exports", () => {
    const content = `
      module.exports = {
        title: "Dynamic Page",
        getDescription: function() {
          return "Generated description"
        },
        compute: () => 42
      }
    `
    const filePath = createTestFile(tempDir, "test.js", content)

    const result = jsLoader(filePath, {}, {})
    assert.equal(result.title, "Dynamic Page")
    assert.equal(typeof result.getDescription, "function")
    assert.equal(result.getDescription(), "Generated description")
    assert.equal(typeof result.compute, "function")
    assert.equal(result.compute(), 42)
  })

  it("should handle nested objects", () => {
    const content = `
      module.exports = {
        title: "Nested",
        meta: {
          author: "Test Author",
          tags: ["javascript", "test"],
          deep: {
            level: 2,
            data: "value"
          }
        }
      }
    `
    const filePath = createTestFile(tempDir, "test.js", content)

    const result = jsLoader(filePath, {}, {})
    assert.equal(result.title, "Nested")
    assert.equal(result.meta.author, "Test Author")
    assert.deepEqual(result.meta.tags, ["javascript", "test"])
    assert.equal(result.meta.deep.level, 2)
    assert.equal(result.meta.deep.data, "value")
  })

  it("should handle Date objects", () => {
    const content = `
      const date = new Date("2024-01-01T00:00:00Z")
      module.exports = {
        created: date,
        modified: new Date("2024-06-01T00:00:00Z")
      }
    `
    const filePath = createTestFile(tempDir, "test.js", content)

    const result = jsLoader(filePath, {}, {})
    assert(result.created instanceof Date)
    assert(result.modified instanceof Date)
    assert.equal(result.created.toISOString(), "2024-01-01T00:00:00.000Z")
    assert.equal(result.modified.toISOString(), "2024-06-01T00:00:00.000Z")
  })

  it("should handle modules with dependencies", () => {
    // Create a dependency module
    const depContent = `
      module.exports = {
        helper: "Helper Value"
      }
    `
    createTestFile(tempDir, "dep.js", depContent)

    // Create main module that requires the dependency
    const content = `
      const dep = require("./dep.js")
      module.exports = {
        title: "With Dependency",
        fromDep: dep.helper
      }
    `
    const filePath = createTestFile(tempDir, "test.js", content)

    const result = jsLoader(filePath, {}, {})
    assert.equal(result.title, "With Dependency")
    assert.equal(result.fromDep, "Helper Value")
  })

  it("should handle empty exports", () => {
    const content = `module.exports = {}`
    const filePath = createTestFile(tempDir, "test.js", content)

    const result = jsLoader(filePath, {}, { existing: "value" })
    assert.equal(result.existing, "value")
  })

  it("should handle various data types", () => {
    const content = `
      module.exports = {
        string: "text",
        number: 42,
        float: 3.14,
        boolean: true,
        falseValue: false,
        nullValue: null,
        undefinedValue: undefined,
        array: [1, 2, 3],
        regexp: /test/gi,
        symbol: Symbol.for("test")
      }
    `
    const filePath = createTestFile(tempDir, "test.js", content)

    const result = jsLoader(filePath, {}, {})
    assert.equal(result.string, "text")
    assert.equal(result.number, 42)
    assert.equal(result.float, 3.14)
    assert.equal(result.boolean, true)
    assert.equal(result.falseValue, false)
    assert.equal(result.nullValue, null)
    assert.equal(result.undefinedValue, undefined)
    assert.deepEqual(result.array, [1, 2, 3])
    assert(result.regexp instanceof RegExp)
    assert.equal(typeof result.symbol, "symbol")
  })

  it("should use absolute path resolution", () => {
    const content = `
      module.exports = {
        title: "Absolute Path Test",
        path: __filename
      }
    `
    const filePath = createTestFile(tempDir, "subdir/test.js", content)

    const result = jsLoader(filePath, {}, {})
    assert.equal(result.title, "Absolute Path Test")
    assert(result.path.includes("subdir"))
    assert(result.path.includes("test.js"))
  })

  it("should handle syntax errors gracefully", () => {
    const content = `
      module.exports = {
        title: "Syntax Error"
        missing: "comma"
      }
    `
    const filePath = createTestFile(tempDir, "error.js", content)

    assert.throws(() => {
      jsLoader(filePath, {}, {})
    }, /SyntaxError|Unexpected/)
  })

  it("should handle runtime errors in module", () => {
    const content = `
      throw new Error("Module error")
      module.exports = {
        title: "Never reached"
      }
    `
    const filePath = createTestFile(tempDir, "error.js", content)

    assert.throws(() => {
      jsLoader(filePath, {}, {})
    }, /Module error/)
  })
})

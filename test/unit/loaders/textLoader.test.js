const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const { textLoader } = require("../../../src/loaders")
const {
  createTempDir,
  cleanupTempDir,
  createTestFile,
} = require("../../../test-utils/helpers")

describe("textLoader", () => {
  let tempDir

  beforeEach(() => {
    tempDir = createTempDir()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  it("should load plain text file without front-matter", () => {
    const content = "This is plain text content"
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.content, content)
  })

  it("should load file with front-matter", () => {
    const content = `---
title: Test Page
description: A test page
tags:
  - test
  - sample
---
This is the body content`
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.title, "Test Page")
    assert.equal(result.description, "A test page")
    assert.deepEqual(result.tags, ["test", "sample"])
    assert.equal(result.content, "This is the body content")
  })

  it("should merge with existing page data", () => {
    const content = `---
title: New Title
newField: value
---
Body content`
    const filePath = createTestFile(tempDir, "test.html", content)
    const existingPage = {
      existingField: "existing",
      title: "Old Title",
    }

    const result = textLoader(filePath, {}, existingPage)
    assert.equal(result.title, "New Title")
    assert.equal(result.newField, "value")
    assert.equal(result.existingField, "existing")
    assert.equal(result.content, "Body content")
  })

  it("should handle empty front-matter", () => {
    const content = `---
---
Just body content`
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.content, "Just body content")
  })

  it("should handle file with only front-matter", () => {
    const content = `---
title: Only Front-Matter
description: No body
---`
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.title, "Only Front-Matter")
    assert.equal(result.description, "No body")
    assert.equal(result.content, "")
  })

  it("should handle empty file", () => {
    const filePath = createTestFile(tempDir, "empty.html", "")

    const result = textLoader(filePath, {}, {})
    assert.equal(result.content, "")
  })

  it("should handle special characters in content", () => {
    const content = `---
title: Special <>&"' Characters
---
Content with special chars: <>&"' and émojis 🎉`
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.title, "Special <>&\"' Characters")
    assert.equal(
      result.content,
      "Content with special chars: <>&\"' and émojis 🎉",
    )
  })

  it("should handle multiline content", () => {
    const content = `---
title: Multiline Test
---
Line 1
Line 2

Paragraph 2

Line 3`
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.content, "Line 1\nLine 2\n\nParagraph 2\n\nLine 3")
  })

  it("should handle complex front-matter data types", () => {
    const content = `---
title: Complex Data
number: 42
float: 3.14
boolean: true
falseValue: false
nullValue: null
date: 2024-01-01
nested:
  key: value
  deep:
    level: 2
array:
  - item1
  - item2
---
Body`
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.title, "Complex Data")
    assert.equal(result.number, 42)
    assert.equal(result.float, 3.14)
    assert.equal(result.boolean, true)
    assert.equal(result.falseValue, false)
    assert.equal(result.nullValue, null)
    assert(result.date instanceof Date)
    assert.equal(result.date.toISOString().split("T")[0], "2024-01-01")
    assert.deepEqual(result.nested, { key: "value", deep: { level: 2 } })
    assert.deepEqual(result.array, ["item1", "item2"])
  })

  it("should not parse content that looks like front-matter but isn't at the start", () => {
    const content = `Some content first
---
title: Not Front-Matter
---
More content`
    const filePath = createTestFile(tempDir, "test.html", content)

    const result = textLoader(filePath, {}, {})
    assert.equal(result.title, undefined)
    assert.equal(result.content, content)
  })
})

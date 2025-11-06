const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const { markdownLoader } = require("../../../src/loaders")
const {
  createTempDir,
  cleanupTempDir,
  createTestFile,
  createMockConfig,
} = require("../../../test-utils/helpers")

describe("markdownLoader", () => {
  let tempDir
  let config

  beforeEach(() => {
    tempDir = createTempDir()
    // Mock the marked library
    config = createMockConfig({
      libs: {
        marked: (content) => {
          // Simple mock that wraps content in paragraph tags
          return `<p>${content.replace(/\n\n/g, "</p><p>")}</p>`
        },
      },
    })
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  it("should load and parse markdown content", () => {
    const content = `---
title: Markdown Test
---
This is **markdown** content`
    const filePath = createTestFile(tempDir, "test.md", content)

    const result = markdownLoader(filePath, {}, {}, null, config)
    assert.equal(result.title, "Markdown Test")
    assert(result.content.includes("<p>"))
    assert(result.content.includes("markdown"))
  })

  it("should handle markdown without front-matter", () => {
    const content = "# Heading\n\nParagraph text"
    const filePath = createTestFile(tempDir, "test.md", content)

    const result = markdownLoader(filePath, {}, {}, null, config)
    assert(result.content.includes("<p>"))
    assert(result.content.includes("Heading"))
  })

  it("should merge with existing page data", () => {
    const content = `---
title: New Title
---
Content`
    const filePath = createTestFile(tempDir, "test.md", content)
    const existingPage = {
      existingField: "value",
      title: "Old Title",
    }

    const result = markdownLoader(filePath, {}, existingPage, null, config)
    assert.equal(result.title, "New Title")
    assert.equal(result.existingField, "value")
    assert(result.content.includes("<p>"))
  })

  it("should handle empty markdown file", () => {
    const filePath = createTestFile(tempDir, "empty.md", "")

    const result = markdownLoader(filePath, {}, {}, null, config)
    assert.equal(result.content, "<p></p>")
  })

  it("should use marked library from config", () => {
    const content = "Test content"
    const filePath = createTestFile(tempDir, "test.md", content)

    // Create config with custom marked implementation
    const customConfig = createMockConfig({
      libs: {
        marked: (content) => `<custom>${content}</custom>`,
      },
    })

    const result = markdownLoader(filePath, {}, {}, null, customConfig)
    assert.equal(result.content, "<custom>Test content</custom>")
  })

  it("should handle complex front-matter in markdown", () => {
    const content = `---
title: Complex
tags:
  - javascript
  - testing
meta:
  author: Test Author
  date: 2024-01-01
draft: false
---
# Content

Paragraph`
    const filePath = createTestFile(tempDir, "test.md", content)

    const result = markdownLoader(filePath, {}, {}, null, config)
    assert.equal(result.title, "Complex")
    assert.deepEqual(result.tags, ["javascript", "testing"])
    assert.equal(result.meta.author, "Test Author")
    assert(result.meta.date instanceof Date)
    assert.equal(result.meta.date.toISOString().split("T")[0], "2024-01-01")
    assert.equal(result.draft, false)
    assert(result.content.includes("Content"))
  })

  it("should preserve special characters in markdown", () => {
    const content = `---
title: Special
---
Code: \`const x = "test"\`
HTML: <div>test</div>
Symbols: & < > " '`
    const filePath = createTestFile(tempDir, "test.md", content)

    const result = markdownLoader(filePath, {}, {}, null, config)
    assert(result.content.includes("const x"))
    assert(result.content.includes("div"))
    assert(result.content.includes("&"))
  })

  it("should handle markdown with code blocks", () => {
    const content = `---
title: Code Example
---
\`\`\`javascript
function test() {
  return "hello"
}
\`\`\`

Normal text`
    const filePath = createTestFile(tempDir, "test.md", content)

    const result = markdownLoader(filePath, {}, {}, null, config)
    assert(result.content.includes("function test"))
    assert(result.content.includes("Normal text"))
  })
})

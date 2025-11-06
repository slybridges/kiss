const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeDescription = require("../../../src/data/computeDescription")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeDescription", () => {
  let config

  beforeEach(() => {
    config = createMockConfig({
      defaults: {
        descriptionLength: 160,
      },
    })
  })

  it("should extract text from HTML content", () => {
    const page = {
      content: "<p>This is a paragraph with some text.</p>",
    }

    const result = computeDescription(page, config)
    assert.equal(result, "This is a paragraph with some text.")
  })

  it("should strip HTML tags", () => {
    const page = {
      content: "<h1>Title</h1><p>This is <strong>important</strong> text.</p>",
    }

    const result = computeDescription(page, config)
    // Cheerio doesn't add spaces between block elements
    assert.equal(result, "TitleThis is important text.")
  })

  it("should truncate long content", () => {
    const longText =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
      "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. " +
      "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris."
    const page = {
      content: `<p>${longText}</p>`,
    }

    const result = computeDescription(page, config)
    assert(result.length <= 160)
    assert(result.endsWith("..."))
  })

  it("should handle empty content", () => {
    const page = {
      content: "",
    }

    const result = computeDescription(page, config)
    assert.equal(result, "")
  })

  it("should handle no content property", () => {
    const page = {}

    const result = computeDescription(page, config)
    assert.equal(result, "")
  })

  it("should handle null content", () => {
    const page = {
      content: null,
    }

    const result = computeDescription(page, config)
    assert.equal(result, "")
  })

  it("should remove multiple spaces and newlines", () => {
    const page = {
      content: "<p>Text   with    multiple\n\n\nspaces   and\nnewlines.</p>",
    }

    const result = computeDescription(page, config)
    assert.equal(result, "Text with multiple spaces and newlines.")
  })

  it("should handle nested HTML structures", () => {
    const page = {
      content: `
        <div>
          <h2>Heading</h2>
          <ul>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
          <p>Paragraph text</p>
        </div>
      `,
    }

    const result = computeDescription(page, config)
    assert(result.includes("Heading"))
    assert(result.includes("Item 1"))
    assert(result.includes("Item 2"))
    assert(result.includes("Paragraph text"))
  })

  it("should respect custom description length", () => {
    config.defaults.descriptionLength = 50
    const page = {
      content:
        "<p>This is a longer piece of text that should be truncated at fifty characters.</p>",
    }

    const result = computeDescription(page, config)
    assert(result.length <= 50)
  })

  it("should handle undefined description length", () => {
    config.defaults.descriptionLength = undefined
    const page = {
      content: "<p>Some content</p>",
    }

    const result = computeDescription(page, config)
    assert.equal(result, "Some content")
  })

  it("should truncate at word boundaries", () => {
    config.defaults.descriptionLength = 20
    const page = {
      content: "<p>This is a test of word boundary truncation</p>",
    }

    const result = computeDescription(page, config)
    assert(result.length <= 20)
    assert(!result.includes("trunca"))
  })

  it("should handle special HTML entities", () => {
    const page = {
      content:
        "<p>Text with &amp; ampersand &lt; less than &gt; greater than</p>",
    }

    const result = computeDescription(page, config)
    assert(result.includes("&"))
    assert(result.includes("<"))
    assert(result.includes(">"))
  })

  it("should handle script and style tags", () => {
    const page = {
      content: `
        <style>body { color: red; }</style>
        <p>Actual content</p>
        <script>console.log('test');</script>
      `,
    }

    const result = computeDescription(page, config)
    assert(result.includes("Actual content"))
    assert(result.includes("body"))
    assert(result.includes("console"))
  })

  it("should check kissDependencies", () => {
    assert(Array.isArray(computeDescription.kissDependencies))
    assert(computeDescription.kissDependencies.includes("content"))
  })
})

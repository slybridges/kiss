const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const {
  relativeToAbsoluteAttributes,
  AT_FILE_ATTRIBUTE_REGEX,
  AT_GENERIC_ATTRIBUTE_REGEX,
} = require("../../../src/helpers")
const {
  createMockPage,
  createMockConfig,
  createTempDir,
  cleanupTempDir,
  createTestFile,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../../test-utils/helpers")

describe("AT_FILE_ATTRIBUTE_REGEX", () => {
  it("should match @file attributes", () => {
    const text = "Here is @file:image.jpg in text"
    const matches = [...text.matchAll(AT_FILE_ATTRIBUTE_REGEX)]
    assert.equal(matches.length, 1)
    assert.equal(matches[0][1], "image.jpg")
  })

  it("should match multiple @file attributes", () => {
    const text = "@file:image1.jpg and @file:image2.png"
    const matches = [...text.matchAll(AT_FILE_ATTRIBUTE_REGEX)]
    assert.equal(matches.length, 2)
    assert.equal(matches[0][1], "image1.jpg")
    assert.equal(matches[1][1], "image2.png")
  })

  it("should handle paths with directories", () => {
    const text = "@file:assets/images/photo.jpg"
    const matches = [...text.matchAll(AT_FILE_ATTRIBUTE_REGEX)]
    assert.equal(matches.length, 1)
    assert.equal(matches[0][1], "assets/images/photo.jpg")
  })

  it("should stop at terminators", () => {
    const text = "@file:image.jpg, @file:photo.png @file:icon.svg"
    const matches = [...text.matchAll(AT_FILE_ATTRIBUTE_REGEX)]
    assert.equal(matches.length, 3)
    assert.equal(matches[0][1], "image.jpg")
    assert.equal(matches[1][1], "photo.png")
    assert.equal(matches[2][1], "icon.svg")
  })

  it("should handle various terminators", () => {
    const tests = [
      ["@file:a.jpg>text", "a.jpg"],
      ["@file:b.jpg<text", "b.jpg"],
      ['@file:c.jpg"text', "c.jpg"],
      ["@file:d.jpg'text", "d.jpg"],
      ["@file:e.jpg]text", "e.jpg"],
      ["@file:f.jpg)text", "f.jpg"],
      ["@file:g.jpg}text", "g.jpg"],
      ["@file:h.jpg#text", "h.jpg"],
    ]

    tests.forEach(([input, expected]) => {
      const matches = [...input.matchAll(AT_FILE_ATTRIBUTE_REGEX)]
      assert.equal(matches[0][1], expected)
    })
  })
})

describe("AT_GENERIC_ATTRIBUTE_REGEX", () => {
  it("should match generic @ attributes", () => {
    const text = "This is @title:MyTitle in text"
    const matches = [...text.matchAll(AT_GENERIC_ATTRIBUTE_REGEX)]
    assert.equal(matches.length, 1)
    assert.equal(matches[0][1], "title")
    assert.equal(matches[0][2], "MyTitle")
  })

  it("should match multiple attributes", () => {
    const text = "@author:John @date:2024-01-01"
    const matches = [...text.matchAll(AT_GENERIC_ATTRIBUTE_REGEX)]
    assert.equal(matches.length, 2)
    assert.equal(matches[0][1], "author")
    assert.equal(matches[0][2], "John")
    assert.equal(matches[1][1], "date")
    assert.equal(matches[1][2], "2024-01-01")
  })

  it("should handle hyphenated attribute names", () => {
    const text = "@meta-description:A description here"
    const matches = [...text.matchAll(AT_GENERIC_ATTRIBUTE_REGEX)]
    assert.equal(matches.length, 1)
    assert.equal(matches[0][1], "meta-description")
    assert.equal(matches[0][2], "A")
  })

  it("should handle various value formats", () => {
    const tests = [
      ["@id:123", "id", "123"],
      ["@url:https://example.com", "url", "https://example.com"],
      ["@path:/blog/post", "path", "/blog/post"],
      ["@tag:javascript", "tag", "javascript"],
    ]

    tests.forEach(([input, expectedAttr, expectedVal]) => {
      const matches = [...input.matchAll(AT_GENERIC_ATTRIBUTE_REGEX)]
      assert.equal(matches[0][1], expectedAttr)
      assert.equal(matches[0][2], expectedVal)
    })
  })
})

describe("relativeToAbsoluteAttributes", () => {
  let tempDir
  let config
  let originalLogger

  beforeEach(() => {
    tempDir = createTempDir()
    config = createMockConfig({
      dirs: { content: path.join(tempDir, "content") },
    })

    // Create content directory
    require("fs").mkdirSync(path.join(tempDir, "content"), { recursive: true })

    // Mock global.logger
    originalLogger = mockGlobalLogger()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
    restoreGlobalLogger(originalLogger)
  })

  it("should convert relative @file to absolute paths", () => {
    createTestFile(tempDir, "content/blog/image.jpg", "")

    const page = createMockPage({
      content: "Here is @file:image.jpg",
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(result.content, "Here is @file:/blog/image.jpg")
  })

  it("should handle multiple @file attributes", () => {
    createTestFile(tempDir, "content/blog/img1.jpg", "")
    createTestFile(tempDir, "content/blog/img2.jpg", "")

    const page = createMockPage({
      content: "@file:img1.jpg and @file:img2.jpg",
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(
      result.content,
      "@file:/blog/img1.jpg and @file:/blog/img2.jpg",
    )
  })

  it("should handle nested paths", () => {
    createTestFile(tempDir, "content/assets/image.jpg", "")

    const page = createMockPage({
      content: "@file:../assets/image.jpg",
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(result.content, "@file:/assets/image.jpg")
  })

  it("should handle already absolute paths", () => {
    createTestFile(tempDir, "content/assets/image.jpg", "")

    const page = createMockPage({
      content: "@file:/assets/image.jpg",
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(result.content, "@file:/assets/image.jpg")
  })

  it("should handle directories", () => {
    createTestFile(tempDir, "content/blog/image.jpg", "")

    const page = createMockPage({
      content: "@file:image.jpg",
      _meta: {
        inputPath: path.join(tempDir, "content/blog"),
        isDirectory: true,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(result.content, "@file:/blog/image.jpg")
  })

  it("should handle nested objects", () => {
    createTestFile(tempDir, "content/blog/image.jpg", "")

    const page = createMockPage({
      nested: {
        content: "@file:image.jpg",
        deeper: {
          text: "@file:image.jpg",
        },
      },
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(result.nested.content, "@file:/blog/image.jpg")
    assert.equal(result.nested.deeper.text, "@file:/blog/image.jpg")
  })

  it("should handle arrays", () => {
    createTestFile(tempDir, "content/blog/image.jpg", "")

    const page = createMockPage({
      items: ["@file:image.jpg", { text: "@file:image.jpg" }],
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(result.items[0], "@file:/blog/image.jpg")
    assert.equal(result.items[1].text, "@file:/blog/image.jpg")
  })

  it("should warn for non-existent files", () => {
    let warnMessage = ""
    global.logger.warn = (msg) => {
      warnMessage = msg
    }

    const page = createMockPage({
      content: "@file:missing.jpg",
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    relativeToAbsoluteAttributes(page, {}, config)
    assert(warnMessage.includes("@file not found"))
    assert(warnMessage.includes("missing.jpg"))
  })

  it("should not modify non-@file attributes", () => {
    const page = createMockPage({
      content: "Regular text with @other:value",
      title: "Test Title",
      number: 42,
      _meta: {
        inputPath: path.join(tempDir, "content/blog/post.md"),
        isDirectory: false,
      },
    })

    const result = relativeToAbsoluteAttributes(page, {}, config)
    assert.equal(result.content, "Regular text with @other:value")
    assert.equal(result.title, "Test Title")
    assert.equal(result.number, 42)
  })
})

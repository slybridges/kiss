const { describe, it } = require("node:test")
const assert = require("assert/strict")
const { staticLoader } = require("../../../src/loaders")

describe("staticLoader", () => {
  it("should preserve permalink and set output type", () => {
    const page = {
      permalink: "/assets/image.jpg",
      _meta: {
        id: "./assets/image",
        parent: "./assets",
        children: [],
        descendants: [],
        isCollection: false,
        isPost: false,
        ascendants: [".", "./assets"],
      },
    }

    const result = staticLoader("/path/to/image.jpg", {}, page)
    assert.equal(result.permalink, "/assets/image.jpg")
    assert.equal(result._meta.outputType, "STATIC")
  })

  it("should use custom outputType from options", () => {
    const page = {
      permalink: "/assets/image.jpg",
      _meta: {
        id: "./assets/image",
        parent: "./assets",
      },
    }

    const result = staticLoader(
      "/path/to/image.jpg",
      { outputType: "IMAGE" },
      page,
    )
    assert.equal(result._meta.outputType, "IMAGE")
  })

  it("should remove relationship metadata", () => {
    const page = {
      permalink: "/file.pdf",
      _meta: {
        id: "./file",
        parent: ".",
        ascendants: ["."],
        children: ["./file/child"],
        descendants: ["./file/child", "./file/child/grandchild"],
        isCollection: true,
        isPost: true,
        otherField: "preserved",
      },
    }

    const result = staticLoader("/path/to/file.pdf", {}, page)

    // Should be removed
    assert.equal(result._meta.ascendants, undefined)
    assert.equal(result._meta.children, undefined)
    assert.equal(result._meta.descendants, undefined)
    assert.equal(result._meta.isCollection, undefined)
    assert.equal(result._meta.isPost, undefined)

    // Should be preserved
    assert.equal(result._meta.id, "./file")
    assert.equal(result._meta.parent, ".")
    assert.equal(result._meta.otherField, "preserved")
  })

  it("should handle minimal page object", () => {
    const page = {
      permalink: "/minimal.txt",
      _meta: {},
    }

    const result = staticLoader("/path/to/minimal.txt", {}, page)
    assert.equal(result.permalink, "/minimal.txt")
    assert.equal(result._meta.outputType, "STATIC")
  })

  it("should not include content or other page fields", () => {
    const page = {
      permalink: "/doc.pdf",
      title: "Document Title",
      content: "Some content",
      customField: "value",
      _meta: {
        id: "./doc",
      },
    }

    const result = staticLoader("/path/to/doc.pdf", {}, page)
    assert.equal(result.permalink, "/doc.pdf")
    assert.equal(result.title, undefined)
    assert.equal(result.content, undefined)
    assert.equal(result.customField, undefined)
  })

  it("should handle complex metadata", () => {
    const page = {
      permalink: "/complex/path/file.zip",
      _meta: {
        id: "./complex/path/file",
        parent: "./complex/path",
        inputPath: "content/complex/path/file.zip",
        basename: "file.zip",
        source: "file",
        buildVersion: 1,
        // These should be removed
        ascendants: [".", "./complex", "./complex/path"],
        children: [],
        descendants: [],
        isCollection: false,
        isPost: false,
        // Custom fields should be preserved
        customMeta1: "value1",
        customMeta2: { nested: "object" },
      },
    }

    const result = staticLoader("/path/to/file.zip", {}, page)

    // Preserved fields
    assert.equal(result._meta.id, "./complex/path/file")
    assert.equal(result._meta.parent, "./complex/path")
    assert.equal(result._meta.inputPath, "content/complex/path/file.zip")
    assert.equal(result._meta.basename, "file.zip")
    assert.equal(result._meta.source, "file")
    assert.equal(result._meta.buildVersion, 1)
    assert.equal(result._meta.customMeta1, "value1")
    assert.deepEqual(result._meta.customMeta2, { nested: "object" })

    // Removed fields
    assert.equal(result._meta.ascendants, undefined)
    assert.equal(result._meta.children, undefined)
    assert.equal(result._meta.descendants, undefined)
    assert.equal(result._meta.isCollection, undefined)
    assert.equal(result._meta.isPost, undefined)
  })

  it("should default to STATIC output type", () => {
    const page = {
      permalink: "/file.txt",
      _meta: {},
    }

    const result = staticLoader("/path/to/file.txt", {}, page)
    assert.equal(result._meta.outputType, "STATIC")
  })

  it("should handle undefined options", () => {
    const page = {
      permalink: "/file.txt",
      _meta: { id: "./file" },
    }

    const result = staticLoader("/path/to/file.txt", undefined, page)
    assert.equal(result.permalink, "/file.txt")
    assert.equal(result._meta.outputType, "STATIC")
  })
})

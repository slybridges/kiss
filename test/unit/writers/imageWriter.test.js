const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const fs = require("fs-extra")
const path = require("path")
const { createTempDir, cleanupTempDir } = require("../../../test-utils/helpers")

// Mock sharp module
const mockSharp = {
  instances: [],
  create: function (inputPath) {
    const instance = {
      inputPath,
      operations: [],
      clone: function () {
        const cloned = mockSharp.create(this.inputPath)
        cloned.operations = [...this.operations]
        return cloned
      },
      resize: function (options) {
        this.operations.push({ type: "resize", options })
        return this
      },
      jpeg: function (options) {
        this.operations.push({ type: "format", format: "jpeg", options })
        return this
      },
      png: function (options) {
        this.operations.push({ type: "format", format: "png", options })
        return this
      },
      webp: function (options) {
        this.operations.push({ type: "format", format: "webp", options })
        return this
      },
      toFile: async function (outputPath) {
        // Mock creating the output file
        await fs.ensureDir(path.dirname(outputPath))
        await fs.writeFile(
          outputPath,
          `mock-image-data-${path.basename(outputPath)}`,
        )
        return { format: "jpeg", width: 800, height: 600 }
      },
    }
    mockSharp.instances.push(instance)
    return instance
  },
}

// Mock the staticWriter
const mockStaticWriter = async (page) => {
  await fs.copy(page._meta.inputPath, page._meta.outputPath)
}

// Override the real modules
require.cache[require.resolve("sharp")] = { exports: mockSharp.create }
require.cache[require.resolve("../../../src/writers/staticWriter")] = {
  exports: mockStaticWriter,
}

// Now require imageWriter after mocks are set up
const imageWriter = require("../../../src/writers/imageWriter")

describe("imageWriter", () => {
  let tempDir
  let inputDir
  let outputDir

  beforeEach(() => {
    tempDir = createTempDir()
    inputDir = path.join(tempDir, "input")
    outputDir = path.join(tempDir, "output")
    fs.ensureDirSync(inputDir)
    fs.ensureDirSync(outputDir)

    // Reset mock instances
    mockSharp.instances = []
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
  })

  it("should copy image when no derivatives are specified", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath = path.join(outputDir, "image.jpg")

    // Create a mock input image
    await fs.writeFile(inputPath, "mock-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: outputPath,
      },
    }

    await imageWriter(page, {})

    const exists = await fs.pathExists(outputPath)
    assert.ok(exists, "Image should be copied")

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, "mock-image-data")
  })

  it("should process image derivatives", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath1 = path.join(outputDir, "image-small.webp")
    const outputPath2 = path.join(outputDir, "image-large.jpg")

    // Create a mock input image
    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: outputPath1,
          format: "webp",
          formatOptions: { quality: 80 },
          resize: { width: 400 },
        },
        {
          outputPath: outputPath2,
          format: "jpeg",
          formatOptions: { quality: 90 },
          resize: { width: 800, height: 600 },
        },
      ],
    }

    await imageWriter(page, {})

    // Check that output files were created
    assert.ok(await fs.pathExists(outputPath1), "WebP derivative should exist")
    assert.ok(await fs.pathExists(outputPath2), "JPEG derivative should exist")

    // Check Sharp was called correctly (1 source + 2 clones)
    assert.equal(
      mockSharp.instances.length,
      3,
      "Sharp should be instantiated once for source and cloned for each derivative",
    )
    // All instances should use the same input path
    mockSharp.instances.forEach((instance) => {
      assert.equal(instance.inputPath, inputPath)
    })
  })

  it("should skip existing derivatives when overwrite is false", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath1 = path.join(outputDir, "existing.webp")
    const outputPath2 = path.join(outputDir, "new.webp")

    // Create input and one existing output
    await fs.writeFile(inputPath, "original-image-data")
    await fs.writeFile(outputPath1, "existing-derivative")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: outputPath1,
          format: "webp",
          formatOptions: { quality: 80 },
        },
        {
          outputPath: outputPath2,
          format: "webp",
          formatOptions: { quality: 80 },
        },
      ],
    }

    await imageWriter(page, { overwrite: false })

    // Existing file should not be overwritten
    const existingContent = await fs.readFile(outputPath1, "utf-8")
    assert.equal(existingContent, "existing-derivative")

    // New file should be created
    assert.ok(await fs.pathExists(outputPath2))
  })

  it("should overwrite existing derivatives when overwrite is true", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath = path.join(outputDir, "existing.webp")

    // Create input and existing output
    await fs.writeFile(inputPath, "original-image-data")
    await fs.writeFile(outputPath, "old-derivative")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: outputPath,
          format: "webp",
          formatOptions: { quality: 80 },
        },
      ],
    }

    await imageWriter(page, { overwrite: true })

    // File should be overwritten
    const content = await fs.readFile(outputPath, "utf-8")
    assert.notEqual(content, "old-derivative")
    assert.ok(content.includes("mock-image-data"))
  })

  it("should create output directories for derivatives", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath = path.join(
      outputDir,
      "nested",
      "deep",
      "folder",
      "image.webp",
    )

    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: outputPath,
          format: "webp",
          formatOptions: { quality: 80 },
        },
      ],
    }

    await imageWriter(page, {})

    assert.ok(
      await fs.pathExists(outputPath),
      "Nested output should be created",
    )
    assert.ok(
      await fs.pathExists(path.dirname(outputPath)),
      "Nested directories should be created",
    )
  })

  it("should handle multiple format operations", async () => {
    const inputPath = path.join(inputDir, "image.jpg")

    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: path.join(outputDir, "image.webp"),
          format: "webp",
          formatOptions: { quality: 80 },
        },
        {
          outputPath: path.join(outputDir, "image.png"),
          format: "png",
          formatOptions: { compressionLevel: 6 },
        },
      ],
    }

    await imageWriter(page, {})

    // Check that all derivatives were created
    assert.ok(await fs.pathExists(path.join(outputDir, "image.webp")))
    assert.ok(await fs.pathExists(path.join(outputDir, "image.png")))
  })

  it("should handle derivatives without resize", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath = path.join(outputDir, "image.webp")

    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: outputPath,
          format: "webp",
          formatOptions: { quality: 80 },
          // No resize specified
        },
      ],
    }

    await imageWriter(page, {})

    assert.ok(await fs.pathExists(outputPath))

    // Verify no resize operation was performed
    const sharpInstance = mockSharp.instances[0]
    const resizeOps = sharpInstance.operations.filter(
      (op) => op.type === "resize",
    )
    assert.equal(
      resizeOps.length,
      0,
      "No resize operations should be performed",
    )
  })

  it("should handle derivatives without format options", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath = path.join(outputDir, "image.webp")

    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: outputPath,
          format: "webp",
          // No formatOptions specified
        },
      ],
    }

    await imageWriter(page, {})

    assert.ok(await fs.pathExists(outputPath))
  })

  it("should handle empty derivatives array", async () => {
    const inputPath = path.join(inputDir, "image.jpg")
    const outputPath = path.join(outputDir, "image.jpg")

    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: outputPath,
      },
      derivatives: [],
    }

    const result = await imageWriter(page, {})

    // Should return empty array since no derivatives to process
    assert.deepEqual(result, [])
  })

  it("should clone sharp instance for each derivative", async () => {
    const inputPath = path.join(inputDir, "image.jpg")

    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: path.join(outputDir, "derivative1.webp"),
          format: "webp",
          formatOptions: { quality: 80 },
          resize: { width: 400 },
        },
        {
          outputPath: path.join(outputDir, "derivative2.jpg"),
          format: "jpeg",
          formatOptions: { quality: 90 },
          resize: { width: 800 },
        },
      ],
    }

    await imageWriter(page, {})

    // Each derivative should process independently
    assert.ok(await fs.pathExists(path.join(outputDir, "derivative1.webp")))
    assert.ok(await fs.pathExists(path.join(outputDir, "derivative2.jpg")))
  })

  it("should handle complex resize options", async () => {
    const inputPath = path.join(inputDir, "image.jpg")

    await fs.writeFile(inputPath, "original-image-data")

    const page = {
      _meta: {
        inputPath: inputPath,
        outputPath: path.join(outputDir, "image.jpg"),
      },
      derivatives: [
        {
          outputPath: path.join(outputDir, "resized.webp"),
          format: "webp",
          formatOptions: { quality: 80 },
          resize: {
            width: 400,
            height: 300,
            fit: "cover",
            position: "center",
          },
        },
      ],
    }

    await imageWriter(page, {})

    assert.ok(await fs.pathExists(path.join(outputDir, "resized.webp")))
  })
})

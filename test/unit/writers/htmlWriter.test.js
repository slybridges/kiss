const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const fs = require("fs-extra")
const path = require("path")
const htmlWriter = require("../../../src/writers/htmlWriter")
const {
  createTempDir,
  cleanupTempDir,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../../test-utils/helpers")

describe("htmlWriter", () => {
  let tempDir
  let originalLogger

  beforeEach(() => {
    tempDir = createTempDir()
    originalLogger = mockGlobalLogger()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
    restoreGlobalLogger(originalLogger)
  })

  it("should write HTML content to output path", async () => {
    const outputPath = path.join(tempDir, "output.html")
    const page = {
      _html: "<html><body><h1>Test Page</h1></body></html>",
      _meta: {
        inputPath: "test.md",
        outputPath: outputPath,
      },
    }

    await htmlWriter(page)

    const exists = await fs.pathExists(outputPath)
    assert.ok(exists, "Output file should exist")

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, page._html)
  })

  it("should create output directory if it doesn't exist", async () => {
    const outputDir = path.join(tempDir, "nested", "directory")
    const outputPath = path.join(outputDir, "output.html")
    const page = {
      _html: "<html><body><h1>Nested Page</h1></body></html>",
      _meta: {
        inputPath: "nested.md",
        outputPath: outputPath,
      },
    }

    await htmlWriter(page)

    const exists = await fs.pathExists(outputPath)
    assert.ok(exists, "Output file should exist in nested directory")

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, page._html)
  })

  it("should warn and skip when page has no _html content", async () => {
    let warnMessage = ""
    global.logger.warn = (message) => {
      warnMessage = message
    }

    const page = {
      _meta: {
        inputPath: "empty.md",
        outputPath: path.join(tempDir, "empty.html"),
      },
    }

    const result = await htmlWriter(page)

    assert.equal(result, undefined)
    assert.ok(warnMessage.includes("has no _html content"))
    assert.ok(warnMessage.includes("empty.md"))

    const exists = await fs.pathExists(page._meta.outputPath)
    assert.equal(exists, false, "No file should be created")
  })

  it("should warn and skip when page has empty _html content", async () => {
    let warnMessage = ""
    global.logger.warn = (message) => {
      warnMessage = message
    }

    const page = {
      _html: "",
      _meta: {
        inputPath: "empty.md",
        outputPath: path.join(tempDir, "empty.html"),
      },
    }

    const result = await htmlWriter(page)

    assert.equal(result, undefined)
    assert.ok(warnMessage.includes("has no _html content"))

    const exists = await fs.pathExists(page._meta.outputPath)
    assert.equal(exists, false, "No file should be created")
  })

  it("should warn and skip when page has null _html content", async () => {
    let warnMessage = ""
    global.logger.warn = (message) => {
      warnMessage = message
    }

    const page = {
      _html: null,
      _meta: {
        inputPath: "null.md",
        outputPath: path.join(tempDir, "null.html"),
      },
    }

    const result = await htmlWriter(page)

    assert.equal(result, undefined)
    assert.ok(warnMessage.includes("has no _html content"))

    const exists = await fs.pathExists(page._meta.outputPath)
    assert.equal(exists, false, "No file should be created")
  })

  it("should handle complex HTML content", async () => {
    const complexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Complex Page</title>
    <style>
        body { font-family: Arial, sans-serif; }
        .highlight { background-color: yellow; }
    </style>
</head>
<body>
    <header>
        <h1>Welcome to My Site</h1>
        <nav>
            <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/about">About</a></li>
            </ul>
        </nav>
    </header>
    <main>
        <article>
            <h2>Article Title</h2>
            <p>This is a <span class="highlight">highlighted</span> paragraph.</p>
            <pre><code>console.log('Hello, World!');</code></pre>
        </article>
    </main>
    <footer>
        <p>&copy; 2023 My Website</p>
    </footer>
    <script>
        console.log('Page loaded');
    </script>
</body>
</html>`

    const outputPath = path.join(tempDir, "complex.html")
    const page = {
      _html: complexHtml,
      _meta: {
        inputPath: "complex.md",
        outputPath: outputPath,
      },
    }

    await htmlWriter(page)

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, complexHtml)
  })

  it("should overwrite existing files", async () => {
    const outputPath = path.join(tempDir, "overwrite.html")

    // Create initial file
    await fs.writeFile(outputPath, "Initial content")

    const page = {
      _html: "<html><body><h1>New Content</h1></body></html>",
      _meta: {
        inputPath: "overwrite.md",
        outputPath: outputPath,
      },
    }

    await htmlWriter(page)

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, page._html)
    assert.notEqual(content, "Initial content")
  })

  it("should handle Unicode and special characters", async () => {
    const unicodeHtml = `<html>
<head><meta charset="UTF-8"></head>
<body>
    <h1>Unicode Test 🚀</h1>
    <p>Special chars: áéíóú ñ ü</p>
    <p>Symbols: © ® ™ € £ ¥</p>
    <p>Math: ∑ ∞ π ≈ ≠</p>
    <p>Quotes: "Hello" 'World' « Bonjour » ‹ Salut ›</p>
    <p>Dashes: – — ...</p>
</body>
</html>`

    const outputPath = path.join(tempDir, "unicode.html")
    const page = {
      _html: unicodeHtml,
      _meta: {
        inputPath: "unicode.md",
        outputPath: outputPath,
      },
    }

    await htmlWriter(page)

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, unicodeHtml)
  })

  it("should handle very large HTML files", async () => {
    // Generate a large HTML content (about 1MB)
    const largeContent =
      "<html><body>" +
      "<p>Large content test. ".repeat(44000) +
      "</p></body></html>"

    const outputPath = path.join(tempDir, "large.html")
    const page = {
      _html: largeContent,
      _meta: {
        inputPath: "large.md",
        outputPath: outputPath,
      },
    }

    await htmlWriter(page)

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, largeContent)

    const stats = await fs.stat(outputPath)
    assert.ok(stats.size > 1000000, "File should be larger than 1MB")
  })

  it("should return the result of outputFile", async () => {
    const outputPath = path.join(tempDir, "return-test.html")
    const page = {
      _html: "<html><body>Test</body></html>",
      _meta: {
        inputPath: "test.md",
        outputPath: outputPath,
      },
    }

    const result = await htmlWriter(page)

    // fs-extra's outputFile returns undefined on success
    assert.equal(result, undefined)
  })

  it("should handle whitespace-only HTML content as valid", async () => {
    const outputPath = path.join(tempDir, "whitespace.html")
    const page = {
      _html: "   \n  \t  \n   ",
      _meta: {
        inputPath: "whitespace.md",
        outputPath: outputPath,
      },
    }

    await htmlWriter(page)

    const exists = await fs.pathExists(outputPath)
    assert.ok(exists, "Whitespace-only HTML should still be written")

    const content = await fs.readFile(outputPath, "utf-8")
    assert.equal(content, page._html)
  })
})

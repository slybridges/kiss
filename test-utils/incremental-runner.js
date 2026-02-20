#!/usr/bin/env node

/**
 * Incremental Build Test Runner
 *
 * This script runs incremental build tests using a direct Node.js approach
 * rather than the node:test framework. This is necessary because:
 *
 * 1. The build process creates complex async operations (file I/O, template rendering, etc.)
 * 2. node:test doesn't properly exit when there are pending timers or event listeners
 * 3. The build modifies global state (require cache, global.logger) that interferes with test isolation
 * 4. Direct execution is faster and more reliable for integration tests
 *
 * Each test:
 * - Creates isolated output directory
 * - Runs initial build
 * - Modifies fixture files
 * - Runs incremental build
 * - Verifies output via sitedata.json
 * - Cleans up and restores files
 * - Explicitly exits to prevent hanging
 *
 * NOTE: This file is run by test/integration/incremental.test.js (the wrapper) via spawn().
 * It's placed in test-utils/ (outside test/) so node:test won't discover and run it directly.
 */

const build = require("../src/build")
const fs = require("fs-extra")
const path = require("path")

const fixtureDir = path.resolve(__dirname, "../test/integration/repo")
const originalCwd = process.cwd()

// Track test results
let passed = 0
let failed = 0
const failures = []
let testNumber = 0
const startTime = Date.now()

// Helper to create temp dir
function createTempDir() {
  return fs.mkdtempSync(path.join(require("os").tmpdir(), "kiss-incr-test-"))
}

// Helper to assert
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

// Get verbosity setting from environment
// Default to 'error' for minimal output during tests (only show errors)
// Valid choices: "log", "info", "success", "warn", "error"
const verbosity = process.env.VERBOSITY || "error"
const showTestProgress = ["log", "info", "success"].includes(verbosity)

// Test runner - matches node:test output format
async function runTest(name, testFn) {
  testNumber++
  const testStart = Date.now()

  // Show test location and name
  console.log(`# Subtest: ${name}`)

  try {
    await testFn()
    const duration = Date.now() - testStart
    passed++

    // Format: ok {number} - {name} ({duration}ms)
    console.log(`ok ${testNumber} - ${name} (${duration}ms)`)

    if (showTestProgress) {
      console.log("  ---")
      console.log(`  duration_ms: ${duration}`)
      console.log("  ...")
    }
  } catch (error) {
    const duration = Date.now() - testStart
    failed++

    // Format: not ok {number} - {name} ({duration}ms)
    console.log(`not ok ${testNumber} - ${name} (${duration}ms)`)
    console.log("  ---")
    console.log(`  duration_ms: ${duration}`)
    console.log(`  failureType: 'testCodeFailure'`)
    console.log(`  error: '${error.message}'`)
    console.log(`  code: 'ERR_ASSERTION'`)
    if (showTestProgress) {
      console.log("  stack: |-")
      const stackLines = error.stack.split("\n")
      stackLines.forEach((line) => console.log(`    ${line}`))
    }
    console.log("  ...")

    failures.push({
      name,
      error: error.message,
      stack: error.stack,
      duration,
    })
  }
}

// Main test suite
async function runTests() {
  if (showTestProgress) {
    console.log("\nIncremental Build Integration Tests\n")
  }

  // Test 1: Single page content update
  await runTest(
    "should update only about.html when content changes",
    async () => {
      const outputDir = createTempDir()
      process.chdir(fixtureDir)
      process.env.TEST_PUBLIC_DIR = outputDir

      const aboutPath = path.join(fixtureDir, "content/about.html")
      const originalContent = await fs.readFile(aboutPath, "utf8")

      try {
        // Initial build with incremental mode enabled
        const initialResult = await build({
          configFile: "kiss.config.js",
          verbosity,
          incremental: true,
        })

        // Modify file
        const newContent = originalContent.replace(
          "<h1>About kiss</h1>",
          "<h1>About kiss - Updated</h1>",
        )
        await fs.writeFile(aboutPath, newContent)

        // Incremental build
        await build(
          {
            configFile: "kiss.config.js",
            verbosity,
            incremental: true,
            event: "change",
            file: "content/about.html",
          },
          initialResult,
          1,
        )

        // Verify via sitedata.json
        const sitedata = JSON.parse(
          await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
        )
        const aboutPage = Object.values(sitedata.pages).find(
          (p) => p._meta.id === "./about.html",
        )

        assert(aboutPage, "About page should exist in sitedata")
        assert(
          await fs.pathExists(aboutPage._meta.outputPath),
          "Output file should exist",
        )

        const builtHtml = await fs.readFile(aboutPage._meta.outputPath, "utf8")
        assert(
          builtHtml.includes("About kiss - Updated"),
          "Output HTML should contain updated content",
        )
      } finally {
        await fs.writeFile(aboutPath, originalContent)
        await fs.remove(outputDir)
      }
    },
  )

  // Test 2: Index.js cascade
  await runTest(
    "should cascade changes to all descendants when root index.js changes",
    async () => {
      const outputDir = createTempDir()
      process.chdir(fixtureDir)
      process.env.TEST_PUBLIC_DIR = outputDir

      const indexPath = path.join(fixtureDir, "content/index.js")
      const originalContent = await fs.readFile(indexPath, "utf8")

      try {
        const initialResult = await build({
          configFile: "kiss.config.js",
          verbosity,
          incremental: true,
        })

        // Modify root index.js
        const newContent = originalContent.replace(
          'attributeA: "IndexAttributeA"',
          'attributeA: "IndexAttributeA-Modified"',
        )
        await fs.writeFile(indexPath, newContent)

        // Clear require cache (mimics devServer behavior)
        Object.keys(require.cache).forEach((key) => {
          if (
            key.startsWith(path.resolve("./")) &&
            !key.includes("node_modules")
          ) {
            delete require.cache[key]
          }
        })

        await build(
          {
            configFile: "kiss.config.js",
            verbosity,
            incremental: true,
            event: "change",
            file: "content/index.js",
          },
          initialResult,
          1,
        )

        const sitedata = JSON.parse(
          await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
        )
        const aboutPage = Object.values(sitedata.pages).find(
          (p) => p._meta.id === "./about.html",
        )
        const blogPage = Object.values(sitedata.pages).find(
          (p) => p._meta.id === "./blog/simple.md",
        )

        assert(aboutPage && blogPage, "Pages should exist")
        assert(
          aboutPage.attributeA === "IndexAttributeA-Modified",
          "About should inherit updated attribute",
        )
        assert(
          blogPage.attributeA === "IndexAttributeA-Modified",
          "Blog should inherit updated attribute",
        )
      } finally {
        await fs.writeFile(indexPath, originalContent)
        await fs.remove(outputDir)
      }
    },
  )

  // Test 3: Post.md without cascade
  await runTest(
    "should NOT cascade to children when root post.md changes",
    async () => {
      const outputDir = createTempDir()
      process.chdir(fixtureDir)
      process.env.TEST_PUBLIC_DIR = outputDir

      const postPath = path.join(fixtureDir, "content/post.md")
      const originalContent = await fs.readFile(postPath, "utf8")

      try {
        const initialResult = await build({
          configFile: "kiss.config.js",
          verbosity,
          incremental: true,
        })

        const newContent = originalContent.replace(
          'attributeB: "PostAttributeB"',
          'attributeB: "PostAttributeB-Modified"',
        )
        await fs.writeFile(postPath, newContent)

        Object.keys(require.cache).forEach((key) => {
          if (
            key.startsWith(path.resolve("./")) &&
            !key.includes("node_modules")
          ) {
            delete require.cache[key]
          }
        })

        await build(
          {
            configFile: "kiss.config.js",
            verbosity,
            incremental: true,
            event: "change",
            file: "content/post.md",
          },
          initialResult,
          1,
        )

        const sitedata = JSON.parse(
          await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
        )
        const rootPage = Object.values(sitedata.pages).find(
          (p) => p._meta.id === ".",
        )
        const aboutPage = Object.values(sitedata.pages).find(
          (p) => p._meta.id === "./about.html",
        )

        assert(
          rootPage.attributeB === "PostAttributeB-Modified",
          "Root should have updated attribute",
        )
        assert(
          aboutPage.attributeB !== "PostAttributeB-Modified",
          "About should NOT inherit post.md changes",
        )
      } finally {
        await fs.writeFile(postPath, originalContent)
        await fs.remove(outputDir)
      }
    },
  )

  // Test 4: Blog index.md cascade
  await runTest(
    "should cascade to blog articles only when blog/index.md changes",
    async () => {
      const outputDir = createTempDir()
      process.chdir(fixtureDir)
      process.env.TEST_PUBLIC_DIR = outputDir

      const blogIndexPath = path.join(fixtureDir, "content/blog/index.md")
      const originalContent = await fs.readFile(blogIndexPath, "utf8")

      try {
        const initialResult = await build({
          configFile: "kiss.config.js",
          verbosity,
          incremental: true,
        })

        const newContent = originalContent.replace(
          "blogAttr: blog-index-value",
          "blogAttr: blog-index-modified",
        )
        await fs.writeFile(blogIndexPath, newContent)

        Object.keys(require.cache).forEach((key) => {
          if (
            key.startsWith(path.resolve("./")) &&
            !key.includes("node_modules")
          ) {
            delete require.cache[key]
          }
        })

        await build(
          {
            configFile: "kiss.config.js",
            verbosity,
            incremental: true,
            event: "change",
            file: "content/blog/index.md",
          },
          initialResult,
          1,
        )

        const sitedata = JSON.parse(
          await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
        )
        const blogPage = Object.values(sitedata.pages).find(
          (p) => p._meta.id === "./blog/simple.md",
        )
        const aboutPage = Object.values(sitedata.pages).find(
          (p) => p._meta.id === "./about.html",
        )

        assert(
          blogPage.blogAttr === "blog-index-modified",
          "Blog article should inherit updated attribute",
        )
        assert(
          aboutPage.blogAttr === undefined,
          "About should not have blog attribute",
        )
      } finally {
        await fs.writeFile(blogIndexPath, originalContent)
        await fs.remove(outputDir)
      }
    },
  )

  // Test 5: Add new article
  await runTest("should add new article with correct inheritance", async () => {
    const outputDir = createTempDir()
    process.chdir(fixtureDir)
    process.env.TEST_PUBLIC_DIR = outputDir

    const newArticlePath = path.join(fixtureDir, "content/blog/new-article.md")

    try {
      const initialResult = await build({
        configFile: "kiss.config.js",
        verbosity,
        incremental: true,
      })

      await fs.writeFile(
        newArticlePath,
        `---
title: New Article
---

New content.
`,
      )

      Object.keys(require.cache).forEach((key) => {
        if (
          key.startsWith(path.resolve("./")) &&
          !key.includes("node_modules")
        ) {
          delete require.cache[key]
        }
      })

      await build(
        {
          configFile: "kiss.config.js",
          verbosity,
          incremental: true,
          event: "add",
          file: "content/blog/new-article.md",
        },
        initialResult,
        1,
      )

      const sitedata = JSON.parse(
        await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
      )
      const newArticle = Object.values(sitedata.pages).find(
        (p) => p._meta.id === "./blog/new-article.md",
      )

      assert(newArticle, "New article should exist")
      assert(
        newArticle.title === "New Article",
        "New article should have correct title",
      )
      assert(
        newArticle.blogAttr === "blog-index-value",
        "New article should inherit from blog/index.md",
      )
      assert(
        await fs.pathExists(newArticle._meta.outputPath),
        "Output file should exist",
      )
    } finally {
      if (await fs.pathExists(newArticlePath)) {
        await fs.remove(newArticlePath)
      }
      await fs.remove(outputDir)
    }
  })

  // Test 6: Delete article (triggers full rebuild)
  await runTest("should trigger full rebuild on unlink event", async () => {
    const outputDir = createTempDir()
    process.chdir(fixtureDir)
    process.env.TEST_PUBLIC_DIR = outputDir

    const tempArticlePath = path.join(
      fixtureDir,
      "content/blog/temp-article.md",
    )

    try {
      // Create temp article first
      await fs.writeFile(
        tempArticlePath,
        `---
title: Temp Article
---

Will be deleted.
`,
      )

      const initialResult = await build({
        configFile: "kiss.config.js",
        verbosity,
        incremental: true,
      })

      // Verify it exists
      const beforeSitedata = JSON.parse(
        await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
      )
      const tempArticle = Object.values(beforeSitedata.pages).find(
        (p) => p._meta.id === "./blog/temp-article.md",
      )
      assert(tempArticle, "Temp article should exist before deletion")

      // Delete it
      await fs.remove(tempArticlePath)

      Object.keys(require.cache).forEach((key) => {
        if (
          key.startsWith(path.resolve("./")) &&
          !key.includes("node_modules")
        ) {
          delete require.cache[key]
        }
      })

      await build(
        {
          configFile: "kiss.config.js",
          verbosity,
          incremental: true,
          event: "unlink",
          file: "content/blog/temp-article.md",
        },
        initialResult,
        1,
      )

      const sitedata = JSON.parse(
        await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
      )
      const tempAfter = Object.values(sitedata.pages).find(
        (p) => p._meta.id === "./blog/temp-article.md",
      )
      assert(tempAfter === undefined, "Temp article should be removed")
    } finally {
      if (await fs.pathExists(tempArticlePath)) {
        await fs.remove(tempArticlePath)
      }
      await fs.remove(outputDir)
    }
  })

  // Test 7: Template change
  await runTest("should rebuild pages using changed template", async () => {
    const outputDir = createTempDir()
    process.chdir(fixtureDir)
    process.env.TEST_PUBLIC_DIR = outputDir

    const templatePath = path.join(fixtureDir, "theme/templates/page.njk")

    if (!(await fs.pathExists(templatePath))) {
      return // Skip if template doesn't exist
    }

    const originalContent = await fs.readFile(templatePath, "utf8")

    try {
      // Initial build should also have incremental: true to enable Nunjucks watch mode
      const initialResult = await build({
        configFile: "kiss.config.js",
        verbosity,
        incremental: true,
      })

      // Add comment inside the block, not at the end of the file
      const newContent = originalContent.replace(
        "{% endblock %}",
        "<!-- Modified -->\n{% endblock %}",
      )
      await fs.writeFile(templatePath, newContent)

      // Give Nunjucks watch mode time to detect the file change
      // Nunjucks uses chokidar which may need more time in test environments
      // If this test is failing, try increasing this delay first
      await new Promise((resolve) => setTimeout(resolve, 250))

      await build(
        {
          configFile: "kiss.config.js",
          verbosity,
          incremental: true,
          event: "change",
          file: "theme/templates/page.njk",
        },
        initialResult,
        1,
      )

      const sitedata = JSON.parse(
        await fs.readFile(path.join(outputDir, "sitedata.json"), "utf8"),
      )
      const aboutPage = Object.values(sitedata.pages).find(
        (p) => p._meta.id === "./about.html",
      )
      const aboutHtml = await fs.readFile(aboutPage._meta.outputPath, "utf8")

      assert(
        aboutHtml.includes("<!-- Modified -->"),
        "Pages using template should be rebuilt with changes. If this test is failing, try increasing Promise() delay first.",
      )
    } finally {
      await fs.writeFile(templatePath, originalContent)
      await fs.remove(outputDir)
    }
  })

  // Cleanup and report
  process.chdir(originalCwd)
  delete process.env.TEST_PUBLIC_DIR

  const totalDuration = Date.now() - startTime

  // Output final summary in TAP format
  console.log(`1..${testNumber}`)
  console.log(`# tests ${testNumber}`)
  console.log(`# suites 0`)
  console.log(`# pass ${passed}`)
  console.log(`# fail ${failed}`)
  console.log(`# cancelled 0`)
  console.log(`# skipped 0`)
  console.log(`# todo 0`)
  console.log(`# duration_ms ${totalDuration}`)

  if (failed > 0) {
    console.log("")
    console.log("# failing tests:")
    console.log("")

    failures.forEach(({ name, error, duration }) => {
      // Mimic node:test failure output format
      console.log("test at test/integration/incremental-runner.js:1:1")
      console.log(`✖ ${name} (${duration}ms)`)
      console.log(`  ${error}`)
      console.log("")
    })

    process.exit(1)
  } else {
    process.exit(0)
  }
}

// Run tests
runTests().catch((error) => {
  console.error("\n❌ Test runner error:", error)
  process.exit(1)
})

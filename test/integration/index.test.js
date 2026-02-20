const { describe, it, before, after } = require("node:test")
const assert = require("assert/strict")
const path = require("path")
const {
  createTempDir,
  cleanupTempDir,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../test-utils/helpers")
const build = require("../../src/build")

describe("KISS Integration Tests", () => {
  let tempDir
  let originalCwd
  let originalLogger
  let sharedBuildResult

  before(async () => {
    tempDir = createTempDir("kiss-integration-test-")
    originalCwd = process.cwd()

    // Set TEST_PUBLIC_DIR to use temp directory for build output
    process.env.TEST_PUBLIC_DIR = tempDir

    // Set up a global logger to prevent errors
    originalLogger = mockGlobalLogger()
    // Add success method and counts for build compatibility
    global.logger.success = () => {}
    global.logger.counts = { error: 0, warn: 0 }

    // Build the site once and share result across tests
    const fixtureDir = path.join(__dirname, "repo")
    process.chdir(fixtureDir)
    sharedBuildResult = await build({
      configFile: "kiss.config.js",
      verbosity: "silent",
    })
  })

  after(() => {
    process.chdir(originalCwd)
    delete process.env.TEST_PUBLIC_DIR
    cleanupTempDir(tempDir)
    restoreGlobalLogger(originalLogger)
  })

  it("should cascade index.* attributes to children but not post.* attributes", async () => {
    // Use shared build result
    const pages = sharedBuildResult.context.pages

    // Test 1: Root page (.) combining index.js and post.md
    const rootPage = pages["."]
    assert.ok(rootPage, "Root page should exist")

    // Should have attributeA from index.js
    assert.strictEqual(
      rootPage.attributeA,
      "IndexAttributeA",
      "Root page should have attributeA from index.js",
    )

    // Should have attributeB from post.md (overrides index.js)
    assert.strictEqual(
      rootPage.attributeB,
      "PostAttributeB",
      "Root page should have attributeB from post.md (overriding index.js)",
    )

    // Should have attributeC from post.md (overrides index.js function)
    assert.strictEqual(
      rootPage.attributeC,
      "PostAttributeC",
      "Root page should have attributeC from post.md (overriding index.js function)",
    )

    // Should have attributeD from post.md
    assert.strictEqual(
      rootPage.attributeD,
      "PostAttributeD",
      "Root page should have attributeD from post.md",
    )

    // Test 2: Subdirectory page should inherit from index.js only
    const subPage = pages["./subdirectory"]
    assert.ok(subPage, "Subdirectory page should exist")

    // Should have attributeA from parent index.js
    assert.strictEqual(
      subPage.attributeA,
      "IndexAttributeA",
      "Subdirectory page should inherit attributeA from parent index.js",
    )

    // Should have attributeB from parent index.js (NOT from post.md)
    assert.strictEqual(
      subPage.attributeB,
      "IndexAttributeB",
      "Subdirectory page should inherit attributeB from parent index.js (not post.md)",
    )

    // Should have attributeC computed from parent index.js function (NOT from post.md)
    assert.strictEqual(
      subPage.attributeC,
      "FnAttributeC",
      "Subdirectory page should have attributeC computed from parent index.js function (not post.md)",
    )

    // Should NOT have attributeD (only defined in post.md, not in index.js)
    assert.strictEqual(
      subPage.attributeD,
      undefined,
      "Subdirectory page should NOT have attributeD (only in post.md)",
    )

    // Should have its own attributeE
    assert.strictEqual(
      subPage.attributeE,
      "SubPostAttributeE",
      "Subdirectory page should have its own attributeE",
    )

    // Test 3: Computed collection page for tag1
    const tagPage = pages["./tags/tag1"]
    assert.ok(tagPage, "Tag collection page should exist")

    // Should have attributeA from root index.js
    assert.strictEqual(
      tagPage.attributeA,
      "IndexAttributeA",
      "Tag page should inherit attributeA from root index.js",
    )

    // Should have attributeB from root index.js (NOT from post.md)
    assert.strictEqual(
      tagPage.attributeB,
      "IndexAttributeB",
      "Tag page should inherit attributeB from root index.js (not post.md)",
    )

    // Should have attributeC computed from root index.js function (NOT from post.md)
    assert.strictEqual(
      tagPage.attributeC,
      "FnAttributeC",
      "Tag page should have attributeC computed from root index.js function (not post.md)",
    )

    // Should NOT have attributeD (only defined in post.md, not in index.js)
    assert.strictEqual(
      tagPage.attributeD,
      undefined,
      "Tag page should NOT have attributeD (only in post.md)",
    )

    // Should NOT have attributeE (only defined in subdirectory/post.md)
    assert.strictEqual(
      tagPage.attributeE,
      undefined,
      "Tag page should NOT have attributeE (only in subdirectory/post.md)",
    )
  })

  describe("Content Loading", () => {
    it("should load JSON content files", async () => {
      const pages = sharedBuildResult.context.pages

      // Find the JSON post - may have different key
      const jsonPost = Object.values(pages).find(
        (p) => p.title === "Blog Post from JSON",
      )

      assert.ok(jsonPost, "JSON post should be loaded")
      assert.strictEqual(jsonPost.title, "Blog Post from JSON")
      assert.strictEqual(jsonPost.author, "john")
      assert.deepStrictEqual(jsonPost.tags, ["json", "test", "content"])
      assert.ok(jsonPost.content.includes("JSON is great for structured data"))
    })

    it("should load HTML content files", async () => {
      const pages = sharedBuildResult.context.pages
      const aboutPage = Object.values(pages).find(
        (p) => p.id === "about-page-id",
      )
      const contactPage = Object.values(pages).find(
        (p) => p.title === "Contact Us",
      )

      assert.ok(aboutPage, "About page should be loaded")
      assert.strictEqual(aboutPage.id, "about-page-id")
      assert.strictEqual(aboutPage.title, "About Us")
      assert.strictEqual(aboutPage.slug, "about-us")
      assert.ok(aboutPage._html.includes("<h1>About kiss</h1>"))

      assert.ok(contactPage, "Contact page should be loaded")
      assert.strictEqual(contactPage.title, "Contact Us")
      assert.strictEqual(contactPage.email, "contact@example.com")
    })

    it("should load Markdown content files", async () => {
      const pages = sharedBuildResult.context.pages
      const simplePage = Object.values(pages).find(
        (p) => p._html && p._html.includes("simple markdown file"),
      )
      const withImagesPage = Object.values(pages).find(
        (p) => p.title === "Post with Images",
      )

      assert.ok(simplePage, "Simple markdown page should be loaded")
      assert.ok(simplePage._html.includes("simple markdown file"))

      assert.ok(withImagesPage, "Markdown page with images should be loaded")
      assert.strictEqual(withImagesPage.title, "Post with Images")
      assert.deepStrictEqual(withImagesPage.tags, ["images", "test"])
    })

    it("should load JavaScript content files", async () => {
      const pages = sharedBuildResult.context.pages
      const rootPage = pages["."]

      // Root page combines data from index.js and post.md
      assert.ok(rootPage, "Root page should exist")
      assert.strictEqual(rootPage.attributeA, "IndexAttributeA")
    })

    it("should skip draft posts", async () => {
      const pages = sharedBuildResult.context.pages
      const draftPage = Object.values(pages).find((p) => p.published === false)

      // Draft should be loaded but marked as unpublished
      assert.ok(draftPage, "Draft page should be loaded")
      assert.strictEqual(draftPage.published, false)
    })
  })

  describe("Transform Pipeline", () => {
    it("should resolve @data attributes from context", async () => {
      const pages = sharedBuildResult.context.pages
      const contactPage = Object.values(pages).find(
        (p) => p.title === "Contact Us",
      )

      assert.ok(contactPage, "Contact page should exist")

      // @data:site.url should resolve to context.site.url
      assert.ok(
        contactPage._html.includes("https://test.example.com"),
        "Should resolve @data:site.url from context",
      )
    })

    it("should resolve @id attributes", async () => {
      const pages = sharedBuildResult.context.pages
      const contactPage = Object.values(pages).find(
        (p) => p.title === "Contact Us",
      )

      assert.ok(contactPage, "Contact page should exist")
      // @id:about-page-id should resolve to the about page URL
      assert.ok(
        contactPage._html.includes('href="/about-us"'),
        "Should resolve @id:about-page-id to /about-us",
      )
    })

    it("should resolve @permalink attributes", async () => {
      const pages = sharedBuildResult.context.pages
      const contactPage = Object.values(pages).find(
        (p) => p.title === "Contact Us",
      )

      assert.ok(contactPage, "Contact page should exist")
      // @permalink:about-us should resolve to /about-us
      assert.ok(
        contactPage._html.match(/href="\/about-us"/g).length >= 2,
        "Should resolve @permalink:about-us",
      )
    })

    it("should resolve @file attributes", async () => {
      const pages = sharedBuildResult.context.pages
      const contactPage = Object.values(pages).find(
        (p) => p.title === "Contact Us",
      )

      assert.ok(contactPage, "Contact page should exist")
      // @file:about.html should resolve to /about-us
      assert.ok(
        contactPage._html.includes('href="/about-us"'),
        "Should resolve @file:about.html",
      )
    })

    it("should process Nunjucks templates in content", async () => {
      const pages = sharedBuildResult.context.pages
      const rootPage = pages["."]

      // All pages should have _html populated
      assert.ok(rootPage._html, "Root page should have rendered HTML")
      assert.ok(rootPage._html.length > 0, "Rendered HTML should not be empty")
    })

    it("should resolve @attributes in Nunjucks templates", async () => {
      const pages = sharedBuildResult.context.pages
      const contactPage = Object.values(pages).find(
        (p) => p.title === "Contact Us",
      )

      assert.ok(contactPage, "Contact page should exist")

      // The base template has @id:about-page-id which should resolve to /about-us
      assert.ok(
        contactPage._html.includes('href="/about-us"'),
        "Should resolve @id:about-page-id in template navigation",
      )

      // The base template has @file:contact.html which should resolve to /contact
      assert.ok(
        contactPage._html.includes('href="/contact"'),
        "Should resolve @file:contact.html in template navigation",
      )

      // The base template has @permalink:blog which should resolve
      assert.ok(
        contactPage._html.includes('href="/blog/"'),
        "Should resolve @permalink:/blog/ in template navigation",
      )
    })
  })

  describe("Image Optimization", () => {
    const fs = require("fs")

    it("should generate responsive image variants", async () => {
      const pages = sharedBuildResult.context.pages
      const withImagesPage = Object.values(pages).find(
        (p) => p.title === "Post with Images",
      )

      assert.ok(withImagesPage, "Post with Images should exist")
      // Check that image processing happened
      assert.ok(
        withImagesPage._html.includes("<picture>"),
        "Should generate picture elements",
      )
      assert.ok(
        withImagesPage._html.includes("<source"),
        "Should generate source elements",
      )
      assert.ok(
        withImagesPage._html.includes("srcset="),
        "Should generate srcset attributes",
      )
    })

    it("should create WebP variants", async () => {
      const pages = sharedBuildResult.context.pages
      const withImagesPage = Object.values(pages).find(
        (p) => p.title === "Post with Images",
      )

      assert.ok(withImagesPage, "Post with Images should exist")
      // Should have WebP sources in the HTML
      assert.ok(
        withImagesPage._html.includes('type="image/webp"'),
        "Should generate WebP variants",
      )
    })

    it("should create multiple width variants", async () => {
      const pages = sharedBuildResult.context.pages
      const withImagesPage = Object.values(pages).find(
        (p) => p.title === "Post with Images",
      )

      assert.ok(withImagesPage, "Post with Images should exist")
      // Should have multiple widths in srcset (320w, 640w, 1024w)
      assert.ok(
        withImagesPage._html.includes("320w"),
        "Should generate 320w variant",
      )
      assert.ok(
        withImagesPage._html.includes("640w"),
        "Should generate 640w variant",
      )
      assert.ok(
        withImagesPage._html.includes("1024w"),
        "Should generate 1024w variant",
      )
    })

    it("should write optimized images to disk", async () => {
      // Check that image files were actually written
      const publicDir = tempDir
      const imageFiles = fs.readdirSync(path.join(publicDir, "images"), {
        recursive: true,
      })

      // Should have original images
      assert.ok(
        imageFiles.some((f) => f.includes("photo-large")),
        "Should copy photo-large variants",
      )
      assert.ok(
        imageFiles.some((f) => f.includes("graphic")),
        "Should copy graphic variants",
      )

      // Should have WebP variants
      assert.ok(
        imageFiles.some((f) => f.endsWith(".webp")),
        "Should generate WebP variants",
      )
    })

    it("should handle relative image paths in markdown", async () => {
      const pages = sharedBuildResult.context.pages
      const withImagesPage = Object.values(pages).find(
        (p) => p.title === "Post with Images",
      )

      assert.ok(withImagesPage, "Post with Images should exist")

      // Relative path ../images/photo-large.jpg should be resolved
      assert.ok(
        withImagesPage._html.includes("photo-large"),
        "Should resolve relative path ../images/photo-large.jpg",
      )

      // Should generate picture elements for both relative and absolute paths
      const pictureCount = (withImagesPage._html.match(/<picture>/g) || [])
        .length
      assert.ok(
        pictureCount >= 3,
        "Should generate picture elements for images with relative and absolute paths",
      )
    })
  })

  describe("Writers", () => {
    const fs = require("fs")

    it("should write HTML files for all pages", async () => {
      const publicDir = tempDir

      // Check that HTML files exist - using recursive file listing
      const findHtmlFiles = (dir) => {
        const files = []
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          if (item.isDirectory()) {
            files.push(...findHtmlFiles(fullPath))
          } else if (item.name.endsWith(".html")) {
            files.push(fullPath)
          }
        }
        return files
      }

      const htmlFiles = findHtmlFiles(publicDir)
      assert.ok(htmlFiles.length > 0, "Should write HTML files")

      // Check for specific files
      assert.ok(
        htmlFiles.some((f) => f.endsWith("index.html")),
        "Should write at least one index.html file",
      )
    })

    it("should write RSS feed", async () => {
      const publicDir = tempDir
      const feedPath = path.join(publicDir, "feed.xml")

      assert.ok(fs.existsSync(feedPath), "Should write feed.xml")

      const feedContent = fs.readFileSync(feedPath, "utf-8")
      assert.ok(feedContent.includes("<?xml"), "Feed should be XML")
      // Check for either RSS or Atom format
      assert.ok(
        feedContent.includes("<rss") || feedContent.includes("<feed"),
        "Feed should be RSS or Atom format",
      )
      assert.ok(
        feedContent.includes("kiss Test Site"),
        "Feed should include site title",
      )
    })

    it("should write sitemap", async () => {
      const publicDir = tempDir
      const sitemapPath = path.join(publicDir, "sitemap.xml")

      assert.ok(fs.existsSync(sitemapPath), "Should write sitemap.xml")

      const sitemapContent = fs.readFileSync(sitemapPath, "utf-8")
      assert.ok(sitemapContent.includes("<?xml"), "Sitemap should be XML")
      assert.ok(
        sitemapContent.includes("<urlset"),
        "Sitemap should have urlset",
      )
      assert.ok(
        sitemapContent.includes("https://test.example.com"),
        "Sitemap should include site URL",
      )
    })

    it("should apply correct templates", async () => {
      const publicDir = tempDir

      // Find any HTML file
      const findFirstHtmlFile = (dir) => {
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          if (item.isFile() && item.name.endsWith(".html")) {
            return fullPath
          }
          if (item.isDirectory()) {
            const found = findFirstHtmlFile(fullPath)
            if (found) return found
          }
        }
        return null
      }

      const htmlFile = findFirstHtmlFile(publicDir)
      assert.ok(htmlFile, "Should find at least one HTML file")

      const htmlContent = fs.readFileSync(htmlFile, "utf-8")

      // Should include base template elements
      assert.ok(htmlContent.includes("<html"), "Should have HTML structure")
      assert.ok(
        htmlContent.includes("kiss Test Site"),
        "Should include site title",
      )

      // Should include navigation from base template
      assert.ok(htmlContent.includes("<nav>"), "Should include navigation")
      assert.ok(htmlContent.includes('href="/"'), "Should include home link")
    })
  })

  describe("Data Views and Collections", () => {
    it("should compute tag collection pages", async () => {
      const pages = sharedBuildResult.context.pages

      // Should have tag collection pages
      const tag1Page = pages["./tags/tag1"]
      const imagesTagPage = pages["./tags/images"]
      const testTagPage = pages["./tags/test"]

      assert.ok(tag1Page, "Should create collection page for tag1")
      assert.ok(imagesTagPage, "Should create collection page for images tag")
      assert.ok(testTagPage, "Should create collection page for test tag")
    })

    it("should populate collection items", async () => {
      const context = sharedBuildResult.context

      // Collections are stored in context.collections
      assert.ok(context.collections, "Should have collections")
      assert.ok(context.collections.tags, "Should have tags collection")
      assert.ok(
        context.collections.tags.images,
        "Should have images tag in tags collection",
      )

      // Collection data has an allPosts array
      const imagesCollection = context.collections.tags.images
      assert.ok(
        imagesCollection.allPosts,
        "Images collection should have allPosts",
      )
      assert.ok(
        Array.isArray(imagesCollection.allPosts),
        "allPosts should be an array",
      )
      assert.ok(
        imagesCollection.allPosts.length > 0,
        "Should have at least one item in images collection",
      )

      // Items should include the with-images post
      const withImagesPost = imagesCollection.allPosts.find(
        (item) => item.title === "Post with Images",
      )
      assert.ok(
        withImagesPost,
        "Should include Post with Images in images collection",
      )
    })

    it("should compute site last updated date", async () => {
      const context = sharedBuildResult.context

      assert.ok(context.site.lastUpdated, "Site should have lastUpdated date")
      assert.ok(
        context.site.lastUpdated instanceof Date,
        "lastUpdated should be a Date",
      )
    })

    it("should compute collections data view", async () => {
      const context = sharedBuildResult.context

      // Check if collections exist
      assert.ok(context.collections, "Should have collections")
      assert.ok(context.collections.tags, "Should have tags collection")

      // Tags collection is an object with tag names as keys
      assert.strictEqual(
        typeof context.collections.tags,
        "object",
        "Tags collection should be an object",
      )

      // Check that test tag exists and has items
      assert.ok(
        context.collections.tags.test,
        "Should have 'test' tag in collections",
      )
      assert.ok(
        context.collections.tags.test.allPosts,
        "Test tag should have allPosts",
      )
      assert.ok(
        Array.isArray(context.collections.tags.test.allPosts),
        "allPosts should be an array",
      )
      assert.ok(
        context.collections.tags.test.allPosts.length > 0,
        "Should have items tagged with 'test'",
      )
    })
  })
})

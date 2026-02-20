const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const fs = require("fs-extra")
const path = require("path")
const sitemapContextWriter = require("../../../src/writers/sitemapContextWriter")
const {
  createTempDir,
  cleanupTempDir,
  createMockConfig,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../../test-utils/helpers")

describe("sitemapContextWriter", () => {
  let tempDir
  let publicDir
  let config
  let originalLogger

  beforeEach(() => {
    tempDir = createTempDir()
    publicDir = path.join(tempDir, "public")
    fs.ensureDirSync(publicDir)

    config = createMockConfig({
      dirs: {
        public: publicDir,
      },
      defaults: {
        pagePublishedAttribute: "created",
        pageUpdatedAttribute: "modified",
      },
    })

    // Mock global.logger
    originalLogger = mockGlobalLogger()
  })

  afterEach(() => {
    cleanupTempDir(tempDir)
    restoreGlobalLogger(originalLogger)
  })

  it("should warn and skip when no target specified", async () => {
    let warnMessage = ""
    global.logger.warn = (message) => {
      warnMessage = message
    }

    const context = { pages: {} }

    const result = await sitemapContextWriter(context, {}, config)

    assert.equal(result, undefined)
    assert.ok(warnMessage.includes("No 'target' passed in options"))
  })

  it("should generate basic sitemap", async () => {
    const context = {
      pages: {
        "./index": {
          permalink: "/",
          url: "https://example.com/",
          created: new Date("2023-01-01"),
          modified: new Date("2023-01-02"),
          _meta: { id: "./index", isPost: false },
        },
        "./post1": {
          permalink: "/post1/",
          url: "https://example.com/post1/",
          created: new Date("2023-01-03"),
          modified: new Date("2023-01-04"),
          _meta: { id: "./post1", isPost: true },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: {
        home: "daily",
        collection: "weekly",
        post: "monthly",
      },
      priority: {
        home: 1.0,
        collection: 0.8,
        post: 0.6,
      },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapPath = path.join(publicDir, "sitemap.xml")
    assert.ok(
      await fs.pathExists(sitemapPath),
      "Sitemap file should be created",
    )

    const sitemapContent = await fs.readFile(sitemapPath, "utf-8")

    // Basic structure checks
    assert.ok(
      sitemapContent.includes(
        'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      ),
    )
    assert.ok(sitemapContent.includes("<loc>https://example.com/</loc>"))
    assert.ok(sitemapContent.includes("<loc>https://example.com/post1/</loc>"))

    // Home page should have home settings
    assert.ok(sitemapContent.includes("<changefreq>daily</changefreq>"))
    assert.ok(sitemapContent.includes("<priority>1.0</priority>"))

    // Post should have post settings
    assert.ok(sitemapContent.includes("<changefreq>monthly</changefreq>"))
    assert.ok(sitemapContent.includes("<priority>0.6</priority>"))
  })

  it("should handle page filtering", async () => {
    const context = {
      pages: {
        "./public": {
          permalink: "/public/",
          url: "https://example.com/public/",
          isPublic: true,
          _meta: { id: "./public", isPost: false },
        },
        "./private": {
          permalink: "/private/",
          url: "https://example.com/private/",
          isPublic: false,
          _meta: { id: "./private", isPost: false },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: (page) => page.isPublic === true,
      changeFreq: { collection: "weekly" },
      priority: { collection: 0.8 },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )
    assert.ok(sitemapContent.includes("https://example.com/public/"))
    assert.ok(!sitemapContent.includes("https://example.com/private/"))
  })

  it("should use updated date when available, fallback to created", async () => {
    const context = {
      pages: {
        "./page1": {
          permalink: "/page1/",
          url: "https://example.com/page1/",
          created: new Date("2023-01-01"),
          modified: new Date("2023-01-05"),
          _meta: { id: "./page1", isPost: false },
        },
        "./page2": {
          permalink: "/page2/",
          url: "https://example.com/page2/",
          created: new Date("2023-01-02"),
          // No modified date
          _meta: { id: "./page2", isPost: false },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: { collection: "weekly" },
      priority: { collection: 0.8 },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )

    // Should use modified date for page1 (2023-01-05)
    assert.ok(sitemapContent.includes("2023-01-05"))

    // Should use created date for page2 (2023-01-02)
    assert.ok(sitemapContent.includes("2023-01-02"))
  })

  it("should handle different page types correctly", async () => {
    const context = {
      pages: {
        "./": {
          permalink: "/",
          url: "https://example.com/",
          _meta: { id: "./", isPost: false },
        },
        "./posts": {
          permalink: "/posts/",
          url: "https://example.com/posts/",
          _meta: { id: "./posts", isPost: false },
        },
        "./posts/article": {
          permalink: "/posts/article/",
          url: "https://example.com/posts/article/",
          _meta: { id: "./posts/article", isPost: true },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: {
        home: "daily",
        collection: "weekly",
        post: "monthly",
      },
      priority: {
        home: 1.0,
        collection: 0.8,
        post: 0.6,
      },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )

    // Check that different change frequencies are used
    const homeIndex = sitemapContent.indexOf("https://example.com/</loc>")
    const postsIndex = sitemapContent.indexOf(
      "https://example.com/posts/</loc>",
    )
    const articleIndex = sitemapContent.indexOf(
      "https://example.com/posts/article/</loc>",
    )

    // Find the changefreq after each URL
    const dailyIndex = sitemapContent.indexOf("<changefreq>daily</changefreq>")
    const weeklyIndex = sitemapContent.indexOf(
      "<changefreq>weekly</changefreq>",
    )
    const monthlyIndex = sitemapContent.indexOf(
      "<changefreq>monthly</changefreq>",
    )

    // Home should use daily (priority 1.0)
    assert.ok(homeIndex < dailyIndex)
    assert.ok(sitemapContent.includes("<priority>1.0</priority>"))

    // Collection should use weekly (priority 0.8)
    assert.ok(postsIndex < weeklyIndex)
    assert.ok(sitemapContent.includes("<priority>0.8</priority>"))

    // Post should use monthly (priority 0.6)
    assert.ok(articleIndex < monthlyIndex)
    assert.ok(sitemapContent.includes("<priority>0.6</priority>"))
  })

  it("should handle date formatting errors", async () => {
    let warnMessage = ""
    global.logger.warn = (message) => {
      warnMessage = message
    }

    const context = {
      pages: {
        "./page1": {
          permalink: "/page1/",
          url: "https://example.com/page1/",
          created: "invalid-date",
          _meta: { id: "./page1", isPost: false },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: { collection: "weekly" },
      priority: { collection: 0.8 },
    }

    await sitemapContextWriter(context, options, config)

    // Should warn about invalid date format
    assert.ok(warnMessage.includes("cannot format lastmod date"))
    assert.ok(warnMessage.includes("invalid-date"))

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )

    // Should still include the URL with null lastmod
    assert.ok(sitemapContent.includes("https://example.com/page1/"))
  })

  it("should handle pages without dates", async () => {
    const context = {
      pages: {
        "./page1": {
          permalink: "/page1/",
          url: "https://example.com/page1/",
          _meta: { id: "./page1", isPost: false },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: { collection: "weekly" },
      priority: { collection: 0.8 },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )
    assert.ok(sitemapContent.includes("https://example.com/page1/"))
    assert.ok(
      sitemapContent.includes("<lastmod></lastmod>") ||
        sitemapContent.includes("<lastmod/>") ||
        !sitemapContent.match(/<lastmod>.*<\/lastmod>/),
    )
  })

  it("should handle custom XML options", async () => {
    const context = {
      pages: {
        "./": {
          permalink: "/",
          url: "https://example.com/",
          _meta: { id: "./", isPost: false },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: { home: "daily" },
      priority: { home: 1.0 },
      xmlOptions: {
        declaration: true,
        indent: "  ",
      },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )
    assert.ok(sitemapContent.startsWith("<?xml"))
  })

  it("should handle empty pages", async () => {
    const context = { pages: {} }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: { home: "daily" },
      priority: { home: 1.0 },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )
    assert.ok(
      sitemapContent.includes(
        'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
      ),
    )
    assert.ok(!sitemapContent.includes("<url>"))
  })

  it("should format priority with one decimal place", async () => {
    const context = {
      pages: {
        "./": {
          permalink: "/",
          url: "https://example.com/",
          _meta: { id: "./", isPost: false },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: { home: "daily" },
      priority: { home: 0.86 }, // Should be formatted as 0.9 (with one decimal - rounds up)
    }

    await sitemapContextWriter(context, options, config)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )
    assert.ok(sitemapContent.includes("<priority>0.9</priority>"))
  })

  it("should handle custom page attributes for dates", async () => {
    const customConfig = createMockConfig({
      dirs: { public: publicDir },
      defaults: {
        pagePublishedAttribute: "publishDate",
        pageUpdatedAttribute: "lastUpdate",
      },
    })

    const context = {
      pages: {
        "./page1": {
          permalink: "/page1/",
          url: "https://example.com/page1/",
          publishDate: new Date("2023-01-01"),
          lastUpdate: new Date("2023-01-05"),
          _meta: { id: "./page1", isPost: false },
        },
      },
    }

    const options = {
      target: "sitemap.xml",
      pageFilter: () => true,
      changeFreq: { collection: "weekly" },
      priority: { collection: 0.8 },
    }

    await sitemapContextWriter(context, options, customConfig)

    const sitemapContent = await fs.readFile(
      path.join(publicDir, "sitemap.xml"),
      "utf-8",
    )
    assert.ok(sitemapContent.includes("2023-01-05")) // Should use lastUpdate
  })

  it("should handle nested output directory", async () => {
    const context = {
      pages: {
        "./": {
          permalink: "/",
          url: "https://example.com/",
          _meta: { id: "./", isPost: false },
        },
      },
    }

    const options = {
      target: "feeds/sitemap.xml",
      pageFilter: () => true,
      changeFreq: { home: "daily" },
      priority: { home: 1.0 },
    }

    await sitemapContextWriter(context, options, config)

    const sitemapPath = path.join(publicDir, "feeds", "sitemap.xml")
    assert.ok(
      await fs.pathExists(sitemapPath),
      "Sitemap should be created in nested directory",
    )

    const sitemapContent = await fs.readFile(sitemapPath, "utf-8")
    assert.ok(sitemapContent.includes("https://example.com/"))
  })
})

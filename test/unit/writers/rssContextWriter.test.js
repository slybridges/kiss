const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const fs = require("fs-extra")
const path = require("path")
const rssContextWriter = require("../../../src/writers/rssContextWriter")
const {
  createTempDir,
  cleanupTempDir,
  createMockConfig,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../../test-utils/helpers")

describe("rssContextWriter", () => {
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
        sortCollectionBy: "-created", // Sort by created date, newest first
      },
      libs: {
        unslugify: (str) =>
          str.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      },
    })

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

    const context = { site: { url: "https://example.com" } }

    const result = await rssContextWriter(context, {}, config)

    assert.equal(result, undefined)
    assert.ok(warnMessage.includes("No 'target' passed in options"))
  })

  it("should generate basic RSS feed", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
        description: "A test blog",
        lastUpdated: new Date("2023-01-01T12:00:00Z"),
      },
      pages: {
        "./post1": {
          title: "First Post",
          description: "First post description",
          url: "https://example.com/post1/",
          permalink: "/post1/",
          created: new Date("2023-01-01T10:00:00Z"),
          modified: new Date("2023-01-01T11:00:00Z"),
          content: "<p>First post content</p>",
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedPath = path.join(publicDir, "feed.xml")
    assert.ok(await fs.pathExists(feedPath), "Feed file should be created")

    const feedContent = await fs.readFile(feedPath, "utf-8")

    // Basic structure checks
    assert.ok(feedContent.includes('xmlns="http://www.w3.org/2005/Atom"'))
    assert.ok(feedContent.includes("<title>Test Blog</title>"))
    assert.ok(feedContent.includes("<subtitle>A test blog</subtitle>"))
    assert.ok(feedContent.includes("<id>https://example.com</id>"))
    assert.ok(feedContent.includes("First Post"))
    assert.ok(feedContent.includes("First post description"))
    assert.ok(feedContent.includes("First post content"))
  })

  it("should handle page filtering", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Published Post",
          url: "https://example.com/post1/",
          published: true,
          _meta: { id: "./post1" },
        },
        "./post2": {
          title: "Draft Post",
          url: "https://example.com/post2/",
          published: false,
          _meta: { id: "./post2" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: (page) => page.published === true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.includes("Published Post"))
    assert.ok(!feedContent.includes("Draft Post"))
  })

  it("should limit number of entries", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Post 1",
          url: "https://example.com/post1/",
          created: new Date("2023-01-01"),
          _meta: { id: "./post1" },
        },
        "./post2": {
          title: "Post 2",
          url: "https://example.com/post2/",
          created: new Date("2023-01-02"),
          _meta: { id: "./post2" },
        },
        "./post3": {
          title: "Post 3",
          url: "https://example.com/post3/",
          created: new Date("2023-01-03"),
          _meta: { id: "./post3" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
      limit: 2,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )

    // Should include the two most recent posts
    assert.ok(feedContent.includes("Post 3"))
    assert.ok(feedContent.includes("Post 2"))
    assert.ok(!feedContent.includes("Post 1"))
  })

  it("should handle custom sorting", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Post A",
          url: "https://example.com/post1/",
          priority: 3,
          _meta: { id: "./post1" },
        },
        "./post2": {
          title: "Post B",
          url: "https://example.com/post2/",
          priority: 1,
          _meta: { id: "./post2" },
        },
        "./post3": {
          title: "Post C",
          url: "https://example.com/post3/",
          priority: 2,
          _meta: { id: "./post3" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
      sortCollectionBy: "-priority", // Sort by priority descending
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )

    // Posts should be ordered by priority (highest first)
    const postAIndex = feedContent.indexOf("Post A")
    const postBIndex = feedContent.indexOf("Post B")
    const postCIndex = feedContent.indexOf("Post C")

    assert.ok(postAIndex < postCIndex, "Post A should come before Post C")
    assert.ok(postCIndex < postBIndex, "Post C should come before Post B")
  })

  it("should handle author information as string", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Post with Author",
          url: "https://example.com/post1/",
          author: "John Doe",
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.includes("<name>John Doe</name>"))
  })

  it("should handle author information as object", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Post with Author Object",
          url: "https://example.com/post1/",
          author: {
            name: "Jane Smith",
            email: "jane@example.com",
            uri: "https://jane.example.com",
          },
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.includes("<name>Jane Smith</name>"))
    assert.ok(feedContent.includes("<email>jane@example.com</email>"))
    assert.ok(feedContent.includes("<uri>https://jane.example.com</uri>"))
  })

  it("should handle categories", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Categorized Post",
          url: "https://example.com/post1/",
          category: "web-development",
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.includes('term="web-development"'))
    assert.ok(feedContent.includes('label="Web Development"'))
  })

  it("should convert relative URLs to absolute in content", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Post with Links",
          url: "https://example.com/post1/",
          content:
            '<p>Check out <a href="/other-post/">this post</a> and <img src="/images/photo.jpg" alt="Photo" srcset="/images/photo-sm.jpg 400w, /images/photo-lg.jpg 800w"></p>',
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    // URLs in content are XML-escaped, so check for the escaped versions
    assert.ok(
      feedContent.includes("href=&quot;https://example.com/other-post/&quot;"),
    )
    assert.ok(
      feedContent.includes(
        "src=&quot;https://example.com/images/photo.jpg&quot;",
      ),
    )
    assert.ok(
      feedContent.includes(
        "srcset=&quot;https://example.com/images/photo-sm.jpg 400w,https://example.com/images/photo-lg.jpg 800w&quot;",
      ),
    )
  })

  it("should handle invalid URLs gracefully", async () => {
    let warnMessage = ""
    global.logger.warn = (message) => {
      warnMessage = message
    }

    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Post with Invalid URL",
          url: "not-a-valid-url",
          content:
            '<p>Some content with <a href="/link/">relative link</a></p>',
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    assert.ok(warnMessage.includes("url 'not-a-valid-url'"))
    assert.ok(warnMessage.includes("is not valid"))

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    // Should include original content without URL transformation (XML-escaped)
    assert.ok(feedContent.includes("href=&quot;/link/&quot;"))
  })

  it("should handle date formatting errors", async () => {
    let warnMessages = []
    global.logger.warn = (message) => {
      warnMessages.push(message)
    }

    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
        lastUpdated: "invalid-date",
      },
      pages: {
        "./post1": {
          title: "Post with Invalid Dates",
          url: "https://example.com/post1/",
          created: "not-a-date",
          modified: "also-not-a-date",
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    // Should have warnings for invalid dates
    assert.ok(
      warnMessages.some((msg) => msg.includes("cannot format published date")),
    )
    assert.ok(
      warnMessages.some((msg) => msg.includes("cannot format updated date")),
    )
  })

  it("should include site category if specified", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
        category: "Technology",
      },
      pages: {},
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.includes("<category>Technology</category>"))
  })

  it("should handle custom XML options", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {},
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
      xmlOptions: {
        declaration: true,
        indent: "  ", // 2 space indentation
      },
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.startsWith("<?xml"))
    // Should be indented (though testing exact formatting is tricky)
  })

  it("should handle pages without content", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
      },
      pages: {
        "./post1": {
          title: "Post without Content",
          description: "A post description",
          url: "https://example.com/post1/",
          _meta: { id: "./post1" },
        },
      },
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.includes("Post without Content"))
    assert.ok(feedContent.includes("A post description"))
    assert.ok(!feedContent.includes("<content "))
  })

  it("should handle locale from context", async () => {
    const context = {
      site: {
        url: "https://example.com",
        title: "Test Blog",
        locale: ["fr", "FR"], // locale should be an array
      },
      pages: {},
    }

    const options = {
      target: "feed.xml",
      pageFilter: () => true,
    }

    await rssContextWriter(context, options, config)

    const feedContent = await fs.readFile(
      path.join(publicDir, "feed.xml"),
      "utf-8",
    )
    assert.ok(feedContent.includes('xml:lang="fr-FR"'))
  })
})

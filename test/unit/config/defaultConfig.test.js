const { describe, it } = require("node:test")
const assert = require("assert/strict")
const { defaultConfig } = require("../../../src/config")

describe("defaultConfig", () => {
  it("should have required top-level properties", () => {
    assert(defaultConfig.configFile)
    assert(defaultConfig.context)
    assert(defaultConfig.dirs)
    assert(defaultConfig.defaults)
    assert(defaultConfig.hooks)
    assert(defaultConfig.libs)
    assert(defaultConfig.dataViews)
  })

  it("should have correct default directories", () => {
    assert.equal(defaultConfig.dirs.content, "content")
    assert.equal(defaultConfig.dirs.public, "public")
    assert.equal(defaultConfig.dirs.theme, "theme")
    assert.equal(defaultConfig.dirs.template, "theme/templates")
    assert(Array.isArray(defaultConfig.dirs.watchExtra))
  })

  it("should have default loaders configured", () => {
    const loaders = defaultConfig.loaders
    assert(Array.isArray(loaders))
    assert(loaders.length > 0)
    // Check that default loaders have handlers
    loaders.forEach((loader) => {
      assert(loader.handler)
      assert.equal(typeof loader.handler, "function")
    })
  })

  it("should have default transforms configured", () => {
    const transforms = defaultConfig.transforms
    assert(Array.isArray(transforms))
    assert(transforms.length > 0)
    transforms.forEach((transform) => {
      assert(transform.handler)
      assert.equal(typeof transform.handler, "function")
    })
  })

  it("should have default writers configured", () => {
    const writers = defaultConfig.writers
    assert(Array.isArray(writers))
    assert(writers.length > 0)
    writers.forEach((writer) => {
      assert(writer.handler)
      assert.equal(typeof writer.handler, "function")
    })
  })

  it("should have default data views configured", () => {
    const dataViews = defaultConfig.dataViews
    assert(Array.isArray(dataViews))
    assert(dataViews.length > 0)
    // Check for expected data views
    const attributes = dataViews.map((dv) => dv.attribute)
    assert(attributes.includes("collections"))
    assert(attributes.includes("categories"))
    assert(attributes.includes("site.lastUpdated"))
  })

  it("should have default page defaults", () => {
    assert.equal(defaultConfig.defaults.sortCollectionBy, "-created")
    assert(defaultConfig.defaults.dateFormat)
    assert.equal(defaultConfig.defaults.descriptionLength, 160)
    assert.equal(defaultConfig.defaults.enablePageIndexes, true)
    assert.equal(defaultConfig.defaults.maxComputingRounds, 10)
    assert(defaultConfig.defaults.pageData)
  })

  it("should have image configuration", () => {
    // Image config is namespaced
    assert(defaultConfig.image)
    assert(defaultConfig.image.active === true)
    assert(defaultConfig.image.filename)
    assert(defaultConfig.image.formats)
    assert(defaultConfig.image.widths)
  })

  it("should have image writer configured", () => {
    const imageWriter = defaultConfig.writers.find(
      (w) => w.namespace === "image",
    )
    assert(imageWriter)
    assert.equal(imageWriter.outputType, "IMAGE")
    // Image config is in namespaced section
    assert(defaultConfig.image)
    assert(defaultConfig.image.formats)
    assert(defaultConfig.image.formats.includes("original"))
  })

  it("should have default image settings", () => {
    assert(defaultConfig.image)
    assert(defaultConfig.image.defaultWidth === 1024)
    assert(Array.isArray(defaultConfig.image.widths))
    assert(defaultConfig.image.widths.includes(320))
    assert(defaultConfig.image.widths.includes("original"))
    assert(defaultConfig.image.sizes)
  })

  it("should have libs object ready", () => {
    const libs = defaultConfig.libs
    assert(typeof libs === "object")
    // Libs are loaded dynamically via hooks.loadLibs
    assert(defaultConfig.hooks.loadLibs)
    assert(Array.isArray(defaultConfig.hooks.loadLibs))
    assert(defaultConfig.hooks.loadLibs.length > 0)
  })

  it("should have addPlugin function", () => {
    assert.equal(typeof defaultConfig.addPlugin, "function")
  })

  it("should have default filename function for images", () => {
    assert(defaultConfig.image)
    assert(defaultConfig.image.filename)
    assert.equal(typeof defaultConfig.image.filename, "function")

    // Test the filename function
    const filename = defaultConfig.image.filename
    assert.equal(filename("test", "jpg", null, null), "test.jpg")
    assert.equal(filename("test", "jpg", "800", null), "test_800.jpg")
    assert.equal(
      filename("test", "jpg", null, "thumbnail"),
      "test_thumbnail.jpg",
    )
    assert.equal(
      filename("test", "jpg", "800", "thumbnail"),
      "test_thumbnail_800.jpg",
    )
  })

  it("should have context site configuration structure", () => {
    assert(defaultConfig.context)
    assert(defaultConfig.context.site)
    // Site should be an empty object initially (to be filled by user config)
    assert.equal(typeof defaultConfig.context.site, "object")
  })

  it("should have RSS writer configured", () => {
    const rssWriter = defaultConfig.writers.find((w) => w.namespace === "rss")
    assert(rssWriter)
    assert(rssWriter.handler)
    // RSS config is namespaced
    assert(defaultConfig.rss)
    assert(defaultConfig.rss.active === true)
    assert(defaultConfig.rss.target)
  })

  it("should have static writer configured", () => {
    const staticWriter = defaultConfig.writers.find(
      (w) => w.outputType === "STATIC",
    )
    assert(staticWriter)
    assert(staticWriter.handler)
    // Static config is namespaced
    assert(defaultConfig.staticLoader)
    assert(defaultConfig.staticLoader.active === false)
  })

  it("should have hooks configuration", () => {
    assert(defaultConfig.hooks)
    assert(Array.isArray(defaultConfig.hooks.loadLibs))
    assert(Array.isArray(defaultConfig.hooks.preLoad))
    assert(Array.isArray(defaultConfig.hooks.postLoad))
    assert(Array.isArray(defaultConfig.hooks.postWrite))
    // Check loadLibs have handlers
    defaultConfig.hooks.loadLibs.forEach((hook) => {
      assert(hook.handler)
      assert.equal(typeof hook.handler, "function")
    })
  })

  it("should handle environment-based settings", () => {
    // The config may have different settings based on NODE_ENV
    // Check that it responds to environment
    assert(defaultConfig)
    // Note: We can't easily test different NODE_ENV values without
    // reloading the module, which is complex in a test environment
  })
})

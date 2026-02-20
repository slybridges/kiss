const { computeCollectionLoader } = require("../../../src/loaders")

module.exports = (config) => {
  // Use TEST_PUBLIC_DIR for tests if set
  if (process.env.TEST_PUBLIC_DIR) {
    config.dirs.public = process.env.TEST_PUBLIC_DIR
  }

  // Configure site metadata
  config.context.site.title = "kiss Test Site"
  config.context.site.description = "Integration test site for kiss"
  config.context.site.url = "https://test.example.com"
  config.context.site.image = "/images/hero.webp"

  // Add computed collection loader for tags
  config.loaders.push({
    source: "computed",
    handler: computeCollectionLoader,
    groupBy: "tags",
    groupByType: "array",
  })

  // Configure image optimization
  config.image.formats = ["original", "webp"]
  config.image.widths = [320, 640, 1024, "original"]
  config.image.sizes = [
    "(max-width: 640px) 100vw",
    "(max-width: 1024px) 50vw",
    "33vw",
  ]

  // Sitemap and RSS are already configured by default, but we can verify it exists

  return config
}

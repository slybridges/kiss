const { initialPageData } = require("../data")
const {
  loadMarked,
  loadNunjucks,
  loadNunjucksFilters,
  loadSlugify,
  loadUnslugify,
} = require("../libs")
const {
  jsLoader,
  jsonLoader,
  markdownLoader,
  staticLoader,
  textLoader,
} = require("../loaders")
const {
  atAttributesContentTransform,
  imageContextTransform,
  nunjucksContentTransform,
} = require("../transforms")
const {
  computeCategoriesDataView,
  computeCollectionDataView,
  computeSiteLastUpdatedDataView,
} = require("../views")
const {
  htmlWriter,
  imageWriter,
  jsonContextWriter,
  rssContextWriter,
  sitemapContextWriter,
  staticWriter,
} = require("../writers")

const defaultImageFilename = (name, ext, width, preset) => {
  let filename = name
  if (preset && preset !== "default") {
    filename += "_" + preset
  }
  if (width && width !== "original") {
    filename += "_" + width
  }
  return filename + "." + ext
}

const env = process.env.NODE_ENV

const defaultConfig = {
  addPlugin: addPlugin,
  configFile: "kiss.config.js",
  context: {
    site: {
      description: null,
      image: null, // default cover image
      // locale: needs to be an array because some expect en-US and others (looking at you, OpenGraph) en_US
      // - first element is the language as per ISO 639-1: https://www.w3schools.com/tags/ref_language_codes.asp
      // - second optional element is the territory, for example ISO_3166-1_alpha-2 code
      // Use {{ site.locale|join('_') }} to generate the locate in templates
      // Use the getLocale() helper to generate the locale string in the code
      locale: ["en", "US"],
      title: null,
      url: null, // website target url is mandatory
    },
  },
  dataViews: [
    { attribute: "collections", handler: computeCollectionDataView },
    { attribute: "categories", handler: computeCategoriesDataView },
    { attribute: "site.lastUpdated", handler: computeSiteLastUpdatedDataView },
  ],
  defaults: {
    sortCollectionBy: "-created",
    dateFormat: "MMMM do, yyyy 'at' hh:mm aaa",
    // descriptionLength: how many characters to use for the description field
    // Meta descriptions can be any length, but Google generally truncates snippets to ~155–160 characters.
    // https://moz.com/learn/seo/meta-description
    // This settings only applies to description automatically generated. If you provide your own description, it will be used as is.
    descriptionLength: 160,
    maxComputingRounds: 10,
    pageData: initialPageData,
    pagePublishedAttribute: "created",
    pageUpdatedAttribute: "modified",
  },
  dirs: {
    content: "content", // where to load documents from
    public: "public", // where to write the generated files
    theme: "theme", // where to find templates and other design files
    template: "theme/templates", // where to find templates
    watchExtra: [], // additional paths to watch for change in watch mode
  },
  env: env,
  hooks: {
    loadLibs: [
      {
        action: "run",
        handler: loadMarked,
        description: "Loading Marked (markdown processing lib)",
      },
      {
        action: "run",
        handler: loadNunjucks,
        description: "Loading Nunjucks (template processing lib)",
      },
      { action: "run", handler: loadSlugify, description: "Loading Slugify" },
      {
        action: "run",
        handler: loadUnslugify,
        description: "Loading Unslugify",
      },
      {
        action: "run",
        handler: loadNunjucksFilters.allFilters,
        description: "Loading additional Nunjucks filters",
      },
    ],
    preLoad: [],
    postLoad: [],
    postWrite: [],
  },
  libs: {},
  loaders: [
    { handler: jsLoader, namespace: "jsLoader" },
    { handler: jsonLoader, namespace: "jsonLoader" },
    { handler: staticLoader, namespace: "staticLoader" },
    { handler: textLoader, namespace: "textLoader" },
    // image is loaded in a separate staticLoader to allow for image optimization later
    { handler: staticLoader, namespace: "image", outputType: "IMAGE" },
    { handler: markdownLoader, namespace: "markdownLoader" },
    // Use the example below to create computed tag pages from the "tags" attribute found in pages
    // {
    //   source: "computed",
    //   handler: computeCollectionLoader,
    //   groupBy: "tags",
    //   groupByType: "array",
    // },
  ],
  transforms: [
    {
      outputType: "HTML",
      handler: nunjucksContentTransform,
      description: "Applying Nunjucks templates to content",
    },
    {
      outputType: "HTML",
      handler: atAttributesContentTransform,
      description: "Finding and resolving @attributes",
    },
    {
      scope: "CONTEXT",
      namespace: "image",
      handler: imageContextTransform,
      description: "Finding and preparing images to optimize",
    },
  ],
  writers: [
    { outputType: "HTML", handler: htmlWriter },
    { outputType: "IMAGE", handler: imageWriter, namespace: "image" },
    { outputType: "STATIC", handler: staticWriter },
    { scope: "CONTEXT", handler: jsonContextWriter, namespace: "sitedata" },
    { scope: "CONTEXT", handler: sitemapContextWriter, namespace: "sitemap" },
    { scope: "CONTEXT", handler: rssContextWriter, namespace: "rss" },
  ],
  // Namespaced options
  jsLoader: { match: ["**/*.js"] },
  jsonLoader: { match: ["**/*.json"] },
  markdownLoader: { match: ["**/*.md"] },
  textLoader: { match: ["**/*.html"] },
  staticLoader: {
    active: false, // set true or remove line to use the staticLoader
    // if not using the image optimization module, you can copy images with:
    // match: ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.gif"],
  },
  image: {
    active: true,
    blur: false, // turning to true requires https://github.com/verlok/vanilla-lazyload
    blurWidth: 32,
    defaultWidth: 1024,
    filename: defaultImageFilename,
    // output format of images
    formats: ["jpeg"],
    // input path and format of images
    match: ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.webp"],
    overwrite: env === "production", // if false, won't regenerate the image if already in public dir
    sizes: ["(min-width: 1024px) 1024px", "100vw"],
    widths: [320, 640, 1024, 1366, "original"],
    // resizeOptions: { /*... any option accepted by sharp.resize()*/ }
    // jpegOptions: { /*... any option accepted by sharp.jpeg()*/ }
    // webpOptions: { /*... any option accepted by sharp.webp()*/ }
    // avifOptions: { /*... any option accepted by sharp.avif()*/ }
  },
  templates: {
    collection: "collection.njk",
    default: "default.njk",
    post: "post.njk",
  },
  rss: {
    active: true,
    target: "feed.xml",
    pageFilter: (page) =>
      page.url &&
      page._meta.isPost &&
      !page.excludeFromWrite &&
      !page.excludeFromSitemap,
    xmlOptions: {
      declaration: true,
      indent: env === "production" ? null : "  ",
    },
  },
  sitedata: {
    active: true,
    omit: ["_html"], // keys to omits from context
    space: env === "production" ? null : 2,
    target: env === "production" ? process.env.KISS_DATA_FILE : "sitedata.json",
  },
  sitemap: {
    active: true,
    changeFreq: {
      home: "weekly",
      post: "weekly",
      collection: "weekly",
    },
    priority: {
      home: 1.0,
      post: 0.8,
      collection: 0.5,
    },
    target: "sitemap.xml",
    pageFilter: (page) =>
      page.url &&
      page._meta.outputType === "HTML" &&
      !page.excludeFromWrite &&
      !page.excludeFromSitemap,
    xmlOptions: {
      declaration: true,
      indent: env === "production" ? null : "  ",
    },
  },
}

module.exports = defaultConfig

/** Private  **/

// using function here to keep this pointing to config object
function addPlugin(pluginFunc, options) {
  if (typeof pluginFunc !== "function") {
    throw new Error(
      `config.addPlugin(): plugin argument should be a function, got: '${typeof pluginFunc}'`,
    )
  }
  global.logger.info(`Loading '${pluginFunc.name}' plugin`)
  pluginFunc(this, options)
}

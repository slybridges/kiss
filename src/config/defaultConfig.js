const { initialPageData } = require("../data")
const {
  loadNunjucks,
  loadNunjucksFilters,
  loadSlugify,
  loadUnslugify,
} = require("../libs")
const {
  computeCollectionLoader,
  jsLoader,
  markdownLoader,
  textLoader,
} = require("../loaders")
const {
  imageContextTransform,
  nunjucksContentTransform,
} = require("../transforms")
const {
  computeCategoriesDataView,
  computeCollectionDataView,
  computeSiteLastUpdatedDataView,
} = require("../views")
const { htmlPageWriter, imageWriter, staticPageWriter } = require("../writers")

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

const defaultConfig = {
  addPlugin: addPlugin,
  configFile: "kiss.config.js",
  context: {
    site: {
      country: "US", // ISO_3166-1_alpha-2 for locale computation along with language
      description: null,
      image: null, // default cover image
      language: "en", // ISO 639-1: https://www.w3schools.com/tags/ref_language_codes.asp
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
    maxComputingRounds: 10,
    pageData: initialPageData,
    pagePublishedAttribute: "created",
    pageUpdatedAttribute: "modified",
  },
  dirs: {
    content: "content",
    public: "public",
    theme: "theme",
    template: "theme/templates",
  },
  env: process.env.NODE_ENV,
  hooks: {
    loadLibs: [
      loadNunjucks,
      loadSlugify,
      loadUnslugify,
      loadNunjucksFilters.allFilters,
    ],
    preLoad: [],
    postLoad: [],
    postWrite: [],
  },
  image: {
    active: true,
    blur: false, // turning to true requires https://github.com/verlok/vanilla-lazyload
    // blurWidth: 32
    defaultWidth: 1024,
    filename: defaultImageFilename,
    formats: ["jpeg"], // webp, avif
    overwrite: true, // if false, won't regenerate the image if already in public dir
    sizes: ["(min-width: 1024px) 1024px", "100vw"],
    widths: [320, 640, 1024, 1366, "original"],
    // resizeOptions: { /*... any option accepted by sharp.resize()*/ }
    // jpegOptions: { /*... any option accepted by sharp.jpeg()*/ }
    // webpOptions: { /*... any option accepted by sharp.webp()*/ }
    // avifOptions: { /*... any option accepted by sharp.avif()*/ }
  },
  libs: {},
  loaders: [
    { match: ["**/*.js"], handler: jsLoader },
    { match: ["**/*.md"], handler: markdownLoader },
    { match: ["**/*.html"], handler: textLoader },
    {
      source: "computed",
      handler: computeCollectionLoader,
      groupBy: "tags",
      groupByType: "array",
    },
  ],
  transforms: [
    { outputType: "HTML", handler: nunjucksContentTransform },
    { scope: "CONTEXT", handler: imageContextTransform },
  ],
  writers: [
    { outputType: "HTML", handler: htmlPageWriter },
    { outputType: "IMAGE", handler: imageWriter },
    { outputType: "STATIC", handler: staticPageWriter },
  ],
}

module.exports = defaultConfig

/** Private  **/

// using function here to keep this pointing to config object
function addPlugin(pluginFunc, options) {
  if (typeof pluginFunc !== "function") {
    throw new Error(
      `config.addPlugin(): plugin argument should be a function, got: '${typeof pluginFunc}'`
    )
  }
  global.logger.info(`Loading '${pluginFunc.name}' plugin`)
  pluginFunc(this, options)
}

const { pathExists } = require("fs-extra")
const _ = require("lodash")
const nunjucks = require("nunjucks")
const path = require("path")
const slugify = require("slugify")
const parseISO = require("date-fns/parseISO")
const formatDate = require("date-fns/format")
const jsdom = require("jsdom")

const {
  topLevelPageData,
  computeCategoriesDataView,
  computeCollectionDataView,
} = require("./compute")
const {
  htmlLoader,
  jsLoader,
  markdownLoader,
  staticLoader,
  computeCollectionLoader,
} = require("./loaders")
const { nunjucksTransform } = require("./transforms")
const { unslugify } = require("./utils")
const {
  htmlPageWriter,
  staticPageWriter,
  jsonContextWriter,
} = require("./writers")

let defaultConfigFile = "kiss.config.js"

const loadDefaultLibs = (_, config) => {
  // set default nunjucks template dir
  config.libs.nunjucks = nunjucks.configure(config.templateDir)
  // clear nunjucks caches (for when in watch mode)
  // https://risanb.com/code/how-to-clear-nunjucks-cache/
  config.libs.nunjucks.loaders.map((loader) => (loader.cache = {}))

  // default slugify to lower case
  config.libs.slugify = (str, options) =>
    slugify(str, { lower: true, ...options })

  // default unslugify with and -> & replacement
  config.libs.unslugify = (slug, options) =>
    unslugify(slug, { words: [["and", "&"]], ...options })

  config.libs.jsdom = jsdom

  return config
}

const loadDefaultNunjucksFilters = (_, config) => {
  config.libs.nunjucks.addFilter("formatDate", (str, format) => {
    if (!str) {
      return ""
    }
    let date = typeof str === "string" ? parseISO(str) : str
    return formatDate(date, format || config.dateFormat)
  })
  config.libs.nunjucks.addFilter("unslugify", (str) =>
    config.libs.unslugify(str)
  )
  return config
}

let defaultConfig = {
  configFile: defaultConfigFile,
  contentDir: "content",
  dateFormat: "MMMM do, yyyy 'at' hh:mm aaa",
  defaultCollectionOrderBy: "-created",
  env: process.env.NODE_ENV,
  topLevelPageData,
  hooks: {
    postConfig: [loadDefaultLibs, loadDefaultNunjucksFilters],
    preLoad: [], // updates contextData
    postLoad: [], // updates contextData
    postWrite: [], // updates contextData
  },
  libs: {},
  maxComputingRounds: 10,
  publicDir: "public",
  sources: [
    { match: ["**/*.js"], loader: jsLoader },
    { match: ["**/*.md"], loader: markdownLoader },
    { match: ["**/*.html"], loader: htmlLoader },
    {
      match: ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.gif"],
      outputType: "STATIC",
      loader: staticLoader,
    },
    {
      source: "computed",
      loader: computeCollectionLoader,
      groupBy: "tags",
      groupByType: "array",
    },
  ],
  dataViews: [
    { attribute: "collections", handler: computeCollectionDataView },
    { attribute: "categories", handler: computeCategoriesDataView },
  ],
  themeDir: "theme/",
  templateDir: "theme/templates/",
  transforms: [
    { outputType: "HTML", handler: nunjucksTransform },
    //later: { scope: "CONTEXT", handler: imageTransform },
  ],
  writers: [
    { outputType: "HTML", handler: htmlPageWriter },
    { outputType: "STATIC", handler: staticPageWriter },
    //later: { outputType: "IMAGE", handler: imageWriter },
    {
      scope: "CONTEXT",
      handler: jsonContextWriter,
      space: 2,
    },
  ],
}

const loadConfig = (options = {}) => {
  let { configFile = defaultConfigFile } = options
  const relativeConfigFile = path.relative(__dirname, configFile)
  if (!pathExists(relativeConfigFile)) {
    console.info(
      `No '${relativeConfigFile}' config file found. Loading default config.`
    )
    return defaultConfig
  }
  let config = require(relativeConfigFile)
  // deep merge default and actual config, arrays are concatenated
  config = _.mergeWith({}, defaultConfig, config, (objValue, srcValue) => {
    if (_.isArray(objValue)) {
      return objValue.concat(srcValue)
    }
  })
  return config
}

module.exports = {
  loadConfig,
}

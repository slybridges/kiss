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
const { unslugify } = require("./utils")
const {
  postWriter,
  staticWriter,
  collectionWriter,
  jsonSiteWriter,
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
  defaultLayout: "base.njk",
  defaultCollectionOrderBy: "-created",
  env: process.env.NODE_ENV,
  topLevelPageData,
  hooks: {
    postConfig: [loadDefaultLibs, loadDefaultNunjucksFilters],
    preLoad: [], // updates contextData
    postLoad: [], // updates contextData
    preWrite: [], // updates contextData
    postWrite: [], // updates contextData
  },
  libs: {},
  maxComputingRounds: 5,
  publicDir: "public",
  sources: [
    {
      source: "file",
      match: ["**/*.js"],
      loader: jsLoader,
      type: "post",
    },
    {
      source: "file",
      match: ["**/*.md"],
      loader: markdownLoader,
      type: "post",
    },
    {
      source: "file",
      match: ["**/*.html"],
      loader: htmlLoader,
      type: "post",
    },
    {
      source: "file",
      match: ["**/*.jpg", "**/*.jpeg", "**/*.png", "**/*.gif"],
      loader: staticLoader,
      type: "static",
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
  writers: [
    { type: "post", handler: postWriter },
    { type: "static", handler: staticWriter },
    { type: "collection", handler: collectionWriter },
    {
      type: "site",
      handler: jsonSiteWriter,
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

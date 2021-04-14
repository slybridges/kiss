const _ = require("lodash")
const path = require("path")
const { isValidURL } = require("../helpers")
const { setGlobalLogger } = require("../logger")
const defaultConfig = require("./defaultConfig")

const loadConfig = (options = {}) => {
  // using cloneDeep here so that we get a fresh new object every time in watch mode
  const baseConfig = _.cloneDeep(defaultConfig)
  const { configFile = baseConfig.configFile } = options
  setGlobalLogger(options.verbosity) // loadConfig is called in devServer outside of dev
  const relativeConfigFile = path.relative(__dirname, configFile)
  let configFunc
  try {
    configFunc = require(relativeConfigFile)
  } catch (e) {
    throw new Error(`Error loading '${configFile}': ${e}`)
  }
  let config = configFunc(baseConfig)
  if (configFile !== baseConfig.configFile) {
    config.configFile = configFile
  }
  checkConfig(config)
  return config
}

module.exports = loadConfig

/** Private **/

const checkConfig = (config) => {
  const siteURL = _.get(config, "context.site.url")
  if (!isValidURL(siteURL)) {
    global.logger.error(
      `[checkConfig] 'context.site.url' is required and should be a valid URL (e.g. https://example.org), got ${siteURL}.`
    )
  }
  if (!_.get(config, "context.site.title")) {
    global.logger.warn(
      `[checkConfig] No site title found. We highly recommend to set it in 'context.site.title'.`
    )
  }
  if (!_.get(config, "context.site.image")) {
    global.logger.warn(
      `[checkConfig] No default image found. We highly recommend to set one in  'context.site.image'.`
    )
  }
}

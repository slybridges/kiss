const config = require("./config")
const data = require("./data")
const loaders = require("./loaders")
const transforms = require("./transforms")
const views = require("./views")
const writers = require("./writers")
const helpers = require("./helpers")

const build = require("./build")
const { start, serve, watch } = require("./devServer")

module.exports = {
  ...config,
  ...data,
  ...helpers,
  ...loaders,
  ...transforms,
  ...views,
  ...writers,
  build,
  serve,
  start,
  watch,
}

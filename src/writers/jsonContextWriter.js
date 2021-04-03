const _ = require("lodash")
const path = require("path")
const { outputFile } = require("fs-extra")

const { omitDeep } = require("../helpers")

const jsonContextWriter = async (context, options = {}, config) => {
  if (!options.target) {
    global.logger.warn(
      `[jsonContextWriter]: No 'target' passed in options. Skipping write.`
    )
    return
  }
  const siteData = options.omit ? omitDeep(context, options.omit) : context
  const jsonData = JSON.stringify(siteData, null, options.space)
  const file = path.join(config.dirs.public, options.target)
  return outputFile(file, jsonData)
}

module.exports = jsonContextWriter

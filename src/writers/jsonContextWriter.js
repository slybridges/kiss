const _ = require("lodash")
const path = require("path")
const { outputFile } = require("fs-extra")

const { omitDeep } = require("../helpers")

const jsonContextWriter = async (context, options = {}, config) => {
  options = _.merge(
    {
      target: "sitedata.json",
      space: config.env === "production" ? null : 2,
      omit: "_html",
    },
    options
  )

  const siteData = options.omit ? omitDeep(context, options.omit) : context
  const jsonData = JSON.stringify(siteData, null, options.space)
  const file = path.join(config.dirs.public, options.target)
  return outputFile(file, jsonData)
}

module.exports = jsonContextWriter

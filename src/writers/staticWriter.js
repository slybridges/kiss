const { copy } = require("fs-extra")

const staticPageWriter = async ({ _meta }) => {
  return copy(_meta.inputPath, _meta.outputPath)
}

module.exports = staticPageWriter

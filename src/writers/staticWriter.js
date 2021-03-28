const { copy } = require("fs-extra")

const staticWriter = async ({ _meta }) => {
  return copy(_meta.inputPath, _meta.outputPath)
}

module.exports = staticWriter

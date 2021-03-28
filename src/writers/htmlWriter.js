const { outputFile } = require("fs-extra")

const htmlWriter = async ({ _html, _meta }) => {
  if (!_html) {
    global.logger.warn(
      `Page '${_meta.inputPath}' has no _html content. Skipping write.`
    )
    return
  }
  return outputFile(_meta.outputPath, _html)
}

module.exports = htmlWriter

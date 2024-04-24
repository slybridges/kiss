const textLoader = require("./textLoader")

const markdownLoader = (inputPath, options, page, _, config) => {
  const fileData = textLoader(inputPath, options, page)
  const content = config.libs.marked(fileData.content)
  return { ...page, ...fileData, content }
}

module.exports = markdownLoader

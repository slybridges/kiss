const textLoader = require("./textLoader")

const markdownLoader = (id, options, page, _, config) => {
  const fileData = textLoader(id, options, page)
  const content = config.libs.marked(fileData.content)
  return { ...page, ...fileData, content }
}

module.exports = markdownLoader

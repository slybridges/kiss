const textLoader = require("./textLoader")
const marked = require("marked")

const markdownLoader = (id, options, page) => {
  const fileData = textLoader(id, options, page)
  const content = marked(fileData.content)
  return { ...page, ...fileData, content }
}

module.exports = markdownLoader

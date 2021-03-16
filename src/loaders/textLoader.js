const frontMatter = require("front-matter")
const { readFileSync } = require("fs-extra")

const textFileLoader = (id, _, page) => {
  const fileContent = readFileSync(page._meta.inputPath, "utf8")
  const fileData = frontMatter(fileContent)
  const content = fileData.body
  return { ...page, ...fileData.attributes, content }
}

module.exports = textFileLoader

const frontMatter = require("front-matter")
const { readFileSync } = require("fs-extra")

const textLoader = (inputPath, _, page) => {
  const fileContent = readFileSync(inputPath, "utf8")
  const fileData = frontMatter(fileContent)
  const content = fileData.body
  return { ...page, ...fileData.attributes, content }
}

module.exports = textLoader

const path = require("path")

const jsLoader = (id, options, page) => {
  const filePath = path.resolve(page._meta.inputPath)
  const fileData = require(filePath)
  return { ...page, ...fileData }
}

module.exports = jsLoader

const path = require("path")

const jsLoader = (inputPath, options, page) => {
  const filePath = path.resolve(inputPath)
  const fileData = require(filePath)
  return { ...page, ...fileData }
}

module.exports = jsLoader

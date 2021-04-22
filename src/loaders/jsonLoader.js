const { parseISO } = require("date-fns")
const { readJsonSync } = require("fs-extra")

const jsonLoader = (path, options, page, pages, config) => {
  let fileData = readJsonSync(path)
  const published = fileData[config.defaults.pagePublishedAttribute]
  const updated = fileData[config.defaults.pageUpdatedAttribute]
  if (published && typeof published === "string") {
    fileData[config.defaults.pagePublishedAttribut] = parseISO(published)
  }
  if (updated && typeof updated === "string") {
    fileData[config.defaults.pageUpdatedAttribute] = parseISO(updated)
  }
  return { ...page, ...fileData }
}

module.exports = jsonLoader

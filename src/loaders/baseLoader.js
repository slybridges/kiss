const path = require("path")
const _ = require("lodash")

const { getPageId, getParentId, getParentPage } = require("../helpers")

const baseLoader = (inputPath, options, page, pages, config) => {
  let parentId = getParentId(inputPath, config)
  let basename = path.basename(inputPath)
  if (basename === config.dirs.content) {
    basename = ""
  }
  const parentData = parentId ? getParentPage(pages, parentId) : {}
  let isDirectory = options.isDirectory || inputPath.endsWith("/")
  let id = options.id || getPageId(inputPath, config)
  let outputType = options.outputType || "HTML"
  let collectionGroup = options.collectionGroup
  if (outputType === "HTML") {
    // only files converted as HTML can override
    // they parent entry
    if (basename.startsWith("index.")) {
      // directory index, replace parent and most parent _meta
      id = _.get(parentData, "_meta.id", "")
      parentId = _.get(parentData, "_meta.parent", "")
      basename = _.get(parentData, "_meta.basename", "")
      isDirectory = true
    } else if (basename.startsWith("post.")) {
      // directory post, replace parent and overwrite the rest
      id = _.get(parentData, "_meta.id", "")
      parentId = _.get(parentData, "_meta.parent", "")
    }
  }
  if (isDirectory) {
    if (!collectionGroup) {
      // set default collection group to directory
      collectionGroup = "directory"
    }
  }
  page = { ...parentData, ...page }
  // deep merge metadata to keep parent ones
  page._meta = _.merge(parentData._meta, page._meta, {
    id,
    basename,
    inputPath,
    isDirectory,
    parent: parentId,
    source: options.source || "file",
    outputType,
    collectionGroup,
  })
  return page
}

module.exports = baseLoader

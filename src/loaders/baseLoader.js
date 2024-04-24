const path = require("path")
const _ = require("lodash")

const { computePageId, computeParentId, getParentPage } = require("../helpers")

const baseLoader = (
  inputPath,
  options,
  page,
  pages,
  config,
  incremental = false,
) => {
  const inputPathObject = path.parse(inputPath)
  let parentId = computeParentId(inputPath, config)
  let basename = inputPathObject.base
  if (basename === config.dirs.content) {
    basename = ""
  }
  const parentData = parentId
    ? getParentPage(pages, parentId, inputPathObject.name === "post")
    : {}
  let isDirectory = options.isDirectory || inputPath.endsWith("/")
  let id = options.id || computePageId(inputPath, config)
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
      basename = _.get(parentData, "_meta.basename", "")
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
  if (inputPathObject.name === "index") {
    // save the input path in indexInputPath in case it gets overwritten later on by a post.* file
    page._meta.indexInputPath = inputPath
  }
  if (incremental) {
    // remove potential stale data
    page = removeStaleComputedData(page)
  }
  return page
}

module.exports = baseLoader

/** Private */

const removeStaleComputedData = (page) => {
  // iterate all keys ending with _last_build and remove any corresponding key without the suffix that are not functions
  const keys = Object.keys(page)
  for (let key of keys) {
    if (key.endsWith("_last_build")) {
      const keyWithoutSuffix = key.replace(/_last_build$/, "")
      if (typeof page[keyWithoutSuffix] !== "function") {
        delete page[keyWithoutSuffix]
      }
    } else if (_.isObject(page[key])) {
      page[key] = removeStaleComputedData(page[key])
    }
  }
  return page
}

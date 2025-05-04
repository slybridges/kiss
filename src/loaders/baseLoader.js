const path = require("path")
const _ = require("lodash")

const { computePageId, computeParentId, getParentPage } = require("../helpers")

const baseLoader = (inputPath, options = {}, page = {}, pages, config) => {
  const { file, buildVersion } = options
  const inputPathObject = path.parse(inputPath)
  let parentId = computeParentId(inputPath, config)
  let basename = inputPathObject.base
  if (basename === config.dirs.content) {
    basename = ""
  }
  // FIXME: the parent data we want here is the one coming from index.* files
  // and not any that was overwritten by post.* files
  const parentData = parentId
    ? getParentPage(pages, parentId, inputPathObject.name === "post")
    : {}
  let isDirectory = options.isDirectory || inputPath.endsWith("/")
  let id = options.id || computePageId(inputPath, config)
  let outputType = options.outputType || "HTML"
  let collectionGroup = options.collectionGroup || "directory"
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
  // there can be several input sources for a page,
  // e.g. index.js, index.md, post.md
  page._meta.inputSources = pages[id]?._meta.inputSources || []
  // add the current input source if not already in the array
  if (!page._meta.inputSources.find((source) => source.path === inputPath)) {
    page._meta.inputSources.push({
      path: inputPath,
      loaderId: file?.loaderId,
    })
  }
  if (file) {
    page._meta.fileCreated = file.stats.ctime
    page._meta.fileModified = file.stats.mtime
  }
  if (buildVersion !== undefined) {
    page._meta.buildVersion = buildVersion
  }
  return page
}

module.exports = baseLoader

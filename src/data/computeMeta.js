const path = require("path")
const _ = require("lodash")

const { getParentPage, isChild, sortPages, sortPageIds } = require("../helpers")

const computeAscendants = ({ _meta }, config, { pages }) => {
  if (_meta.parent) {
    const parent = getParentPage(pages, _meta.parent)
    return [...computeAscendants(parent, config, { pages }), parent._meta.id]
  }
  return []
}
computeAscendants.kissDependencies = ["_meta.parent"]

const computeChildren = (page, config, { pages }) => {
  const sortBy = page.sortCollectionBy || config.defaults.sortCollectionBy
  const children = _.filter(pages, (child) => isChild(page, child))
  return sortPages(children, sortBy).map((page) => page._meta.id)
}
computeChildren.kissDependencies = ["_meta.parent"]

const computeDescendants = (page, config, { pages }, rootCall = true) => {
  if (!page) {
    return []
  }
  const sortBy = page.sortCollectionBy || config.defaults.sortCollectionBy
  let desc = []
  if (page._meta.children && page._meta.children.length > 0) {
    desc = page._meta.children
    page._meta.children.forEach((id) => {
      desc = _.union(
        desc,
        computeDescendants(pages[id], config, { pages }, false),
      )
    })
  }
  return rootCall ? sortPageIds(desc, pages, sortBy) : desc
}
computeDescendants.kissDependencies = ["_meta.children"]

const computeIsCollection = ({ isCollection, _meta }) =>
  isCollection || (_meta.children && _meta.children.length > 0)

computeIsCollection.kissDependencies = ["isCollection", "_meta.children"]

// In case a page is programmatically generated based only on the YAML front matter,
// it may not have a content but still be considered a post. We look into the
// _meta.isCollection to determine if the page is a collection or not in that case.
const computeIsPost = ({ content, isPost, _meta }) =>
  isPost || !!content || !_meta.isCollection

computeIsPost.kissDependencies = ["content", "isPost", "_meta.isCollection"]

const computeOutputPath = ({ permalink, _meta }, config) => {
  if (!permalink) {
    return null
  }
  // replace top level dir (dirs.content) by dirs.public
  let outputPath = path.join(config.dirs.public, permalink)
  if (outputPath.endsWith("/")) {
    return path.join(outputPath, "index.html")
  }
  // don't rely on path.extname because permalink can include dots
  if (_meta.outputType === "HTML" && !outputPath.endsWith(".html")) {
    return outputPath + ".html"
  }
  return outputPath
}

computeOutputPath.kissDependencies = ["permalink", "_meta.outputType"]

module.exports = {
  computeAscendants: computeAscendants,
  computeChildren: computeChildren,
  computeDescendants: computeDescendants,
  computeIsCollection: computeIsCollection,
  computeIsPost: computeIsPost,
  computeOutputPath: computeOutputPath,
}

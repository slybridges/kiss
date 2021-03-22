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
        computeDescendants(pages[id], config, { pages }, false)
      )
    })
  }
  return rootCall ? sortPageIds(desc, pages, sortBy) : desc
}
computeDescendants.kissDependencies = ["_meta.children"]

const computeIsCollection = ({ _meta }) =>
  _meta.children && _meta.children.length > 0

computeIsCollection.kissDependencies = ["_meta.children"]

const computeIsPost = ({ content }) => !!content

computeIsPost.kissDependencies = ["content"]

const computeOutputPath = ({ permalink }, config) => {
  // replace top level dir (dirs.content) by dirs.public
  let outputPath = path.join(config.dirs.public, permalink)
  if (outputPath.endsWith("/")) {
    return path.join(outputPath, "index.html")
  }
  if (path.extname(outputPath) === "") {
    return outputPath + ".html"
  }
  return outputPath
}

computeOutputPath.kissDependencies = ["permalink"]

module.exports = {
  computeAscendants: computeAscendants,
  computeChildren: computeChildren,
  computeDescendants: computeDescendants,
  computeIsCollection: computeIsCollection,
  computeIsPost: computeIsPost,
  computeOutputPath: computeOutputPath,
}
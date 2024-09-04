const _ = require("lodash")
const { getDescendantPages } = require("../helpers")

const computeCollectionDataView = ({ pages }, options = {}, config) => {
  if (options.isRootCall === undefined) {
    options.isRootCall = true
  }
  if (!options.parent) {
    options.parent = "."
  }
  let collections = _.filter(
    pages,
    ({ _meta }) => _meta.isCollection && _meta.parent === options.parent,
  ).reduce((collections, page) => {
    if (!page._meta.descendants) {
      return collections
    }
    let key = _.camelCase(page._meta.basename)
    return {
      ...collections,
      [key]: {
        _id: page._meta.id,
        _type: "collection",
        _group: page._meta.collectionGroup,
        allPosts: getAllPosts(page, pages, config),
        ...computeCollectionDataView(
          { pages },
          { ...options, parent: page._meta.id, isRootCall: false },
          config,
        ),
      },
    }
  }, {})
  if (options.isRootCall) {
    collections.allPosts = getAllPosts(pages["."], pages, config)
  }
  return collections
}

module.exports = computeCollectionDataView

const getAllPosts = (page, pages, config) =>
  getDescendantPages(page, pages, {
    filterBy: (p) =>
      p._meta.isPost &&
      p.permalink &&
      !p.excludeFromCollection &&
      !p.excludeFromWrite,
    sortBy: page.sortCollectionBy || config.defaults.sortCollectionBy,
    skipUndefinedSort: true,
  })

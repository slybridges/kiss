const _ = require("lodash")
const path = require("path")

const baseLoader = require("./baseLoader")

const computeCollectionLoader = (pages, options, config) => {
  const { libs } = config
  let normalizedPages
  if (!options.groupBy) {
    throw new Error("computeCollectionLoader needs a groupBy option.")
  }
  options.pageData = options.pageData || pages["."]
  options.filter = options.filter || ((page) => !!page.content) //no access to isPost yet (we're pre-cascade)
  options.name = options.name || options.groupBy
  let baseLink = path.join(
    "/",
    options.baseLink || libs.slugify(options.groupBy)
  )
  if (options.groupByType === "array") {
    if (typeof options.groupBy !== "string") {
      throw new Error(
        "computeCollectionLoader: groupBy options needs to be a string"
      )
    }
    // we need to normalize pages to list each array element individually
    normalizedPages = _.reduce(
      pages,
      (result, page) => {
        let elements = _.get(page, options.groupBy)
        if (!elements) {
          return result
        }
        if (!_.isArray(elements)) {
          // not iterable, lets use it as groupKey
          result.push({ ...page, _groupKey: elements })
          return result
        }
        elements.map((element) => result.push({ ...page, _groupKey: element }))
        return result
      },
      []
    )
    options.groupBy = "_groupKey"
  } else {
    normalizedPages = pages
  }
  const groupedPages = _.chain(normalizedPages)
    .filter(options.filter)
    .groupBy(options.groupBy)
    // don't include pages that result in 'undefined' key during groupBy
    .omit(undefined)
    .map((pages, collection) => ({
      collection,
      children: pages.map((page) => page._meta.id),
    }))
    .value()

  // add the main top level page
  const inputPath = path.join(config.dirs.content, baseLink)

  let topLevelPage = baseLoader(
    inputPath,
    { source: "computed", collectionGroup: options.name },
    {},
    pages,
    config
  )
  pages[topLevelPage._meta.id] = topLevelPage

  // individual pages
  _.forEach(groupedPages, ({ collection, children }) => {
    let inputPath = path.join(
      config.dirs.content,
      baseLink,
      libs.slugify(collection)
    )
    let computedPage = baseLoader(
      inputPath,
      { source: "computed", collectionGroup: options.name },
      {
        _meta: {
          children,
          descendants: children,
        },
      },
      pages,
      config
    )
    pages[computedPage._meta.id] = computedPage
  })
  return { ...pages }
}

module.exports = computeCollectionLoader

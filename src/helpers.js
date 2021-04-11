const _ = require("lodash")
const path = require("path")

const findCollectionById = (collections, id) => {
  const flatCollections = flattenObjects(
    collections,
    (v) => v._type === "collection"
  )
  return flatCollections.find((collection) => collection._id === id)
}

const flattenObjects = (obj, predicate) => {
  let flatArray = []
  _.forEach(obj, (value) => {
    if (_.isPlainObject(value) && predicate(value)) {
      flatArray.push(value)
      flatArray = [...flatArray, ...flattenObjects(value, predicate)]
    }
  })
  return flatArray
}

const getAbsolutePath = (pathname, basePath, options = {}) => {
  if (typeof pathname !== "string") {
    throw new Error(
      `[getAbsolutePath]: expected path to be a string, got '${typeof pathname}'.`
    )
  }
  if (isValidURL(pathname) || path.isAbsolute(pathname)) {
    // don't change urls or absolute paths
    return pathname
  }
  if (!isValidPath(pathname)) {
    if (options.throwIfInvalid) {
      throw new Error(`[getAbsolutePath]: Path '${pathname}' is invalid`)
    }
    return pathname
  }
  if (!isValidPath(basePath)) {
    throw new Error(`[getAbsolutePath]: basePath '${basePath}' is invalid`)
  }
  return path.join(basePath, pathname)
}

const getAbsoluteURL = (url = "", baseURL) => {
  if (isValidURL(url)) {
    // already absolute
    return url
  }
  const invalidPrefixes = ["#", "mailto:", "tel:"]
  if (_.some(invalidPrefixes, (prefix) => url.startsWith(prefix))) {
    // non-path links
    return url
  }
  if (!isValidURL(baseURL)) {
    throw new Error(
      `[${this.name}]: baseURL but be a valid URL, got ${baseURL}.`
    )
  }
  // valid path, make it absolute
  return new URL(url, baseURL).href
}

const getChildrenPages = (page, pages, filterOptions) => {
  const children = page._meta.children.map((c) => pages[c])
  if (filterOptions) {
    return _.filter(children, filterOptions)
  }
  return children
}

const getDescendantPages = (
  page,
  pages,
  { filterBy, sortBy, skipUndefinedSort } = {}
) => {
  let descendants = page._meta.descendants.map((desc) => pages[desc])
  if (filterBy) {
    descendants = _.filter(descendants, filterBy)
  }
  if (sortBy) {
    descendants = sortPages(descendants, sortBy, { skipUndefinedSort })
  }
  return descendants
}

const getLocale = (context, sep = "-") => {
  const locale = _.get(context, "site.locale")
  if (!locale) {
    return ""
  }
  if (_.isArray(locale)) {
    return locale.join(sep)
  }
  if (typeof locale == "string") {
    return locale
  }
  return ""
}

const getPageId = (inputPath, config) => {
  let topDir = config.dirs.content
  if (config.dirs.content.endsWith("/")) {
    topDir = topDir.slice(0, -1)
  }
  // replace top dir name by "."
  return inputPath.replace(new RegExp("^" + topDir), ".")
}

const getParentId = (inputPath, config) => {
  const parentPath = path.dirname(inputPath)
  if (parentPath === ".") {
    return null
  }
  return getPageId(parentPath, config)
}

// returns the parent sanitizing the data for the cascade
const getParentPage = (pages, id) => {
  let parent = pages[id]
  if (!parent) {
    global.logger.error(`Couldn't find parent with id '${id}'`)
    console.log(Object.keys(pages))
  }
  return omitNoCascadeAttributes(parent)
}

const isChild = (page, child) => child._meta.parent === page._meta.id

const isValidPath = (path) => {
  if (typeof path !== "string") {
    throw new Error(
      `[isValidPath]: expected path to be a string, got '${typeof path}'.`
    )
  }
  const invalidPathPrefixes = ["#", "mailto:", "tel:"]
  return !_.some(invalidPathPrefixes, (prefix) => path.startsWith(prefix))
}

const isValidURL = (url) => {
  try {
    return !!new URL(url)
  } catch {
    return false
  }
}

// hacked from https://github.com/jonschlinkert/omit-deep
const omitDeep = (object, keys) => {
  if (!_.isObject(object)) {
    return object
  }
  if (Array.isArray(object)) {
    object = object.map((item) => omitDeep(item, keys))
    return object
  }
  if (typeof keys === "string") {
    keys = [keys]
  }
  if (!Array.isArray(keys)) {
    return object
  }
  keys.forEach((key) => (object = _.omit(object, key)))
  for (var key in object) {
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      object[key] = omitDeep(object[key], keys)
    }
  }
  return object
}

const sortPageIds = (ids, pages, sortBy, options) => {
  const pagesToSort = ids.map((id) => pages[id])
  return sortPages(pagesToSort, sortBy, options).map((page) => page._meta.id)
}

const sortPages = (pages, sortBy, { skipUndefinedSort } = {}) => {
  let order = "asc"
  if (sortBy[0] === "-") {
    order = "desc"
    sortBy = sortBy.slice(1)
  }
  if (skipUndefinedSort) {
    // remove entries without the sort attribute
    pages = _.reject(pages, (page) => _.get(page, sortBy) === undefined)
  }
  pages = _.orderBy(pages, sortBy, order)
  return pages
}

module.exports = {
  findCollectionById,
  getAbsolutePath,
  getAbsoluteURL,
  getChildrenPages,
  getDescendantPages,
  getLocale,
  getPageId,
  getParentId,
  getParentPage,
  isChild,
  isValidURL,
  omitDeep,
  sortPageIds,
  sortPages,
}

/** private **/

// removing any key ending with _no_cascade
const omitNoCascadeAttributes = (obj) => {
  let result = {}
  _.forEach(obj, (value, key) => {
    if (_.isPlainObject(value)) {
      result[key] = omitNoCascadeAttributes(value)
    } else if (!key.endsWith("_no_cascade")) {
      result[key] = value
    }
  })
  return result
}

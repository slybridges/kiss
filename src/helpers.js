const _ = require("lodash")
const fs = require("fs")
const path = require("path")

// @ attribute format: @<attribute>:<value><terminator>
// terminators: space, comma, newline, end of string, ', ",<, >, ), ], }, #
const AT_GENERIC_ATTRIBUTE_REGEX =
  /@([a-zA-Z0-9-_]+):([^,\s\n\]'"<>)}#]+)(?=[,\s\n\]'"<>)}#]|$)/g

const AT_FILE_ATTRIBUTE_REGEX =
  /@file:([^,\s\n\]'"<>)}#]+)(?=[,\s\n\]'"<>)}#]|$)/g

const computePageId = (inputPath, config) => {
  let topDir = config.dirs.content
  if (config.dirs.content.endsWith("/")) {
    topDir = topDir.slice(0, -1)
  }
  // replace top dir name by "."
  return inputPath.replace(new RegExp("^" + topDir), ".")
}

const computeParentId = (inputPath, config) => {
  const parentPath = path.dirname(inputPath)
  if (parentPath === ".") {
    return null
  }
  return computePageId(parentPath, config)
}

const findCollectionById = (collections, id) => {
  if (id === ".") {
    return collections
  }
  const flatCollections = flattenObjects(
    collections,
    (v) => v._type === "collection",
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
      `[${this.name}]: baseURL but be a valid URL, got ${baseURL}.`,
    )
  }
  // valid path, make it absolute
  return new URL(url, baseURL).href
}

const getBuildEntries = (context, buildFlags) => {
  const { pages } = context
  const { buildPageIds } = buildFlags
  if (buildPageIds?.length > 0) {
    return buildPageIds.map((id) => [id, pages[id]])
  }
  return Object.entries(pages)
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
  { filterBy, sortBy, skipUndefinedSort } = {},
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

const getFullPath = (pathname, basePath, options = {}) => {
  if (typeof pathname !== "string") {
    throw new Error(
      `[getFullPath]: expected path to be a string, got '${typeof pathname}'.`,
    )
  }
  if (isValidURL(pathname)) {
    // don't change urls
    return pathname
  }
  if (path.isAbsolute(pathname)) {
    // prefix absolute paths with absoluteBase, if any
    return options.absoluteBase
      ? path.join(options.absoluteBase, pathname)
      : pathname
  }
  if (!isValidPath(pathname)) {
    if (options.throwIfInvalid) {
      throw new Error(`[getFullPath]: Path '${pathname}' is invalid`)
    }
    return pathname
  }
  if (!isValidPath(basePath)) {
    throw new Error(`[getFullPath]: basePath '${basePath}' is invalid`)
  }
  return path.join(basePath, pathname)
}

/** Computes the input path based on the permalink by checking if the parent
 *  had a permalink different than their input path */
const getInputPath = (permalink, pages, baseContentPath) => {
  const pathObject = path.parse(permalink)
  // search if a have a parent corresponding to this permalink's dir
  const parent = _.find(
    pages,
    (page) => page.permalink === pathObject.dir + "/",
  )
  if (!parent) {
    // no result: assume inputPath same as permalink
    return path.join(baseContentPath, permalink)
  }
  const parentInputPath = parent._meta.isDirectory
    ? parent._meta.inputPath
    : path.dirname(parent._meta.inputPath)
  return path.join(
    parentInputPath, // inputPath of parent's dir
    pathObject.base, // filename
  )
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

const getPageFromInputPath = (inputPath, pages) => {
  const pageValues = Object.values(pages)
  let page = pageValues.find((p) =>
    p._meta.inputSources.map((s) => s.path).includes(inputPath),
  )
  return page
}

// Tries to find the page corresponding to the source
// @attributes should have been resolved by mow
// Supports absolute, and relative paths
const getPageFromSource = (source, parentPage, pages, config, options = {}) => {
  // source may have URL entities encoded. Decode them
  source = decodeURI(source)
  const { throwIfNotFound = true } = options
  // value is a path: compute the permalink in case it is a relative path
  const permalink = getFullPath(source, parentPage.permalink, {
    throwIfInvalid: true,
  })
  const page = Object.values(pages).find(
    (p) =>
      p.permalink === permalink ||
      // in incremental builds,
      // also search in derivatives in case the image source was already replaced during previous build
      p.derivatives?.find((d) => d.permalink === permalink),
  )
  if (!page) {
    if (throwIfNotFound) {
      throw new Error(
        `Page '${source}' not found. Either it doesn't exist or it wasn't loaded.'`,
      )
    }
    return null
  }
  return { ...page }
}

// returns the parent sanitizing the data for the cascade
const getParentPage = (pages, id, isPostAsking) => {
  let parent = pages[id]
  if (!parent) {
    global.logger.error(`Couldn't find parent with id '${id}'`)
    return null
  }
  if (!isPostAsking) {
    // omit attributes that shouldn't cascade, unless the page asking is a post
    const attributesToOmit = ["_meta.inputSources"]
    parent = _.omit(parent, attributesToOmit)
  }
  return omitNoCascadeAttributes(parent)
}

const isChild = (page, child) => child._meta.parent === page._meta.id

const isValidPath = (path) => {
  if (typeof path !== "string") {
    throw new Error(
      `[isValidPath]: expected path to be a string, got '${typeof path}'.`,
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
  if (!_.isObject(object) || object instanceof Date) {
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

// This is the first step of @attribute management
// We need to convert all @attributes to their absolute values
// We need to do this before data cascade as some content with relative values
// may end up in other pages during the cascade. It is thus important we do have absolute values everywhere
// This step will also check that all @file values actually exist
const relativeToAbsoluteAttributes = (page, options, config) => {
  // go through all page attributes that don't start with _
  for (const attribute in page) {
    page[attribute] = relativeToAbsolute(page[attribute], page, config)
  }
  return page
}

const relativeToAbsolute = (attributeValue, { _meta }, config) => {
  // let's find all at attributes in the attribute
  let match
  if (typeof attributeValue === "string") {
    while ((match = AT_FILE_ATTRIBUTE_REGEX.exec(attributeValue))) {
      let [fullMatch, value] = match
      const parentInputPath = _meta.isDirectory
        ? _meta.inputPath
        : path.dirname(_meta.inputPath)
      // we need to remove the content dir from the parent path to get their absolute path
      const parentAbsolutePath =
        "/" + path.relative(config.dirs.content, parentInputPath)
      const absolutePath = getFullPath(value, parentAbsolutePath, {
        throwIfInvalid: true,
      })
      // replace the value with the absolute path
      attributeValue = attributeValue.replaceAll(
        fullMatch,
        `@file:${absolutePath}`,
      )
      // tests that the file exists
      const fullRelativePath = path.relative(
        process.cwd(),
        path.join(".", config.dirs.content, absolutePath),
      )
      if (!fs.existsSync(fullRelativePath)) {
        global.logger.warn(
          `Page '${_meta.inputPath}': @file not found ${value} (full path: ${fullRelativePath})`,
        )
      }
    }
  } else if (typeof attributeValue === "object") {
    for (const key in attributeValue) {
      attributeValue[key] = relativeToAbsolute(
        attributeValue[key],
        { _meta },
        config,
      )
    }
  }
  return attributeValue
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
  AT_FILE_ATTRIBUTE_REGEX,
  AT_GENERIC_ATTRIBUTE_REGEX,
  computePageId,
  computeParentId,
  findCollectionById,
  getAbsoluteURL,
  getBuildEntries,
  getChildrenPages,
  getDescendantPages,
  getFullPath,
  getInputPath,
  getLocale,
  getPageFromInputPath,
  getPageFromSource,
  getParentPage,
  isChild,
  isValidURL,
  omitDeep,
  relativeToAbsoluteAttributes,
  sortPageIds,
  sortPages,
}

/** private **/

// removing any key ending with _no_cascade
const omitNoCascadeAttributes = (obj) => {
  let result = _.isArray(obj) ? [] : {}
  _.forEach(obj, (value, key) => {
    if (_.isPlainObject(value) || _.isArray(value)) {
      result[key] = omitNoCascadeAttributes(value)
    } else if (typeof key === "number" || !key.endsWith("_no_cascade")) {
      result[key] = value
    }
  })
  return result
}

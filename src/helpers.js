const _ = require("lodash")
const fs = require("fs")
const path = require("path")
const {
  findPageByPermalink,
  findPageByDerivative,
  findParentByPermalink,
} = require("./indexing")

// @ attribute format: @<attribute>:<value><terminator>
// terminators: space, comma, newline, end of string, ', ",<, >, ), ], }, #, \
const AT_GENERIC_ATTRIBUTE_REGEX =
  /@([\w-]+):([^,\s\]'"<>\\)}#]+)(?=[,\s\]'"<>\\)}#]|$)/g

const AT_FILE_ATTRIBUTE_REGEX =
  /@file:([^,\s\]'"<>\\)}#]+)(?=[,\s\]'"<>\\)}#]|$)/g

const computePageId = (inputPath, config) => {
  const imputPathObject = path.parse(inputPath)
  // if the name is post or index, remove the basename
  if (["post", "index"].includes(imputPathObject.name)) {
    return computePageId(path.dirname(inputPath), config)
  }
  // remove the content dir from the input path
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

const getBuildEntries = (context, buildFlags, options = {}) => {
  const { pages } = context
  const { includingImages } = options
  // using a Set to avoid duplicates
  const ids = new Set(
    buildFlags?.buildPageIds && buildFlags.buildPageIds.length > 0
      ? buildFlags.buildPageIds
      : Object.keys(pages),
  )

  if (includingImages) {
    // Search for images that are used by the pages to be built
    Object.values(pages)
      .filter(
        (page) =>
          page._meta.outputType === "IMAGE" &&
          page.sources?.some((source) => ids.has(source)),
      )
      .forEach((page) => ids.add(page._meta.id))
  }
  return [...ids].map((id) => [id, pages[id]]).filter(([, page]) => !!page) // remove undefined pages (can happen during build errors)
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
const getInputPath = (permalink, pages, baseContentPath, indexes) => {
  const pathObject = path.parse(permalink)
  const parentPermalink = pathObject.dir + "/"

  // search if a have a parent corresponding to this permalink's dir
  const parent = findParentByPermalink(indexes, parentPermalink, pages)

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
  // O(n) search - this is only used in build.js where indexes aren't available
  return Object.values(pages).find((page) => {
    return page._meta?.inputSources?.some((source) => source.path === inputPath)
  })
}

// Tries to find the page corresponding to the source
// @attributes should have been resolved by now
// Supports absolute, and relative paths
const getPageFromSource = (source, parentPage, pages, config, options = {}) => {
  // source may have URL entities encoded. Decode them
  source = decodeURI(source)
  const { throwIfNotFound = true, indexes } = options
  // value is a path: compute the permalink in case it is a relative path
  const permalink = getFullPath(source, parentPage.permalink, {
    throwIfInvalid: true,
  })

  const page =
    findPageByPermalink(indexes, permalink, pages) ||
    // in incremental builds, we also search in derivatives in case the image source was already replaced during previous build
    findPageByDerivative(indexes, permalink, pages)

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

// Placeholder constants used by jsonSafeStringify/jsonSafeParse
// These unique strings replace special JS values that JSON can't handle
const JSON_PLACEHOLDERS = {
  FUNCTION: "__KISS_FUNCTION__",
  UNDEFINED: "__KISS_UNDEFINED__",
  DATE: "__KISS_DATE__",
}

/**
 * Converts a JavaScript object to a JSON string while preserving special values
 * that JSON.stringify normally can't handle (functions, dates, undefined).
 *
 * @param {Object} obj - The object to stringify
 * @returns {Object} { jsonStr: string, specialValues: Map } - The JSON string and a map of special values
 */
const jsonSafeStringify = (obj) => {
  const specialValues = new Map()

  const replacer = (key, value) => {
    // Handle functions - store them and replace with placeholder
    if (typeof value === "function") {
      const id = `${JSON_PLACEHOLDERS.FUNCTION}_${specialValues.size}`
      specialValues.set(id, value)
      return id
    }
    // Handle dates - store them and replace with placeholder
    if (value instanceof Date) {
      const id = `${JSON_PLACEHOLDERS.DATE}_${specialValues.size}`
      specialValues.set(id, value)
      return id
    }
    // Handle undefined - store it and replace with placeholder
    if (value === undefined) {
      const id = `${JSON_PLACEHOLDERS.UNDEFINED}_${specialValues.size}`
      specialValues.set(id, undefined)
      return id
    }
    return value
  }

  const jsonStr = JSON.stringify(obj, replacer)
  return { jsonStr, specialValues }
}

/**
 * Parses a JSON string back to an object while restoring special values
 * that were replaced with placeholders during jsonSafeStringify.
 *
 * JSON.parse's reviver function DELETES properties when undefined is returned
 * This causes properties with undefined values to be lost entirely, so we don't use this feature.
 * Instead, We use a two-phase approach to get around this issue:
 * 1. Parse the JSON normally to get object structure
 * 2. Walk the object and restore special values in-place
 * This preserves properties that have undefined values.
 *
 * @param {string} jsonStr - The JSON string to parse
 * @param {Map} specialValues - Map of placeholders to their original values
 * @returns {Object} - The restored JavaScript object with all special values intact
 */
const jsonSafeParse = (jsonStr, specialValues) => {
  // First parse normally to get the object structure
  const parsed = JSON.parse(jsonStr)

  // Then walk through and restore special values
  const restoreSpecialValues = (obj) => {
    if (obj === null || typeof obj !== "object") {
      return obj
    }

    for (const key in obj) {
      const value = obj[key]

      if (typeof value === "string") {
        // Check if this is a placeholder that needs restoration
        if (
          value.startsWith(JSON_PLACEHOLDERS.FUNCTION) ||
          value.startsWith(JSON_PLACEHOLDERS.DATE) ||
          value.startsWith(JSON_PLACEHOLDERS.UNDEFINED)
        ) {
          if (specialValues.has(value)) {
            obj[key] = specialValues.get(value)
          }
        }
      } else if (typeof value === "object" && value !== null) {
        // Recursively process nested objects
        restoreSpecialValues(value)
      }
    }

    return obj
  }

  return restoreSpecialValues(parsed)
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
  jsonSafeParse,
  jsonSafeStringify,
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

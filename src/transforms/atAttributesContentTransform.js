const _ = require("lodash")
const path = require("path")

const { AT_GENERIC_ATTRIBUTE_REGEX } = require("../helpers")

const atAttributesContentTransform = (page, options, config, context) => {
  // we need to go though all the keys in the page
  // that will be expensive, but YOLO
  for (const objKey in page) {
    if (typeof page[objKey] === "string" || typeof page[objKey] === "object") {
      let objValue = transformAtAttributesInObjValue(
        objKey,
        page[objKey],
        page,
        config,
        context,
      )
      page[objKey] = objValue
    }
  }

  return page
}

module.exports = atAttributesContentTransform

/** Private */

const transformAtAttributesInObjValue = (
  objKey,
  objValue,
  page,
  config,
  context,
) => {
  let match
  const resolvers = [
    { key: "data", handler: dataAttributeResolver },
    { key: "file", handler: fileAttributeResolver, pageAttribute: "permalink" },
    { key: "id", handler: idAttributeResolver, pageAttribute: "permalink" },
    {
      key: "permalink",
      handler: permalinkAttributeResolver,
      pageAttribute: "permalink",
    },
  ]
  if (typeof objValue === "object") {
    // we need to go though all the keys in the object
    for (const key in objValue) {
      if (typeof objValue[key] === "string") {
        let newValue = transformAtAttributesInObjValue(
          key,
          objValue[key],
          page,
          config,
          context,
        )
        objValue[key] = newValue
      }
    }
    return objValue
  }
  if (typeof objValue !== "string") {
    return objValue
  }
  // we cannot search and replace things as we go, as some attributes may overlap others (e.g. @id:home and @id:home:fr)
  // so first, we are going to find all the attributes
  let allAttributes = {}
  while ((match = AT_GENERIC_ATTRIBUTE_REGEX.exec(objValue))) {
    let [fullMatch, attribute, value] = match
    // using an object to deduplicate attributes
    allAttributes[fullMatch] = { attribute, fullMatch, value }
  }
  // we sort attributes by their fullMatch length to make sure we replace the longest first
  // this is important to make sure we don't replace a shorter attribute that is part of a longer one
  const sortedAttributes = Object.values(allAttributes).sort(
    (a, b) => b.fullMatch.length - a.fullMatch.length,
  )
  // now we can go through all the attributes and resolve them
  for (const { attribute, fullMatch, value } of sortedAttributes) {
    // find the resolver
    const resolver = resolvers.find((r) => r.key === attribute)
    if (!resolver) {
      global.logger.error(
        `Page '${page._meta.id}' in '${objKey}': unknown @attribute '${attribute}'`,
      )
      continue
    }
    const [result, error] = resolver.handler(value, page, config, context)
    if (error) {
      global.logger.error(`Page '${page._meta.id}' in '${objKey}': ${error}`)
      objValue = objValue.replaceAll(fullMatch, value)
      continue
    }
    if (resolver.pageAttribute) {
      // result is a page
      // first we check if the page is excluded from write
      if (result.excludeFromWrite) {
        global.logger.error(
          `Page '${page._meta.id}' in '${objKey}': @${attribute} resolved '${value}' but page is marked as excludeFromWrite`,
        )
        objValue = objValue.replaceAll(fullMatch, value)
        continue
      }
      // then we check if the page has the attribute we need
      if (!result[resolver.pageAttribute]) {
        global.logger.error(
          `Page '${page._meta.id}' in '${objKey}': @${attribute} resolved '${value}' but page is missing attribute '${resolver.pageAttribute}'`,
        )
        objValue = objValue.replaceAll(fullMatch, value)
        continue
      }
      // replace the fullMatch with the page attribute
      objValue = objValue.replaceAll(fullMatch, result[resolver.pageAttribute])
    } else {
      // result is a string
      objValue = objValue.replaceAll(fullMatch, result)
    }
  }
  return objValue
}

/** Resolvers */

// @data takes a path from the context object and returns its value
// Example: @data:site.signupURL
const dataAttributeResolver = (attributeParams, page, config, context) => {
  // Data references a path from the context
  const value = _.get(context, attributeParams)
  if (value !== undefined) {
    return [value, null]
  } else {
    return [null, `@data '${attributeParams}' attribute not found in context`]
  }
}

// @file takes a path from the content directory
// At this stage, we know we have the full path already
// it was computed during file loading
// Search if a have a page with that inputPath
const fileAttributeResolver = (filepath, page, config, context) => {
  if (!path.isAbsolute(filepath)) {
    return [null, `@file '${filepath}' must be absolute at this point`]
  }
  const pageFound = Object.values(context.pages).find(
    (page) => page._meta.inputPath === path.join(config.dirs.content, filepath),
  )
  if (!pageFound) {
    return [null, `@file not found '${filepath}'`]
  }
  return [pageFound, null]
}

// @id at attributes take an id an optional lang+fallback if the id is not found in the current lang
// Example:
// - simple: @id:about (if page is not found in lang it will return the page in the default lang)
// - with fall back id: @id:about:home
// - with lang and fallback: @id:about:home:fr
// We will return the permalink of the page with corresponding id and lang or default lang otherwise
const idAttributeResolver = (attributeParams, page, config, context) => {
  // Split the value to get the id and fallback
  const defaultLang =
    _.get(context, "site.lang") || _.get(context, "site.locale[0]")
  const [id, fallback, langParam] = attributeParams.split(":")
  const isIdOnly = id && !fallback && !langParam
  let pageFound

  const lang = langParam || page.lang

  if (id) {
    // try to find the with lang and id
    let pageFound = Object.values(context.pages).find(
      (p) => p.id === id && p.lang === lang,
    )
    if (pageFound) {
      return [pageFound, null]
    }
  }
  if (isIdOnly && lang !== defaultLang) {
    // try to find the page in the default site lang
    pageFound = Object.values(context.pages).find(
      (p) => p.id === id && p.lang === defaultLang,
    )
    if (pageFound) {
      return [pageFound, null]
    }
    return [
      null,
      `@id '${id}' not found in lang '${lang}' nor default lang '${defaultLang}'`,
    ]
  }
  // no id or id not found
  if (fallback) {
    // try to find the fallback page
    pageFound = Object.values(context.pages).find(
      (p) => p.id === fallback && p.lang === lang,
    )
    if (pageFound) {
      return [pageFound, null]
    } else {
      return [null, `fallback @id '${fallback}' not found in lang '${lang}'`]
    }
  }
  return [null, `@id '${id}' not found in lang '${lang}'`]
}

const permalinkAttributeResolver = (permalink, page, config, context) => {
  // check if we have a page with this permalink
  const pageFound = Object.values(context.pages).find(
    (page) => page.permalink === permalink,
  )
  if (pageFound) {
    return [pageFound, null]
  } else {
    return [null, `@permalink not found '${permalink}'`]
  }
}

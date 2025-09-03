const _ = require("lodash")
const path = require("path")

const {
  AT_GENERIC_ATTRIBUTE_REGEX,
  jsonSafeStringify,
  jsonSafeParse,
} = require("../helpers")

/**
 * Transform that finds and resolves @attributes in page content.
 *
 * PERFORMANCE OPTIMIZATION HISTORY:
 * v1: Recursive object traversal - O(n*m*p) where n=pages, m=properties, p=depth
 * v2: JSON string manipulation - 4-5x faster on large sites
 * v3: Added centralized indexing with direct Map access - 7x faster
 *
 * CURRENT APPROACH:
 * Instead of recursively traversing every property of every page object,
 * we use JSON string manipulation combined with direct index lookups:
 *
 * 1. Convert entire page to JSON string once - O(m)
 * 2. Find all @attributes with single regex scan - O(s) where s=string length
 * 3. Resolve each unique @attribute once using direct Map lookups - O(a) where a=unique attributes
 * 4. Apply all replacements in single pass - O(s)
 * 5. Parse back to object - O(m)
 *
 * FURTHER PERFORMANCE NOTE:
 * We use DIRECT Map.get() calls instead of helper  findPageBy* functions. This is intentional!
 * For sites with ~1M attribute lookups, wrapper function overhead is significant.
 * Each resolver uses context._pageIndexes?.byXXX?.get(key) directly.
 * DO NOT refactor to use helper functions without benchmarking first.
 */

const atAttributesContentTransform = (page, options, config, context) => {
  const { jsonStr, specialValues } = jsonSafeStringify(page)
  // Bail out early for pages without @attributes
  // Quick string check is much faster than regex or traversal
  if (!jsonStr.includes("@")) {
    return page
  }

  // Find all unique @attributes in the JSON string
  // Using matchAll to get all matches at once is more efficient than exec() in a loop
  const matches = [...jsonStr.matchAll(AT_GENERIC_ATTRIBUTE_REGEX)]
  if (matches.length === 0) {
    return page // No attributes to process despite having @
  }

  // PERFORMANCE OPTIMIZATION:
  // Create inline lookup helpers that use indexes when available, fallback when not.
  // These are defined INSIDE the transform to be inlined by V8's optimizer.
  // DO NOT move to external functions - adds measurable overhead at scale!
  const hasIndexes = !!context._pageIndexes
  const pages = context.pages

  // Inline helper for permalink lookups - most common type
  const findByPermalink = hasIndexes
    ? (permalink) => context._pageIndexes.byPermalink.get(permalink)
    : (permalink) =>
        Object.values(pages).find(
          (p) =>
            p.permalink === permalink ||
            p.derivatives?.find((d) => d.permalink === permalink),
        )

  // Inline helper for input path lookups
  const findByInputPath = hasIndexes
    ? (path) => context._pageIndexes.byInputPath.get(path)
    : (path) => Object.values(pages).find((p) => p._meta?.inputPath === path)

  // Inline helper for ID+lang lookups
  const findByIdAndLang = hasIndexes
    ? (id, lang) => context._pageIndexes.byIdAndLang.get(`${id}:${lang}`)
    : (id, lang) =>
        Object.values(pages).find((p) => p.id === id && p.lang === lang)

  // Build replacement map - resolve each unique @attribute only once
  // This avoids redundant resolutions for repeated attributes
  const replacements = new Map()
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

  // Process each unique @attribute
  for (const match of matches) {
    const [fullMatch, attribute, value] = match

    // Skip already resolved attributes (deduplication)
    if (replacements.has(fullMatch)) {
      continue
    }

    // Find the appropriate resolver for this attribute type
    const resolver = resolvers.find((r) => r.key === attribute)
    if (!resolver) {
      global.logger.error(
        `Page '${page._meta.id}': unknown @attribute '${attribute}'`,
      )
      replacements.set(fullMatch, value) // Keep original value on error
      continue
    }

    // Resolve the attribute using the appropriate handler
    // Pass the inline lookup helpers for use by resolvers
    const [result, error] = resolver.handler(value, page, config, context, {
      findByPermalink,
      findByInputPath,
      findByIdAndLang,
    })
    if (error) {
      global.logger.error(`Page '${page._meta.id}': ${error}`)
      replacements.set(fullMatch, value) // Keep original value on error
      continue
    }

    // Handle page references vs direct values
    if (resolver.pageAttribute) {
      // Result is a page object - extract the requested attribute
      if (result.excludeFromWrite) {
        global.logger.error(
          `Page '${page._meta.id}': @${attribute} resolved '${value}' but page is marked as excludeFromWrite`,
        )
        replacements.set(fullMatch, value)
        continue
      }
      if (!result[resolver.pageAttribute]) {
        global.logger.error(
          `Page '${page._meta.id}': @${attribute} resolved '${value}' but page is missing attribute '${resolver.pageAttribute}'`,
        )
        replacements.set(fullMatch, value)
        continue
      }
      replacements.set(fullMatch, result[resolver.pageAttribute])
    } else {
      // Result is a direct value
      replacements.set(fullMatch, result)
    }
  }

  // Apply all replacements in a single pass
  // Sort by length to replace longer matches first (avoids substring replacement issues)
  // Example: @id:homepage should be replaced before @id:home
  let processedStr = jsonStr
  const sortedReplacements = [...replacements.entries()].sort(
    (a, b) => b[0].length - a[0].length,
  )

  for (const [from, to] of sortedReplacements) {
    // Escape the replacement value for JSON (handles quotes, newlines, etc.)
    const jsonSafeTo = JSON.stringify(to).slice(1, -1) // Remove surrounding quotes
    processedStr = processedStr.replaceAll(from, jsonSafeTo)
  }

  // Parse back to object, restoring special values (functions, dates, undefined)
  return jsonSafeParse(processedStr, specialValues)
}

module.exports = atAttributesContentTransform

/** Resolvers for different @attribute types */

/**
 * Resolves @data attributes by looking up values in the context object.
 * Example: @data:site.url -> context.site.url
 */

const dataAttributeResolver = (
  attributeParams,
  page,
  config,
  context,
  lookups, // eslint-disable-line no-unused-vars
) => {
  // Use lodash.get for safe nested property access
  const value = _.get(context, attributeParams)
  if (value !== undefined) {
    return [value, null]
  } else {
    return [null, `@data '${attributeParams}' attribute not found in context`]
  }
}

/**
 * Resolves @file attributes by finding pages with matching input paths.
 */
const fileAttributeResolver = (filepath, page, config, context, lookups) => {
  if (!path.isAbsolute(filepath)) {
    return [null, `@file '${filepath}' must be absolute at this point`]
  }
  const fullPath = path.join(config.dirs.content, filepath)

  // Use inline helper - optimized by V8 to avoid function call overhead
  const pageFound = lookups.findByInputPath(fullPath)

  if (!pageFound) {
    return [null, `@file not found '${filepath}'`]
  }
  return [pageFound, null]
}

/**
 * Resolves @id attributes by finding pages with matching IDs and languages.
 * Supports fallback to default language and fallback IDs.
 *
 * Examples:
 * - @id:about -> Find 'about' page in current or default language
 * - @id:about:home -> Find 'about', fallback to 'home' if not found
 * - @id:about:home:fr -> Find 'about' in French, fallback to 'home' in French
 *
 */
const idAttributeResolver = (
  attributeParams,
  page,
  config,
  context,
  lookups,
) => {
  const defaultLang =
    _.get(context, "site.lang") || _.get(context, "site.locale[0]")
  const [id, fallback, langParam] = attributeParams.split(":")
  const isIdOnly = id && !fallback && !langParam
  let pageFound

  const lang = langParam || page.lang

  if (id) {
    pageFound = lookups.findByIdAndLang(id, lang)
    if (pageFound) {
      return [pageFound, null]
    }
  }

  // If only ID provided and not in current lang, try default language
  if (isIdOnly && lang !== defaultLang) {
    pageFound = lookups.findByIdAndLang(id, defaultLang)
    if (pageFound) {
      return [pageFound, null]
    }
    return [
      null,
      `@id '${id}' not found in lang '${lang}' nor default lang '${defaultLang}'`,
    ]
  }

  // Try fallback ID if provided
  if (fallback) {
    pageFound = lookups.findByIdAndLang(fallback, lang)
    if (pageFound) {
      return [pageFound, null]
    } else {
      return [null, `fallback @id '${fallback}' not found in lang '${lang}'`]
    }
  }
  return [null, `@id '${id}' not found in lang '${lang}'`]
}

/**
 * Resolves @permalink attributes by finding pages with exact permalink matches.
 */
const permalinkAttributeResolver = (
  permalink,
  page,
  config,
  context,
  lookups,
) => {
  const pageFound = lookups.findByPermalink(permalink)

  if (pageFound) {
    return [pageFound, null]
  } else {
    return [null, `@permalink not found '${permalink}'`]
  }
}

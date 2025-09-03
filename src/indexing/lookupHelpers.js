/**
 * Helper functions for efficient index-based lookups with O(n) fallback.
 *
 * IMPORTANT PERFORMANCE NOTE:
 * These helpers add ~0.001ms overhead per call due to function invocation.
 * For hot paths with 1M+ calls (like @attribute resolution), use direct Map.get() instead.
 * Benchmark data: 41 seconds with direct access vs 57 seconds with these helpers (40% slower).
 *
 * WHEN TO USE THESE HELPERS:
 * - One-off lookups during page processing
 * - Non-performance-critical paths
 * - When code clarity is more important than microsecond optimization
 *
 * WHEN NOT TO USE:
 * - Inside tight loops processing thousands of items
 * - @attribute resolution (uses inline helpers instead)
 * - Any path that executes more than 10,000 times per build
 */

/**
 * Generic lookup with index (O(1)) and fallback (O(n)) support.
 *
 * @param {Object} indexes - The indexes object containing Maps for lookups
 * @param {string} indexName - Name of the index to use (e.g., 'byPermalink')
 * @param {*} key - The key to look up in the index
 * @param {Function} fallbackFn - Optional fallback function for O(n) search
 * @returns {*} The found item or null
 */
const findInIndex = (indexes, indexName, key, fallbackFn) => {
  // Try index first (O(1))
  if (indexes && indexes[indexName]) {
    const result = indexes[indexName].get(key)
    if (result) {
      return result
    }
  }

  // Fall back to O(n) search if provided
  // This is expected during dynamic data cascade before indexes are built
  if (fallbackFn) {
    return fallbackFn()
  }

  return null
}

/**
 * Find page by permalink using index or fallback.
 */
const findPageByPermalink = (indexes, permalink, pages) => {
  return findInIndex(indexes, "byPermalink", permalink, () =>
    Object.values(pages).find((p) => p.permalink === permalink),
  )
}

/**
 * Find page by input path using index or fallback.
 */
const findPageByInputPath = (indexes, inputPath, pages) => {
  return findInIndex(indexes, "byInputPath", inputPath, () =>
    Object.values(pages).find((p) => p._meta?.inputPath === inputPath),
  )
}

/**
 * Find page by ID and language using index or fallback.
 */
const findPageByIdAndLang = (indexes, id, lang, pages) => {
  const key = `${id}:${lang}`
  return findInIndex(indexes, "byIdAndLang", key, () =>
    Object.values(pages).find((p) => p.id === id && p.lang === lang),
  )
}

/**
 * Find page by derivative permalink using index or fallback.
 */
const findPageByDerivative = (indexes, derivativePermalink, pages) => {
  return findInIndex(indexes, "byDerivative", derivativePermalink, () =>
    Object.values(pages).find((p) =>
      p.derivatives?.find((d) => d.permalink === derivativePermalink),
    ),
  )
}

/**
 * Find parent page by directory permalink using index or fallback.
 */
const findParentByPermalink = (indexes, parentPermalink, pages) => {
  return findInIndex(indexes, "byParentPermalink", parentPermalink, () =>
    Object.values(pages).find((p) => p.permalink === parentPermalink),
  )
}

/**
 * Find page by input source path using index or fallback.
 */
const findPageByInputSource = (indexes, inputSourcePath, pages) => {
  return findInIndex(indexes, "byInputSource", inputSourcePath, () =>
    Object.values(pages).find((p) =>
      p._meta?.inputSources?.some((s) => s.path === inputSourcePath),
    ),
  )
}

module.exports = {
  findInIndex,
  findPageByPermalink,
  findPageByInputPath,
  findPageByIdAndLang,
  findPageByDerivative,
  findParentByPermalink,
  findPageByInputSource,
}

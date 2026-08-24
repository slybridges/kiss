/**
 * Builds centralized indexes for O(1) page lookups throughout the build process.
 *
 * FALLBACK SUPPORT:
 * When indexes are disabled (config.defaults.enablePageIndexes = false),
 * all lookups fall back to O(n) searches. This is supported but not recommended
 * for sites with 1000+ pages.
 *
 * @param {Object} pages - All pages with resolved data (post-cascade)
 * @returns {Object} Six specialized indexes for different lookup patterns:
 *   - byPermalink: page.permalink → page
 *   - byInputPath: page._meta.inputPath → page
 *   - byIdAndLang: "id:lang" → page
 *   - byDerivative: derivative.permalink → page
 *   - byParentPermalink: directory permalinks → page
 *   - byInputSource: source.path → page
 */
const buildPageIndexes = (pages) => {
  const indexes = {
    byPermalink: new Map(),
    byInputPath: new Map(),
    byIdAndLang: new Map(),
    byDerivative: new Map(),
    byParentPermalink: new Map(),
    byInputSource: new Map(),
  }

  // Pages sharing the same (id, lang), reported as one error per tuple below
  const duplicateIdPages = new Map()

  // Build all indexes in a single pass through pages
  for (const page of Object.values(pages)) {
    // Permalink index
    if (page.permalink) {
      indexes.byPermalink.set(page.permalink, page)

      // Parent permalink index for directory lookups
      // Used by getInputPath to find parent directories
      if (page.permalink.endsWith("/")) {
        indexes.byParentPermalink.set(page.permalink, page)
      }
    }

    // InputPath index - available after content loading
    if (page._meta?.inputPath) {
      indexes.byInputPath.set(page._meta.inputPath, page)
    }

    // ID and language index for @id resolution
    if (page.id && page.lang) {
      const key = `${page.id}:${page.lang}`
      const existing = indexes.byIdAndLang.get(key)
      if (existing && existing !== page) {
        if (!duplicateIdPages.has(key)) {
          duplicateIdPages.set(key, [existing])
        }
        duplicateIdPages.get(key).push(page)
      }
      indexes.byIdAndLang.set(key, page)
    }

    // Derivatives index for image permalinks
    if (page.derivatives) {
      for (const derivative of page.derivatives) {
        if (derivative.permalink) {
          indexes.byDerivative.set(derivative.permalink, page)
        }
      }
    }

    // Input sources index for getPageFromInputPath
    if (page._meta?.inputSources) {
      for (const source of page._meta.inputSources) {
        if (source.path) {
          indexes.byInputSource.set(source.path, page)
        }
      }
    }
  }

  // Duplicate (id, lang) makes @id links and hreflang resolution ambiguous
  for (const conflictingPages of duplicateIdPages.values()) {
    const { id, lang } = conflictingPages[0]
    global.logger.error(
      `Duplicate page id '${id}' for lang '${lang}' found in:\n` +
        conflictingPages
          .map((page) => `  - ${page._meta?.inputPath}`)
          .join("\n"),
    )
  }

  return indexes
}

module.exports = buildPageIndexes

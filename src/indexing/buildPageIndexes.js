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
      indexes.byIdAndLang.set(`${page.id}:${page.lang}`, page)
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

  return indexes
}

module.exports = buildPageIndexes

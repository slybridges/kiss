/**
 * Centralized indexing module for O(1) page lookups.
 *
 * ARCHITECTURE DECISION:
 * On large sites, walking through and finding pages during the transform phase
 * can be a major performance bottleneck. To address this, we build centralized
 * indexes for common lookup patterns (by permalink, inputPath, id+lang, etc.)
 *
 * BENCHMARKS (5000 page site, 200 @attributes each):
 * - No indexes: 5+ minutes
 * - With indexes + helpers: 57 seconds
 * - With indexes + direct access: 41 seconds (28% faster)
 */

const buildPageIndexes = require("./buildPageIndexes")
const {
  findInIndex,
  findPageByPermalink,
  findPageByInputPath,
  findPageByIdAndLang,
  findPageByDerivative,
  findParentByPermalink,
  findPageByInputSource,
} = require("./lookupHelpers")

module.exports = {
  buildPageIndexes,
  findInIndex,
  findPageByPermalink,
  findPageByInputPath,
  findPageByIdAndLang,
  findPageByDerivative,
  findParentByPermalink,
  findPageByInputSource,
}

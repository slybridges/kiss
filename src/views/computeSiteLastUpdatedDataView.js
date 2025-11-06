const _ = require("lodash")
const { sortPages } = require("../helpers")

const computeSiteLastUpdatedDataView = ({ pages }, options, config) => {
  let lastUpdated = sortPages(
    pages,
    "-" + config.defaults.pageUpdatedAttribute,
    { skipUndefinedSort: true },
  )
  if (lastUpdated.length === 0) {
    return null
  }
  // Find the first page with a non-null, non-undefined value
  for (const page of lastUpdated) {
    const value = _.get(page, config.defaults.pageUpdatedAttribute)
    if (value != null) { // Checks for both null and undefined
      return value
    }
  }
  return null
}

module.exports = computeSiteLastUpdatedDataView

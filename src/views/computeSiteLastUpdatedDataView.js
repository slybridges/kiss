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
  return _.get(lastUpdated[0], config.defaults.pageUpdatedAttribute)
}

module.exports = computeSiteLastUpdatedDataView

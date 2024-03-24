const _ = require("lodash")
const { getDescendantPages } = require("../helpers")

const computeCategoriesDataView = (context, options = {}, config) => {
  if (!options.parent) {
    options.parent = "."
  }
  let categories = []
  _.filter(
    context.pages,
    ({ _meta }) => _meta.isDirectory && _meta.parent === options.parent,
  ).forEach((page) => {
    categories.push({
      name: config.libs.unslugify(page._meta.basename),
      entry: page,
      count: getDescendantPages(page, context.pages, {
        filterBy: (d) => d._meta.isPost,
      }).length,
      children: computeCategoriesDataView(
        context,
        { ...options, parent: page._meta.id },
        config,
        page._meta.id,
      ),
    })
  })
  return categories
}

module.exports = computeCategoriesDataView

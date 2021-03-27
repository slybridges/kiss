const { findCollectionById } = require("../helpers.js")

const nunjucksContentTransform = (page, options, config, context) => {
  let templateContext = {}
  if (page._meta.isCollection) {
    templateContext = {
      ...context,
      collection: findCollectionById(context.collections, page._meta.id),
      ...page,
    }
  } else {
    templateContext = {
      ...context,
      ...page,
    }
  }
  page._html = config.libs.nunjucks.render(page.layout, templateContext)
  return page
}

module.exports = nunjucksContentTransform

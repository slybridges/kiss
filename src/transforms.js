const { findCollectionById } = require("./utils.js")

const nunjucksTransform = (page, options, config, context) => {
  if (page._meta.outputType !== "HTML") {
    // only transform HTML pages
    return page
  }
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
  page.content = config.libs.nunjucks.render(page.layout, templateContext)
  return page
}

const applyTransforms = (context, config) => {
  if (!config.transforms || config.transforms.length === 0) {
    global.logger.info(`No transform registered.`)
    return context
  }
  config.transforms.forEach((transform) => {
    const { scope, handler, outputType, ...options } = transform
    if (scope === "CONTEXT") {
      // global transforms
      global.logger.info(`Transforming context using '${handler.name}'`)
      try {
        context = handler(context, options, config)
      } catch (e) {
        global.logger.error(`Error during transform: ${e}`)
      }
    } else {
      // page transforms
      global.logger.info(
        `Transforming ${outputType || "all"} pages using '${handler.name}'`
      )
      for (let [id, page] of Object.entries(context.pages)) {
        if (outputType && page._meta.outputType !== outputType) {
          continue
        }
        try {
          context.pages[id] = handler(page, options, config, context)
          global.logger.log(`- transformed ${id}`)
        } catch (e) {
          global.logger.error(
            `- error during transform of page ${id}: ${e}. Skipping.`
          )
        }
      }
    }
  })
  return context
}

module.exports = {
  applyTransforms,
  nunjucksTransform,
}

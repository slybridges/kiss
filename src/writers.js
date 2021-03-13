const path = require("path")
const _ = require("lodash")
const {
  findCollectionById,
  writeFileAtPath,
  copyFileAtPath,
} = require("./utils.js")

const collectionWriter = async (page, config, context) => {
  const collection = findCollectionById(context.collections, page._meta.id)
  const content = config.libs.nunjucks.render(page.layout, {
    ...context,
    collection,
    ...page,
  })
  return await writeFileAtPath(page._meta.outputPath, content)
}

const staticWriter = async ({ _meta }) => {
  return await copyFileAtPath(_meta.inputPath, _meta.outputPath)
}

const postWriter = async (page, config, context) => {
  const content = config.libs.nunjucks.render(page.layout, {
    ...context,
    ...page,
  })
  return await writeFileAtPath(page._meta.outputPath, content)
}

const jsonSiteWriter = async (context, options = {}, config) => {
  if (!options.target) {
    options.target = "site_data.json"
  }
  const jsonData = JSON.stringify(context, null, options.space)
  return await writeFileAtPath(
    path.join(config.publicDir, options.target),
    jsonData
  )
}

const findWriter = ({ _meta }, config) =>
  config.writers.find((writer) => writer.type === _meta.type)

const writeStaticPages = async (context, config) => {
  // write pages
  await Promise.all(
    _.map(context.pages, async (page) => {
      const writer = findWriter(page, config)
      if (writer) {
        let { file, err } = await writer.handler(page, config, context)
        if (err) {
          global.logger.error(`- error writing '${file}': ${err}`)
        } else {
          global.logger.log(`- wrote '${file}'`)
        }
      } else if (!page._meta.isDirectory) {
        global.logger.warn(
          `- no writer found for '${page._meta.inputPath}'. Skipping.`
        )
      }
    })
  )
  // write global pages
  return await Promise.all(
    _.filter(config.writers, { type: "site" }).map(async (writer) => {
      const { type, handler, ...options } = writer //eslint-disable-line no-unused-vars
      let { file, err } = await handler(context, options, config)
      if (err) {
        global.logger.error(`- error writing '${file}': ${err}`)
      } else {
        global.logger.log(`- wrote '${file}'`)
      }
    })
  )
}

module.exports = {
  collectionWriter,
  jsonSiteWriter,
  staticWriter,
  postWriter,
  writeStaticPages,
}

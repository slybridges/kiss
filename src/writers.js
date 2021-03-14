const path = require("path")
const _ = require("lodash")
const { writeFileAtPath, copyFileAtPath } = require("./utils.js")

const htmlPageWriter = async ({ content, _meta }) => {
  return await writeFileAtPath(_meta.outputPath, content)
}

const staticPageWriter = async ({ _meta }) => {
  return await copyFileAtPath(_meta.inputPath, _meta.outputPath)
}

const jsonContextWriter = async (context, options = {}, config) => {
  if (!options.target) {
    options.target = "site_data.json"
  }
  const jsonData = JSON.stringify(context, null, options.space)
  return await writeFileAtPath(
    path.join(config.publicDir, options.target),
    jsonData
  )
}

const findWriter = ({ _meta }, config) => {
  const writer = config.writers.find(
    (writer) => writer.outputType === _meta.outputType
  )
  if (!writer) {
    global.logger.warn(
      `- no writer for type '${_meta.outputType}' found for '${_meta.inputPath}'. Skipping.`
    )
  }
  return writer
}

const writeStaticSite = async (context, config) => {
  // write individual pages
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
      }
    })
  )
  // write context-based pages
  return await Promise.all(
    _.filter(config.writers, { scope: "CONTEXT" }).map(async (writer) => {
      const { handler, ...options } = writer //eslint-disable-line no-unused-vars
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
  htmlPageWriter,
  jsonContextWriter,
  staticPageWriter,
  writeStaticSite,
}

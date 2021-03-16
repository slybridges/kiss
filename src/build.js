const _ = require("lodash")
const { copySync } = require("fs-extra")
const { execSync } = require("child_process")
const fg = require("fast-glob")
const path = require("path")

const { loadConfig } = require("./config")
const { getParentId } = require("./helpers")
const { baseLoader } = require("./loaders")
const { setGlobalLogger } = require("./logger")

const build = async (options = {}, config = null) => {
  console.time("Build time")

  const { configFile, verbosity, watchMode } = options

  setGlobalLogger(verbosity)

  let context = {
    pages: {},
  }

  global.logger.section("Loading config and initial context")
  if (!config) {
    config = loadConfig({ configFile })
  }
  context = { ...context, ...config.context }

  if (config.hooks.loadLibs.length > 0) {
    global.logger.section("Running loadLibs hooks")
    config = runConfigHooks(config, "loadLibs")
  }

  if (config.hooks.preLoad.length > 0) {
    global.logger.section("Running preLoad hooks")
    context = runConfigHooks(config, "preLoad", context)
  }

  global.logger.section(`Loading content from '${config.dirs.content}'`)
  context.pages = await loadContent(config, context)

  if (config.hooks.postLoad.length > 0) {
    global.logger.section("Running postLoad hooks")
    context = runConfigHooks(config, "postLoad", context)
  }

  global.logger.section("Computing dynamic page context")
  context = computeAllPagesData(context, config)

  global.logger.section("Computing data views")
  context = computeDataViews(context, config)

  global.logger.section(`Applying transforms`)
  context = applyTransforms(context, config)

  global.logger.section(`Writing site to '${config.dirs.public}'`)
  await writeStaticSite(context, config)

  if (config.hooks.postWrite.length > 0) {
    global.logger.section("Running postWrite hooks")
    runConfigHooks(config, "postWrite", context)
  }

  global.logger.section("Build complete")
  const errorCount = global.logger.counts.error
  const warningCount = global.logger.counts.warn
  if (errorCount > 0) {
    global.logger.error(
      `${errorCount} error(s) and ${warningCount} warning(s) found.`
    )
    console.timeEnd("Build time")
    if (!watchMode) {
      process.exit(1)
    }
  } else if (warningCount > 0) {
    global.logger.warn(`${warningCount} warning(s) found.`)
  } else {
    global.logger.success(`Static build completed!`)
  }
  console.timeEnd("Build time")
}

module.exports = build

/** Private **/

const applyTransforms = (context, config) => {
  if (!config.transforms || config.transforms.length === 0) {
    global.logger.info(`No transform registered.`)
    return context
  }
  config.transforms.forEach((transform) => {
    const { scope, handler, outputType, ...options } = transform
    if (scope === "CONTEXT") {
      // global transforms
      global.logger.info(`Transforming context using ${handler.name}`)
      try {
        context = handler(context, options, config)
      } catch (e) {
        global.logger.error(`Error during transform: ${e}`)
      }
    } else {
      // page transforms
      global.logger.info(
        `Transforming ${outputType || "all"} pages using ${handler.name}`
      )
      for (let [id, page] of Object.entries(context.pages)) {
        if (outputType && page._meta.outputType !== outputType) {
          continue
        }
        try {
          context.pages[id] = handler(page, options, config, context)
          global.logger.log(`- transformed '${id}'`)
        } catch (e) {
          global.logger.error(`Error during transform of page '${id}': ${e}`)
        }
      }
    }
  })
  return context
}

// load content derived from existing pages
const computeDataViews = (context, config) => {
  config.dataViews.forEach((view) => {
    const { attribute, handler, ...options } = view
    global.logger.info(
      `Computing '${attribute}' data view using ${handler.name}`
    )
    _.set(context, attribute, handler(context, options, config))
  })
  return context
}

const computePageData = (data, config, context, options = {}) => {
  let computed = {
    data: null,
    pendingCount: 0,
  }
  if (_.isArray(data)) {
    computed.data = [...data]
  } else {
    computed.data = { ...data }
  }
  if (!options.topLevelData) {
    // for recursive call
    options.topLevelData = data
  }
  for (let key in data) {
    let value = data[key]
    //_.forEach(data, (value, key) => {
    if (typeof key === "string" && key.endsWith("_no_cascade")) {
      // this is an override key, computing original key value
      key = key.split("_no_cascade")[0]
    } else if (
      Object.prototype.hasOwnProperty.call(data, key + "_no_cascade")
    ) {
      // there is a data override attribute, bail out.
      continue
    }
    if (typeof value === "function") {
      // it's a function we need to compute the result
      let currentPending = 0
      if (value.kissDependencies) {
        currentPending = countPendingDependencies(
          options.topLevelData,
          context.pages,
          value.kissDependencies
        )
      }
      if (currentPending == 0) {
        computed.data[key] = value(options.topLevelData, config, context)
      } else {
        // data needs other dependencies to be computed first
        computed.pendingCount += currentPending
        computed.data[key] = value
      }
    } else if (_.isPlainObject(value) || _.isArray(value)) {
      // it's an object: we need to see if there is data to compute inside
      let subComputed = computePageData(value, config, context, options)
      computed.data[key] = subComputed.data
      computed.pendingCount += subComputed.pendingCount
    } else {
      computed.data[key] = value
    }
  }
  return computed
}

const computeAllPagesData = (context, config) => {
  let pendingTotal = 0
  let round = 1
  let computed = {}

  while (round === 1 || pendingTotal > 0) {
    pendingTotal = 0
    _.forEach(context.pages, (page, key) => {
      computed = computePageData(page, config, context)
      context.pages[key] = computed.data
      pendingTotal += computed.pendingCount
    })
    if (pendingTotal > 0 && round + 1 > config.defaults.maxComputingRounds) {
      global.logger.error(
        ```Could not compute all data in ${config.defaults.maxComputingRounds} rounds. Check for circular
dependencies or increase the 'maxComputingRounds' value.```
      )
      break
    }
    if (pendingTotal > 0) {
      global.logger.log(
        `- Round ${round}: ${pendingTotal} data points could not yet be computed. New round.`
      )
    } else {
      global.logger.log(`- Round ${round}: all data points computed.`)
    }
    ++round
  }
  return context
}

const countPendingDependencies = (page, pages, deps = []) => {
  let pendingCount = 0
  deps.forEach((dep) => {
    if (typeof dep === "string") {
      // assume attribute is part of the page data
      let depValue = _.get(page, dep)
      if (isComputableValue(depValue)) {
        // dependency is not yet computed
        pendingCount++
      }
    } else if (_.isArray(dep)) {
      // list of chained dependencies, we have to look into other pages
      let [data, ...restDeps] = dep
      let depValue = _.get(page, data)
      if (_.isArray(depValue)) {
        // assume list of page ids
        depValue.forEach(
          (id) =>
            (pendingCount += countPendingDependencies(
              pages[id],
              pages,
              restDeps
            ))
        )
      } else if (isComputableValue(depValue)) {
        pendingCount++
      } else {
        // assume a single page id
        pendingCount += countPendingDependencies(depValue, pages, restDeps)
      }
    } else {
      throw new Error(
        `countPendingDependencies: dependency should either be a string or an array of strings: ${dep}`
      )
    }
  })
  return pendingCount
}

const directoryCollectionLoader = (pathname, options, pages, config) => {
  const parentName = path.dirname(pathname)
  const parentNameId = getParentId(pathname, config)
  if (!parentNameId || pages[parentNameId]) {
    // parent already in the collection
    return pages
  }
  let isTopLevel = true
  const parentBasename = path.basename(parentName)
  if (parentBasename !== parentName) {
    // there is a parent of the parent folder
    // according to our top down data cascade approach,
    // we need to compute this one first
    isTopLevel = false
    pages = directoryCollectionLoader(parentName, options, pages, config)
  }
  let parent = baseLoader(
    parentName,
    { isDirectory: true, collectionGroup: "directory" },
    isTopLevel ? config.defaults.pageData : {},
    pages,
    config
  )

  return _.merge({}, pages, {
    [parentNameId]: parent,
  })
}

const isComputableValue = (value) =>
  typeof value === "function" ||
  (_.isPlainObject(value) && value._kissCheckDependencies)

const loadContent = async (config, context) => {
  let pages = {}
  // file loaders
  await Promise.all(
    config.loaders
      .filter((loader) => !loader.source || loader.source === "file")
      .map(async ({ match, matchOptions = {}, handler, ...options }) => {
        let fgOptions = {
          cwd: config.dirs.content,
          markDirectories: true,
          stats: true,
          ...matchOptions,
        }
        let files = fg.stream(match, fgOptions)
        global.logger.info(
          `Loading files matching ${match} using ${handler.name}`
        )
        for await (const file of files) {
          let pathname = path.join(config.dirs.content, file.path)
          let page = {}
          try {
            // load parent folders, if any
            pages = directoryCollectionLoader(pathname, options, pages, config)
            // load stats
            page = {
              _meta: {
                fileCreated: file.stats.ctime,
                fileModified: file.stats.mtime,
              },
            }
            // load base data including _meta infos and based on ParentData
            page = baseLoader(pathname, options, page, pages, config)
            // load content specific data
            page = handler(pathname, options, page, context)
            pages[page._meta.id] = page
            global.logger.log(
              `- [${handler.name}] loaded '${page._meta.inputPath}'`
            )
          } catch (err) {
            global.logger.error(
              `- [${handler.name}] error loading '${_.get(
                page,
                "_meta.inputPath"
              )}'\n`,
              err
            )
          }
        }
      })
  )
  // computed loaders
  _.filter(config.loaders, (loader) => loader.source === "computed").forEach(
    (loader) => {
      const { handler, ...options } = loader
      global.logger.info(`Loading computed pages using ${handler.name}`)
      pages = handler(pages, options, config)
    }
  )
  return pages
}

const runConfigHooks = (config, event, data) => {
  const hooks = _.get(config.hooks, event)
  if (!hooks || hooks.length === 0) {
    global.logger.log(`No hooks registered for ${event}`)
    return
  }
  hooks.forEach((hook) => {
    if (typeof hook === "function") {
      data = runHandlerHook(hook, {}, config, data)
    } else {
      const { action, handler, command, ...options } = hook
      switch (action) {
        case "copy":
          runCopyHook(options, config)
          break
        case "exec":
          runExecHook(command, options)
          break
        case "run":
          data = runHandlerHook(handler, options, config, data)
          break
        default: {
          global.logger.error(`Unknown hook action: ${action}`)
          break
        }
      }
    }
  })
  return data
}

const runCopyHook = ({ from, to }, config) => {
  const publicTo = path.join(config.dirs.public, to)
  try {
    global.logger.info(`Copying file from '${from}' to '${publicTo}'`)
    copySync(from, publicTo)
  } catch (err) {
    global.logger.error(`Error copying from '${from}' to '${publicTo}': ${err}`)
  }
}

const runExecHook = (command, options) => {
  global.logger.info(`Executing ${command}`)
  try {
    const res = execSync(command, options).toString()
    global.logger.log(res)
  } catch (err) {
    global.logger.error(err)
  }
}

const runHandlerHook = (handler, options, config, data) => {
  global.logger.info(`Running ${handler.name}`)
  try {
    return handler(options, config, data)
  } catch (err) {
    global.logger.error(`Error in ${handler.name}: ${err}`)
    return data
  }
}

const writeStaticSite = async (context, config) => {
  global.logger.info("Writing individual pages")
  await Promise.all(
    _.map(context.pages, async (page) => {
      if (!page.permalink) {
        global.logger.log(
          `- Page '${page._meta.id}' has no permalink. Skipping.`
        )
      }
      const writer = config.writers.find(
        (writer) => writer.outputType === page._meta.outputType
      )
      if (writer) {
        try {
          await writer.handler(page, config, context)
          global.logger.log(
            `- [${writer.handler.name}] wrote '${page._meta.outputPath}'`
          )
        } catch (err) {
          global.logger.error(
            `- [${writer.handler.name}] error writing '${page._meta.outputPath}': ${err}`
          )
        }
      } else {
        global.logger.warn(
          `- no writer for type '${page._meta.outputType}' found for '${page._meta.inputPath}'. Skipping.`
        )
      }
    })
  )
  const contextWriters = _.filter(config.writers, { scope: "CONTEXT" })
  if (contextWriters.length === 0) {
    return
  }
  global.logger.info("Writing context-based pages")
  return await Promise.all(
    contextWriters.map(async (writer) => {
      const { scope, handler, ...options } = writer //eslint-disable-line no-unused-vars
      try {
        await handler(context, options, config)
        global.logger.log(
          `- [${handler.name}] wrote ${options.target || "file"}`
        )
      } catch (err) {
        global.logger.error(
          `- [${handler.name}] error writing ${
            options.target || "file"
          }: ${err}`
        )
      }
    })
  )
}

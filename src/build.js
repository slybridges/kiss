const _ = require("lodash")
const { copySync } = require("fs-extra")
const { execSync } = require("child_process")
const fg = require("fast-glob")
const path = require("path")

const { loadConfig } = require("./config")
const {
  computeParentId,
  getBuildEntries,
  getPageFromInputPath,
  relativeToAbsoluteAttributes,
} = require("./helpers")
const { baseLoader } = require("./loaders")
const { setGlobalLogger } = require("./logger")

const hasOwnProperty = Object.prototype.hasOwnProperty

const build = async (options = {}, lastBuild = {}, version = 0) => {
  console.time("Build time")

  const { configFile, unsafeBuild, verbosity, watchMode } = options

  setGlobalLogger(verbosity)

  let { config } = lastBuild

  if (!config) {
    global.logger.section("Loading config and initial context")
    config = loadConfig({ configFile })
  }

  const buildFlags = computeBuildFlags(
    options,
    config,
    lastBuild.context,
    version,
  )

  let context = lastBuild.context || { pages: {}, ...config.context }

  if (buildFlags.incremental && !context._buildFuncs) {
    context._buildFuncs = {}
  }

  if (options.incremental) {
    // compute the file ids that will need to be updated
    buildFlags.buildPageIds = computeBuildPageIDs(context, buildFlags)
  }

  if (buildFlags.loadLibs) {
    global.logger.section("Running loadLibs hooks")
    config = runConfigHooks(config, "loadLibs", null, buildFlags)
  }

  if (buildFlags.preLoad) {
    global.logger.section("Running preLoad hooks")
    context = runConfigHooks(config, "preLoad", context)
  }

  if (buildFlags.content) {
    if (!options.incremental) {
      global.logger.section(
        `Loading content from '${config.dirs.content}' directory`,
      )
    }
    context.pages = await loadContent(config, context, buildFlags)
  }

  if (buildFlags.postLoad) {
    global.logger.section("Running postLoad hooks")
    context = runConfigHooks(config, "postLoad", context)
  }

  if (buildFlags.dynamicData) {
    global.logger.section("Computing dynamic page context")
    context = computeAllPagesData(context, config, buildFlags)
  }

  if (buildFlags.dataViews) {
    global.logger.section("Computing data views")
    context = computeDataViews(context, config)
  }

  if (buildFlags.transform) {
    global.logger.section(`Applying transforms`)
    context = await applyTransforms(context, config, buildFlags)
  }

  if (buildFlags.write) {
    global.logger.section(`Writing site to '${config.dirs.public}' directory`)
    await writeStaticSite(context, config, buildFlags)
  }

  if (buildFlags.postWrite) {
    global.logger.section("Running postWrite hooks")
    runConfigHooks(config, "postWrite", context)
  }

  global.logger.section("Build complete")
  const errorCount = global.logger.counts.error
  const warningCount = global.logger.counts.warn
  if (errorCount > 0) {
    global.logger.error(
      `${errorCount} error(s) and ${warningCount} warning(s) found.`,
    )
    if (!watchMode) {
      if (unsafeBuild) {
        global.logger.info(
          "Unsafe build mode: exiting build with errors without raising exit(1)",
        )
      } else {
        global.logger.info("Exiting build with errors.")
        console.timeEnd("Build time")
        process.exit(1)
      }
    }
  } else if (warningCount > 0) {
    global.logger.warn(`${warningCount} warning(s) found.`)
  } else {
    global.logger.success(`Build completed!`)
  }
  console.timeEnd("Build time")

  return { context, config }
}

module.exports = build

/** Private **/

const applyTransforms = async (context, config, buildFlags) => {
  const { buildPageIds } = buildFlags
  if (!config.transforms || config.transforms.length === 0) {
    global.logger.info(`No transform registered.`)
    return context
  }
  const validScopes = [null, "PAGE", "CONTEXT"]
  for await (let transform of config.transforms) {
    const { scope, handler, outputType, namespace, ...rest } = transform
    const options = getOptions(config, namespace, rest)
    if ("active" in options && !options.active) {
      global.logger.log(`- [${handler.name}]: transform not active. Skipping.`)
      continue
    }
    if (scope && !validScopes.includes(scope)) {
      throw new Error(
        `[applyTransforms]: invalid scope for transform ${
          handler.name
        }, got '${scope}'. Valid choices are ${JSON.stringify(validScopes)}`,
      )
    }
    if (scope === "CONTEXT") {
      // global transforms
      const message =
        options.description || `Transforming context using ${handler.name}`
      global.logger.info(message)
      try {
        context = await handler(context, options, config, buildFlags)
      } catch (err) {
        global.logger.error(
          `[${handler.name}] Error during transform:\n`,
          err.stack,
        )
      }
    } else {
      const entries = getBuildEntries(context, buildFlags).filter(
        ([, page]) => !outputType || outputType === page._meta.outputType,
      )
      if (entries.length === 0) {
        continue
      }
      let message =
        options.description ||
        `Transforming ${outputType || "all"} pages using '${handler.name}'`
      if (buildPageIds.length > 0) {
        message += ` (incremental)`
      }
      global.logger.info(message)
      // page transforms
      for (let [id, page] of entries) {
        if (outputType && page._meta.outputType !== outputType) {
          continue
        }
        try {
          context.pages[id] = await handler(page, options, config, context)
          global.logger.log(`- [${handler.name}] transformed '${id}'`)
        } catch (err) {
          global.logger.error(
            `[${handler.name}] Error during transform of page '${id}'\n`,
            err.stack,
          )
        }
      }
    }
  }
  return context
}

const computeBuildFlags = (options, config, lastContext, version) => {
  let flags = {
    incremental: options.incremental,
    config: true,
    loadLibs: config.hooks.loadLibs.length > 0,
    preLoad: config.hooks.preLoad.length > 0,
    content: true,
    postLoad: config.hooks.postLoad.length > 0,
    dynamicData: true,
    dataViews: true,
    transform: true,
    write: true,
    postWrite: config.hooks.postWrite.length > 0,
    version: version,
  }
  if (!options.incremental || !lastContext || !options.file) {
    // full build
    return flags
  }
  // only change event is supported for now, 'add' and 'unlink' will trigger a full rebuild
  if (options.event !== "change") {
    return flags
  }
  // incremental build: for now we only react on content file changes
  if (options.file.startsWith(config.dirs.content)) {
    flags.contentFile = options.file
    flags.config = false
    flags.loadLibs = false
    flags.preLoad = false
    flags.postLoad = false
    flags.dynamicData = true
    flags.dataViews = false
    flags.postWrite = false
  } else if (options.file.startsWith(config.dirs.template)) {
    // templates are always related to the template directory
    flags.templateFile = path.relative(config.dirs.template, options.file)
    flags.config = false
    flags.loadLibs = false
    flags.preLoad = false
    flags.content = false
    flags.postLoad = false
    flags.dynamicData = false
    flags.dataViews = false
    flags.postWrite = false
  }
  return flags
}

const computeBuildPageIDs = (context, buildFlags) => {
  let buildPageIds = []
  if (buildFlags.contentFile) {
    const page = getPageFromInputPath(buildFlags.contentFile, context.pages)
    if (!page) {
      global.logger.warn(
        `Could not find existing page for '${buildFlags.contentFile}'.`,
      )
      return []
    }
    const contentPathObject = path.parse(buildFlags.contentFile)
    if (contentPathObject.name === "index") {
      // it's an index file, we must return its id and all descendants
      buildPageIds = [page._meta.id, ...page._meta.descendants]
    } else {
      // not an index file, we only need to return the current id
      buildPageIds = [page._meta.id]
    }
  } else if (buildFlags.templateFile) {
    // mark all pages using that template for rebuild
    // Note: if the template is a sub-template of another template
    // (e.g. that is included() in a main template),
    // this will not work and we'll rebuild everything
    buildFlags.buildPageIds = Object.values(context.pages)
      .filter((page) => page.layout === buildFlags.templateFile)
      .map((page) => page._meta.id)
  }
  return buildPageIds
}

// load content derived from existing pages
const computeDataViews = (context, config) => {
  config.dataViews.forEach((view) => {
    const { attribute, description, handler, ...options } = view
    const message =
      description || `Computing '${attribute}' data view using ${handler.name}`
    global.logger.info(message)
    try {
      _.set(context, attribute, handler(context, options, config))
    } catch (err) {
      global.logger.error(
        `[${handler.name}] Error during computing data view for '${attribute}'\n`,
        err.stack,
      )
    }
  })
  return context
}

const computePageData = (data, config, context, buildFlags, options = {}) => {
  let computed = {
    data: _.isArray(data) ? [...data] : { ...data },
    pendingCount: 0,
  }
  if (buildFlags.incremental) {
    if (options.buildFuncs) {
      computed.buildFuncs = options.buildFuncs
    } else if (_.isArray(data)) {
      computed.buildFuncs = []
    } else if (_.isPlainObject(data)) {
      computed.buildFuncs = {}
    }
  }
  if (!options.topLevelData) {
    // for recursive call
    options.topLevelData = data
  }
  for (let key in data) {
    let value = data[key]

    if (typeof key === "string") {
      if (key.endsWith("_no_cascade")) {
        // this is an override key, computing original key value
        key = key.split("_no_cascade")[0]
      } else if (hasOwnProperty.call(data, key + "_no_cascade")) {
        // there is a data override attribute, bail out.
        continue
      }
    }

    if (typeof value === "function") {
      // it's a function we need to compute the result
      let currentPending = 0
      if (value.kissDependencies) {
        currentPending = countPendingDependencies(
          options.topLevelData,
          context.pages,
          value.kissDependencies,
        )
      }
      if (buildFlags.incremental) {
        // we save the function for later incremental builds
        // so that we can replay them in the data cascade
        computed.buildFuncs[key] = value
      }
      if (currentPending == 0) {
        computed.data[key] = value(options.topLevelData, config, context)
        if (typeof computed.data[key] === "function") {
          // function returned another function. we'll need another round
          computed.pendingCount += 1
        }
      } else {
        // data needs other dependencies to be computed first
        computed.pendingCount += currentPending
        computed.data[key] = value
      }
    } else if (_.isPlainObject(value) || _.isArray(value)) {
      // it's an object: we need to see if there is data to compute inside
      let subComputed = computePageData(value, config, context, buildFlags, {
        ...options,
        buildFuncs: computed.buildFuncs[key],
      })
      computed.data[key] = subComputed.data
      computed.pendingCount += subComputed.pendingCount
      if (buildFlags.incremental) {
        computed.buildFuncs[key] = subComputed.buildFuncs
      }
    } else {
      computed.data[key] = value
    }
  }
  return computed
}

const computeAllPagesData = (context, config, buildFlags) => {
  let pendingTotal = 0
  let round = 1
  let computed = {}

  while (round === 1 || pendingTotal > 0) {
    let entries = getBuildEntries(context, buildFlags)
    pendingTotal = 0
    entries.forEach(([key, page]) => {
      try {
        const computeOptions = buildFlags.incremental
          ? { buildFuncs: context._buildFuncs[key] }
          : {}
        computed = computePageData(
          page,
          config,
          context,
          buildFlags,
          computeOptions,
        )
      } catch (err) {
        global.logger.error(
          `[computePageData] Error during computing page data for page id '${page._meta.id}'\n`,
          err.stack,
        )
      }
      context.pages[key] = computed.data
      pendingTotal += computed.pendingCount
      if (buildFlags.incremental) {
        // save the build functions for incremental builds
        context._buildFuncs[key] = computed.buildFuncs
      }
    })
    if (pendingTotal > 0 && round + 1 > config.defaults.maxComputingRounds) {
      let message = `Could not compute all data in ${config.defaults.maxComputingRounds} rounds.`
      message += ` Check for circular dependencies or increase the 'config.defaults.maxComputingRounds' value.`
      global.logger.error(message)
      break
    }
    if (pendingTotal > 0) {
      global.logger.log(
        `- Round ${round}: ${pendingTotal} data points could not yet be computed. New round.`,
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
              restDeps,
            )),
        )
      } else if (isComputableValue(depValue)) {
        pendingCount++
      } else {
        // assume a single page id
        pendingCount += countPendingDependencies(
          pages[depValue],
          pages,
          restDeps,
        )
      }
    } else {
      throw new Error(
        `countPendingDependencies: dependency should either be a string or an array of strings: ${dep}`,
      )
    }
  })
  return pendingCount
}

const directoryCollectionLoader = (pathname, options, pages, config) => {
  const parentName = path.dirname(pathname)
  const parentNameId = computeParentId(pathname, config)
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
    config,
  )

  return _.merge({}, pages, {
    [parentNameId]: parent,
  })
}

const isComputableValue = (value) =>
  typeof value === "function" ||
  (_.isPlainObject(value) && value._kissCheckDependencies)

const getFiles = (
  loaderId,
  config,
  match = null,
  contentPathInMatch = false,
  fileOptions = {},
) => {
  const loader = config.loaders[loaderId]
  if (!loader) {
    global.logger.error(`Loader with id ${loaderId} not found.`)
    return []
  }
  // eslint-disable-next-line no-unused-vars
  const { handler, namespace, ...loaderOptions } = loader
  const allOptions = getOptions(config, namespace, loaderOptions)
  const { matchOptions = {} } = allOptions
  if (typeof match === "string") {
    match = [match]
  } else if (!match) {
    match = allOptions.match
  }
  const fgOptions = {
    ...matchOptions,
    markDirectories: true,
    stats: true,
  }
  if (!contentPathInMatch) {
    fgOptions.cwd = contentPathInMatch ? "." : config.dirs.content
  }
  return fg.sync(match, fgOptions).map((file) => ({
    ...file,
    loaderId,
    // not sure why but it looks like sometimes fg returns the full path in the name
    name: file.name.includes(path.sep) ? path.basename(file.name) : file.name,
    ...fileOptions,
  }))
}

const getOptions = (config, namespace, options) => {
  const nameSpaceOptions = _.get(config, namespace, {})
  return { ...nameSpaceOptions, ...options }
}

const loadContent = async (config, context, { contentFile }) => {
  let pages = context.pages
  let files = []

  if (contentFile) {
    // incremental build: one content file changed
    // files here are relative to the content directory
    const page = getPageFromInputPath(contentFile, pages)

    if (page) {
      const contentFileObject = path.parse(contentFile)
      const isIndexFile = contentFileObject.name === "index"
      const loaderId = isIndexFile
        ? page._meta.indexLoaderId
        : page._meta.loaderId

      // path.relative(config.dirs.content, contentFile)
      // add to files to load
      files = files.concat(
        getFiles(loaderId, config, contentFile, true, {
          pageId: page._meta.id,
        }),
      )

      // check if we need to load other files too
      if (contentFileObject.name === "index") {
        // it's an index file, there may be more files to load
        if (contentFile !== page._meta.inputPath) {
          // a post overwrote the index file, we need to load the post file too
          const postFile = getFiles(
            page._meta.loaderId,
            config,
            page._meta.inputPath,
            true,
            {
              pageId: page._meta.id,
            },
          )
          files = files.concat(postFile)
        }
        // we will need to reload all descendants
        page._meta.descendants.forEach((id) => {
          const { _meta } = pages[id]
          if (_meta.source !== "file") {
            // we dont reload computed pages for now
            return
          }
          if (
            _meta.indexInputPath &&
            _meta.indexInputPath !== _meta.inputPath
          ) {
            // a post overwrote the index file of that descendant
            // we need to load the post file too
            const indexFile = getFiles(
              _meta.indexLoaderId,
              config,
              _meta.indexInputPath,
              true,
              { pageId: _meta.id },
            )
            files = files.concat(indexFile)
          }
          // get descendant file
          const descendantFiles = getFiles(
            _meta.loaderId,
            config,
            _meta.inputPath,
            true,
            { pageId: _meta.id },
          )
          files = files.concat(descendantFiles)
        })
      }
    }
  } else {
    // We first need to fetch all files
    // So that we can sort them in the right order before loading them
    // This is essential for the data cascade to work properly
    config.loaders.forEach(
      ({ handler, namespace, source, ...loaderOptions }, idx) => {
        if (source && source !== "file") {
          return
        }
        const options = getOptions(config, namespace, loaderOptions)
        if ("active" in options && !options.active) {
          global.logger.log(`[${handler.name}]: loader not active. Skipping.`)
          return
        }
        let extraOptions = []
        if (namespace !== handler.name) {
          extraOptions.push(`namespace: '${namespace}'`)
        }
        if (loaderOptions && Object.keys(loaderOptions).length > 0) {
          extraOptions.push(`options: ${JSON.stringify(loaderOptions)}`)
        }
        // full build: load all files matching this loader
        global.logger.info(
          `Listing files matching ${JSON.stringify(options.match)} for ${handler.name}${extraOptions.length > 0 ? ` (${extraOptions.join(", ")})` : ""}`,
        )
        files = files.concat(getFiles(idx, config))
      },
    )
  }
  if (contentFile) {
    global.logger.info(`Reloading ${files.length} files...`)
  } else {
    global.logger.info(`Found ${files.length} files. Loading...`)
  }
  // sorting and loading files
  // sort files to make sure index.* files are loaded first and post.* files last
  // in order to respect the data cascade principle
  files = sortFiles(files)
  for (const file of files) {
    // finding the right loader for the file
    const { handler, namespace, ...loaderOptions } =
      config.loaders[file.loaderId]
    const options = getOptions(config, namespace, loaderOptions)
    let pathname = contentFile
      ? file.path
      : path.join(config.dirs.content, file.path)
    let page = {}
    try {
      // load parent folders, if any
      pages = directoryCollectionLoader(pathname, options, pages, config)
      // load stats
      page = {
        _meta: {
          fileCreated: file.stats.ctime,
          fileModified: file.stats.mtime,
          loaderId: file.loaderId,
        },
      }
      if (file.name.startsWith("index.")) {
        // also need to save the loader index under indexLoaderId
        page._meta.indexLoaderId = file.loaderId
      }
      // load base data including _meta infos and based on ParentData
      page = baseLoader(pathname, options, page, pages, config)
      if (file.pageId && context._buildFuncs[file.pageId]) {
        // load previous versions of the dynamic data
        page = _.merge(page, context._buildFuncs[file.pageId])
      }
      // load content specific data
      page = await handler(pathname, options, page, context, config)
      // relative @attributes to absolute
      page = relativeToAbsoluteAttributes(page, options, config)
      pages[page._meta.id] = page
      global.logger.log(`- [${handler.name}] loaded '${pathname}'`)
    } catch (err) {
      global.logger.error(
        `- [${handler.name}] Error loading '${pathname}'\n`,
        err.stack,
      )
    }
  }
  if (!contentFile) {
    // computed loaders
    _.filter(config.loaders, (loader) => loader.source === "computed").forEach(
      (loader) => {
        const { description, handler, ...options } = loader
        const message =
          description || `Loading computed pages using ${handler.name}`
        global.logger.info(message)
        pages = handler(pages, options, config)
      },
    )
  }
  return pages
}

const runConfigHooks = (config, event, data, buildFlags) => {
  const hooks = _.get(config.hooks, event)
  if (!hooks || hooks.length === 0) {
    global.logger.log(`No hooks registered for ${event}`)
    return
  }
  hooks.forEach((hook) => {
    if (typeof hook === "function") {
      data = runHandlerHook(hook, {}, config, data, buildFlags)
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
          data = runHandlerHook(handler, options, config, data, buildFlags)
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

const runCopyHook = ({ from, to, description }, config) => {
  const publicTo = path.join(config.dirs.public, to)
  const message = description || `Copying file from '${from}' to '${publicTo}'`
  global.logger.info(message)
  try {
    copySync(from, publicTo)
  } catch (e) {
    global.logger.error(
      `Error copying from '${from}' to '${publicTo}'\n`,
      e.stack,
    )
  }
}

const runExecHook = (command, options) => {
  const message = options.description || `Executing ${command}`
  global.logger.info(message)
  try {
    const res = execSync(command, options).toString()
    global.logger.log(res)
  } catch (err) {
    global.logger.error(err)
  }
}

// Sort files using those rules:
// Files higher in the list will be loaded first
// Inside the same directory load index first, all other files but post files after and post files last
const sortFiles = (files) => {
  return files.sort((fileA, fileB) => {
    const isAIndexFile = fileA.name.startsWith("index.")
    const isBIndexFile = fileB.name.startsWith("index.")
    const isAPostFile = fileA.name.startsWith("post.")
    const isBPostFile = fileB.name.startsWith("post.")

    if (isAIndexFile && isBIndexFile) {
      // both are indexes
      // return the shortest path first to respect data cascade
      return fileA.path.length < fileB.path.length ? -1 : 1
    }
    if (isAIndexFile || isBIndexFile) {
      // one of them is an index file
      // index files first
      return isAIndexFile ? -1 : 1
    }
    if (isAPostFile && isBPostFile) {
      // both are post files
      // we don't want higher up post files to impact lower post files
      // so we return the longest path first
      return fileA.path.length < fileB.path.length ? 1 : -1
    }
    if (isAPostFile || isBPostFile) {
      // one of them is a post file
      // post files last
      return isAPostFile ? 1 : -1
    }
    // all other files
    return 0
  })
}

const runHandlerHook = (handler, options, config, data, buildFlags) => {
  const message = options.description || `Running ${handler.name}`
  global.logger.info(message)
  try {
    return handler(options, config, data, buildFlags)
  } catch (err) {
    global.logger.error(`Error in ${handler.name}:\n`, err.stack)
    return data
  }
}

const writeStaticSite = async (context, config, buildFlags) => {
  let message = "Writing individual pages and images"
  global.logger.info(message)
  const entries = getBuildEntries(context, buildFlags)
  await Promise.all(
    entries.map(async ([, page]) => {
      if (page.excludeFromWrite) {
        global.logger.log(
          `- Page '${page._meta.id}' is marked as excludeFromWrite. Skipping.`,
        )
      } else if (!page.permalink) {
        global.logger.log(
          `- Page '${page._meta.id}' has no permalink. Skipping.`,
        )
      } else {
        const writer = config.writers.find(
          (writer) => writer.outputType === page._meta.outputType,
        )
        if (writer) {
          const { handler, namespace, ...rest } = writer
          const options = getOptions(config, namespace, rest)
          try {
            await handler(page, options, config, context)
            global.logger.log(
              `- [${writer.handler.name}] wrote '${page._meta.outputPath}'`,
            )
          } catch (err) {
            global.logger.error(
              `- [${writer.handler.name}] error writing '${page._meta.outputPath}'\n`,
              err.stack,
            )
          }
        } else {
          global.logger.warn(
            `- no writer for type '${page._meta.outputType}' found for '${page._meta.inputPath}'. Skipping.`,
          )
        }
      }
    }),
  )
  const contextWriters = _.filter(config.writers, { scope: "CONTEXT" })
  if (contextWriters.length === 0) {
    return
  }
  global.logger.info("Writing context-based pages")
  return await Promise.all(
    contextWriters.map(async (writer) => {
      const { handler, namespace, ...rest } = writer
      const options = getOptions(config, namespace, rest)
      if ("active" in options && !options.active) {
        global.logger.log(`- [${handler.name}]: writer not active. Skipping.`)
        return
      }
      try {
        await handler(context, options, config)
        global.logger.log(
          `- [${handler.name}] wrote ${options.target || "file"}`,
        )
      } catch (err) {
        global.logger.error(
          `- [${handler.name}] error writing ${options.target || "file"}\n`,
          err.stack,
        )
      }
    }),
  )
}

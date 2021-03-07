const _ = require("lodash")
const path = require("path")

const { loadConfig } = require("./config")
const { runConfigHooks } = require("./hooks")
const {
  computeAllPagesData,
  computeDataViews,
  withDependencies,
} = require("./compute")
const { loadFileContent, loadDerivedContent } = require("./loaders")
const { setGlobalLogger, unsetGlobalLogger } = require("./logger")
const { writeStaticPages } = require("./writers")

const build = async (options, config = null) => {
  console.time("Build time")
  setGlobalLogger(options.verbosity)
  let data = {
    pages: {},
    collections: {},
  }

  if (!config) {
    global.logger.section("Loading config")
    config = loadConfig(options)
  }

  if (config.hooks.postConfig.length > 0) {
    global.logger.section("Running postConfig hooks")
    config = runConfigHooks(config, "postConfig", config)
  }

  if (config.hooks.preLoad.length > 0) {
    global.logger.section("Running preLoad hooks")
    data = runConfigHooks(config, "preLoad", data)
  }

  global.logger.section(`Loading content from '${config.contentDir}'`)
  data.pages = await loadFileContent(config)
  data.pages = loadDerivedContent(data.pages, config)

  if (config.hooks.postLoad.length > 0) {
    global.logger.section("Running postLoad hooks")
    data = runConfigHooks(config, "postLoad", data)
  }

  global.logger.section("Computing dynamic page data")
  data.pages = computeAllPagesData(data.pages, config)

  global.logger.section("Computing data views")
  data = computeDataViews(data, config)

  if (config.hooks.preWrite.length > 0) {
    global.logger.section("Running preWrite hooks")
    data = runConfigHooks(config, "preWrite", data)
  }

  global.logger.section(`Writing site to '${config.publicDir}'`)
  await writeStaticPages(data, config)

  if (config.hooks.postWrite.length > 0) {
    global.logger.section("Running postWrite hooks")
    runConfigHooks(config, "postWrite", data)
  }

  global.logger.section("Build complete")
  const errorCount = global.logger.counts.error
  const warningCount = global.logger.counts.warn
  if (errorCount > 0) {
    global.logger.error(
      `${errorCount} error(s) and ${warningCount} warning(s) found.`
    )
  } else if (warningCount > 0) {
    global.logger.warn(`${warningCount} warning(s) found.`)
  } else {
    global.logger.success(`Static build completed!`)
  }
  unsetGlobalLogger()
  console.timeEnd("Build time")
}

// require.cache caches js files previously require()ed
// we need to clear them for hot reload
const clearRequireCache = () => {
  _.forEach(require.cache, (_, key) => {
    if (key.startsWith(path.resolve("./")) && !key.includes("node_modules")) {
      delete require.cache[key]
    }
  })
}

const rebuild = (options, event, file) => {
  console.info(`\nChange detected: [${event}] ${file}`)
  const config = loadConfig(options)
  clearRequireCache()
  build(options, config)
}

const start = (options) => {
  const chokidar = require("chokidar")
  const bs = require("browser-sync").create()
  const config = loadConfig(options)

  setGlobalLogger(options.verbosity)

  const fileWatcher = chokidar.watch(".", {
    ignored: [path.join(config.publicDir, "**"), "node_modules", ".*"],
  })

  // rebuild on file changes
  fileWatcher.on(
    "all",
    _.debounce((event, file) => rebuild(options, event, file), 500)
  )

  // remove chokidar watcher
  let signals = [
    `exit`,
    `SIGINT`,
    `SIGUSR1`,
    `SIGUSR2`,
    `uncaughtException`,
    `SIGTERM`,
  ]

  // cleanly close the watchers on exit
  signals.forEach((signal) => {
    process.on(signal, (code) => {
      fileWatcher.close()
      process.exit(code)
    })
  })

  //Launch Browser Sync
  bs.init({
    watch: true,
    server: {
      baseDir: config.publicDir,
      serveStaticOptions: {
        extensions: ["html"],
      },
    },
  })
}

module.exports = {
  build,
  start,
  withDependencies,
}

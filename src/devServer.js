const _ = require("lodash")
const { pathExists, outputFile } = require("fs-extra")
const path = require("path")
const chokidar = require("chokidar")
const bs = require("browser-sync").create()

const { loadConfig } = require("./config")
const { resetGlobalLogger } = require("./logger")

const build = require("./build.js")

let lastBuild = { context: null, config: null }
let buildVersion = 0
let isBuildRunning = false
let changeBacklog = []

const serve = (options, config) => {
  if (!config) {
    config = loadConfig(options)
  }
  //Launch Browser Sync server
  bs.init({
    watch: true,
    watchOptions: { awaitWriteFinish: true },
    server: {
      baseDir: config.dirs.public,
      serveStaticOptions: {
        extensions: ["html"],
      },
    },
  })
}

const start = async (options) => {
  const config = loadConfig(options)
  await preparePublicFolder(config)
  watch(options, config)
  serve(options, config)
}

const watch = async (options = {}, config) => {
  options.watchMode = true

  if (!config) {
    config = loadConfig(options)
  }

  // set watches
  const fileWatcher = chokidar.watch(
    [
      config.dirs.content,
      config.dirs.theme,
      config.configFile,
      ...config.dirs.watchExtra,
    ],
    { awaitWriteFinish: true, ignoreInitial: true },
  )

  // initial build
  lastBuild = await build(options)

  if (options.incremental) {
    console.info("Incremental build mode enabled")
    // TODO: need to load config
    // rebuild only the changed file
    fileWatcher.on("all", async (event, file) => {
      if (isBuildRunning) {
        changeBacklog.push({ event, file })
        return
      }
      isBuildRunning = true
      lastBuild = await incrementalRebuild(options, lastBuild, event, file)
      while (changeBacklog.length > 0) {
        const change = changeBacklog.shift()
        lastBuild = incrementalRebuild(
          lastBuild,
          options,
          change.event,
          change.file,
        )
      }
      isBuildRunning = false
    })
  } else {
    // rebuild all on file changes
    fileWatcher.on(
      "all",
      _.debounce((event, file) => rebuild(options, event, file), 500),
    )
  }

  // remove chokidar watcher
  let signals = [
    `exit`,
    `SIGINT`,
    `SIGUSR1`,
    `SIGUSR2`,
    `uncaughtException`,
    `SIGTERM`,
  ]

  // close watchers on exit
  signals.forEach((signal) => {
    process.on(signal, (code) => {
      fileWatcher.close()
      if (signal === "uncaughtException") {
        global.logger.error("kiss encountered a fatal error\n", code)
      }
      process.exit(1)
    })
  })
}

module.exports = {
  serve,
  start,
  watch,
}

/** Private **/

// require.cache caches js files previously require()ed
// we need to clear them for hot reload
const clearRequireCache = () => {
  _.forEach(require.cache, (_, key) => {
    if (key.startsWith(path.resolve("./")) && !key.includes("node_modules")) {
      delete require.cache[key]
    }
  })
}

const preparePublicFolder = async (config) => {
  const publicRootFile = path.join(config.dirs.public, "index.html")
  if (!(await pathExists(publicRootFile))) {
    // create a placeholder index.html file so that BrowserSync can start
    // with no error
    return outputFile(
      publicRootFile,
      "<html><head></head><body><h3>Building site, please wait...</h3></body></html>",
    )
  }
}

const rebuild = (options, event, file) => {
  global.logger.section(`\nChange detected: [${event}] ${file}`)
  clearRequireCache()
  resetGlobalLogger(options.verbosity)
  return build(options)
}

const incrementalRebuild = async (options, lastBuild, event, file) => {
  buildVersion++
  global.logger.section(
    `\nChange detected: [${event}] ${file}. Incremental rebuild #${buildVersion}...`,
  )
  clearRequireCache()
  resetGlobalLogger(options.verbosity)
  return build({ event, file, ...options }, lastBuild, buildVersion)
}

const _ = require("lodash")
const { pathExists, outputFile } = require("fs-extra")
const path = require("path")
const chokidar = require("chokidar")

const { loadConfig } = require("./config")
const { resetGlobalLogger } = require("./logger")

const build = require("./build.js")

let lastBuild = { context: null, config: null }
let buildVersion = 0
let isBuildRunning = false
let changeBacklog = []

const serve = async (options, config) => {
  let createViteServer
  try {
    createViteServer = require("vite").createServer
  } catch {
    global.logger.error(
      'vite is required for "kiss start" and "kiss serve".\n' +
        "Install it with: npm install vite",
    )
    process.exit(1)
  }
  if (!config) {
    config = loadConfig(options)
  }
  const server = await createViteServer({
    root: config.dirs.public,
    configFile: false,
    server: { open: true, port: 3000 },
    appType: "mpa",
    logLevel: "silent",
  })
  await server.listen()
  global.logger.success(
    `Dev server running at http://localhost:${server.config.server.port}/`,
  )
}

const start = async (options) => {
  const config = loadConfig(options)
  await preparePublicFolder(config)
  await watch(options, config)
  await serve(options, config)
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
    global.logger.info("Incremental build mode enabled")
    // rebuild only the changed file
    fileWatcher.on("all", async (event, file) => {
      if (isBuildRunning) {
        // there is already a build running, add to backlog
        changeBacklog.push({ event, file })
        return
      }
      isBuildRunning = true
      lastBuild = await incrementalRebuild(options, lastBuild, event, file)
      while (changeBacklog.length > 0) {
        const change = changeBacklog.shift()
        lastBuild = await incrementalRebuild(
          options,
          lastBuild,
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
    // create a placeholder index.html file so that the dev server can start
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

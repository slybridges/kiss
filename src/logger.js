const chalk = require("chalk")

const getLevel = (level) =>
  ["log", "info", "section", "success", "warn", "error"].findIndex(
    (l) => l === level,
  )

// Track when logging started for elapsed time
let startTime = null

const getElapsedTimestamp = () => {
  // Initialize start time on first log
  if (!startTime) {
    startTime = Date.now()
  }
  
  const elapsed = Date.now() - startTime
  const totalSeconds = Math.floor(elapsed / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const log = (level, verbosity, ...args) => {
  if (getLevel(verbosity) > getLevel(level)) {
    return
  }
  const timestamp = chalk.gray(getElapsedTimestamp())
  const defaultHandler = (config, ...args) =>
    console.log(timestamp, config.color(config.prefix), ...args)

  let config = {
    error: { prefix: " ERR", color: chalk.bgRed },
    info: { prefix: "INFO", color: chalk.blue },
    log: { prefix: "   ", color: chalk.white },
    success: { prefix: " OK ", color: chalk.bgGreen },
    warn: { prefix: "WARN", color: chalk.bgHex("FF6600").black },
    section: { handler: (config, ...args) => console.log(timestamp, chalk.bold(...args)) },
  }

  global.logger.counts[level]++

  const logConfig = config[level]
  if (logConfig.handler) {
    return logConfig.handler(logConfig, ...args)
  }
  return defaultHandler(logConfig, ...args)
}

const makeLogger = (verbosity = "info") => ({
  error: (...args) => log("error", verbosity, ...args),
  info: (...args) => log("info", verbosity, ...args),
  log: (...args) => log("log", verbosity, ...args),
  section: (...args) => log("section", verbosity, ...args),
  success: (...args) => log("success", verbosity, ...args),
  warn: (...args) => log("warn", verbosity, ...args),
  counts: {
    error: 0,
    info: 0,
    log: 0,
    section: 0,
    success: 0,
    warn: 0,
  },
})

const setGlobalLogger = (verbosity) => {
  if (!global.logger) {
    // Reset start time for new logger session
    startTime = null
    global.logger = makeLogger(verbosity)
  }
}

const unsetGlobalLogger = () => {
  delete global.logger
  // Reset start time when logger is removed
  startTime = null
}

const resetGlobalLogger = (verbosity) => {
  unsetGlobalLogger()
  setGlobalLogger(verbosity)
}

module.exports = {
  resetGlobalLogger,
  setGlobalLogger,
  unsetGlobalLogger,
}

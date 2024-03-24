const chalk = require("chalk")

const getLevel = (level) =>
  ["log", "info", "section", "success", "warn", "error"].findIndex(
    (l) => l === level,
  )

const log = (level, verbosity, ...args) => {
  if (getLevel(verbosity) > getLevel(level)) {
    return
  }
  const defaultHandler = (config, ...args) =>
    console.log(config.color(config.prefix), ...args)

  let config = {
    error: { prefix: " ERR", color: chalk.bgRed },
    info: { prefix: "INFO", color: chalk.blue },
    log: { prefix: "   ", color: chalk.white },
    success: { prefix: " OK ", color: chalk.bgGreen },
    warn: { prefix: "WARN", color: chalk.bgHex("FF6600").black },
    section: { handler: (config, ...args) => console.log(chalk.bold(...args)) },
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
    global.logger = makeLogger(verbosity)
  }
}

const unsetGlobalLogger = () => {
  delete global.logger
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

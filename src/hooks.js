const _ = require("lodash")
const path = require("path")
const { copySync } = require("fs-extra")
const { execSync } = require("child_process")

const runConfigHooks = (config, event, data) => {
  const hooks = _.get(config.hooks, event)
  if (!hooks) {
    global.logger.info(`No hooks registered for ${event}`)
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
  const publicTo = path.join(config.publicDir, to)
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
  global.logger.info(`Running ${handler.name}()`)
  try {
    return handler(options, config, data)
  } catch (err) {
    global.logger.error(`Error in ${handler.name}(): ${err}`)
    return data
  }
}

module.exports = {
  runConfigHooks,
}

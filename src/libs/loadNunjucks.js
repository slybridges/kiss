const nunjucks = require("nunjucks")

const loadNunjucks = (_, config, data, buildFlags = {}) => {
  const watchMode = !!buildFlags.incremental
  const options = {
    // we need to watch them so that template can be reloaded when in incremental mode
    // (in normal mode, config is reloaded which reloads the lib and clears the cache)
    watch: watchMode,
  }

  // Check if we need to recreate the environment due to watch mode change
  const existingEnv = config.libs.nunjucks
  const needsRecreate = existingEnv && existingEnv.opts.watch !== watchMode

  if (needsRecreate) {
    // Watch mode changed - must create a new environment
    // This can happen if tests or builds mix incremental and non-incremental modes
    global.logger?.warn?.(
      `Recreating Nunjucks environment due to watch mode change (${existingEnv.opts.watch} → ${watchMode})`,
    )
  }

  // set default nunjucks template dir
  config.libs.nunjucks = nunjucks.configure(config.dirs.template, options)
  // clear nunjucks caches (for when in watch mode)
  // https://risanb.com/code/how-to-clear-nunjucks-cache/
  config.libs.nunjucks.loaders.map((loader) => (loader.cache = {}))

  return config
}

module.exports = loadNunjucks

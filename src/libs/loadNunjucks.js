const nunjucks = require("nunjucks")

const loadNunjucks = (_, config, buildFlags) => {
  const options = {
    // we need to watch them so that template can be reloaded when in incremental mode
    // (in normal mode, config is reloaded which reloads the lib and clears the cache)
    watch: !!buildFlags.incremental,
  }
  // set default nunjucks template dir
  config.libs.nunjucks = nunjucks.configure(config.dirs.template, options)
  // clear nunjucks caches (for when in watch mode)
  // https://risanb.com/code/how-to-clear-nunjucks-cache/
  config.libs.nunjucks.loaders.map((loader) => (loader.cache = {}))

  return config
}

module.exports = loadNunjucks

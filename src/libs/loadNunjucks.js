const nunjucks = require("nunjucks")

const loadNunjucks = (_, config) => {
  // set default nunjucks template dir
  config.libs.nunjucks = nunjucks.configure(config.dirs.template)
  // clear nunjucks caches (for when in watch mode)
  // https://risanb.com/code/how-to-clear-nunjucks-cache/
  config.libs.nunjucks.loaders.map((loader) => (loader.cache = {}))

  return config
}

module.exports = loadNunjucks

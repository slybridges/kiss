const slugify = require("slugify")

const loadSlugify = (_, config) => {
  // default slugify to lower case
  config.libs.slugify = (str, options) =>
    slugify(str, { lower: true, ...options })

  return config
}

module.exports = loadSlugify

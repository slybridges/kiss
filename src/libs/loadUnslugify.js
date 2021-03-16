const unslugify = (slug, options = {}) => {
  const { dash = " ", slash = " ", words = [] } = options
  return (
    slug
      // remove fist and final "/"
      .replace(/^\/|\/$/g, "")
      // convert dashes into their replacement
      .replace(/-/g, dash)
      // convert slashes into their replacement
      .replace(/\//g, slash)
      // convert matching words into their replacement
      .replace(/\w\S*/g, (word) => {
        words.forEach((r) => {
          if (r[0] === word) {
            word = r[1]
          }
        })
        return word
      })
      .trim()
  )
}

const loadUnslugify = (_, config) => {
  // default unslugify with and -> & replacement
  config.libs.unslugify = (slug, options) =>
    unslugify(slug, { words: [["and", "&"]], ...options })

  return config
}

module.exports = loadUnslugify

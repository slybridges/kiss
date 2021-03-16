const computeURL = ({ permalink }, config, context) => {
  if (!context.site.url) {
    return permalink
  }
  return new URL(permalink, context.site.url).href
}

computeURL.kissDependencies = ["permalink"]

module.exports = computeURL

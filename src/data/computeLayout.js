const computeLayout = ({ _meta }, config) => {
  if (_meta.isPost) {
    return config.templates.post || "post.njk"
  }
  if (_meta.isCollection) {
    return config.templates.collection || "collection.njk"
  }
  return config.templates.default || "default.njk"
}

computeLayout.kissDependencies = ["_meta.isCollection", "_meta.isPost"]

module.exports = computeLayout

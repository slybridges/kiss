const computeLayout = ({ _meta }) => {
  if (_meta.isCollection) {
    return "collection.njk"
  }
  if (_meta.isPost) {
    return "post.njk"
  }
  return "default.njk"
}

computeLayout.kissDependencies = ["_meta.isCollection", "_meta.isPost"]

module.exports = computeLayout

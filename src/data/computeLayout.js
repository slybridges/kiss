const computeLayout = ({ _meta }) => {
  if (_meta.isPost) {
    return "post.njk"
  }
  if (_meta.isCollection) {
    return "collection.njk"
  }
  return "default.njk"
}

computeLayout.kissDependencies = ["_meta.isCollection", "_meta.isPost"]

module.exports = computeLayout

const computeModified = ({ _meta }, config, { pages }) => {
  // take the latest modified date of all descendants
  if (_meta.isCollection) {
    const latest = _meta.descendants.reduce((latest, pageId) => {
      const modified = pages[pageId][config.defaults.pageUpdatedAttribute]
      // assume an date is a valid Date object if it has a getMonth function
      if (!modified || typeof modified?.getMonth !== "function") {
        // invalid or net yet computed
        return latest
      }
      return modified > latest ? modified : latest
    }, 0)
    if (latest !== 0) {
      return latest
    }
  }
  if (_meta.fileModified) {
    return _meta.fileModified
  }
}

computeModified.kissDependencies = [["_meta.descendants", "modified"]]

module.exports = computeModified

const computeCreated = ({ _meta }, config, { pages }) => {
  // take the earliest created date of all descendants
  if (_meta.isCollection) {
    const earliest = _meta.descendants.reduce((earliest, pageId) => {
      const page = pages[pageId]
      if (!page) {
        // page doesn't exist
        return earliest
      }
      const created = page[config.defaults.pagePublishedAttribute]
      // assume an date is a valid Date object if it has a getMonth function
      if (!created || typeof created?.getMonth !== "function") {
        // invalid or net yet computed
        return earliest
      }
      return created < earliest ? created : earliest
    }, Infinity)
    if (earliest !== Infinity) {
      return earliest
    }
  }

  if (_meta.fileCreated) {
    return _meta.fileCreated
  }
}

computeCreated.kissDependencies = [["_meta.descendants", "created"]]

module.exports = computeCreated

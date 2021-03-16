const { getParentPage } = require("../helpers")

const computeCategory = ({ _meta }, config, { pages }) => {
  if (_meta.parent) {
    const parent = getParentPage(pages, _meta.parent)
    return parent._meta.basename.replace(new RegExp(/index\.\w+$/), "")
  }
  return ""
}

computeCategory.kissDependencies = ["_meta.parent"]

module.exports = computeCategory

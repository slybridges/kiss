const computePermalink = ({ _meta }, config) => {
  // remove top level dir (dirs.content)
  let permalink = _meta.inputPath.replace(
    new RegExp(`^${config.dirs.content}`),
    ""
  )
  if (_meta.outputType === "HTML") {
    permalink = permalink
      // replace index.[ext] or post.[ext] by terminal /
      .replace(new RegExp(/\/index\.[a-z]+$/), "/")
      .replace(new RegExp(/\/post\.[a-z]+$/), "/")
      // remove extensions
      .replace(new RegExp(/\.[a-z]+$/), "")
  }
  if (_meta.isDirectory && !permalink.endsWith("/")) {
    permalink += "/"
  }
  return permalink
}

module.exports = computePermalink

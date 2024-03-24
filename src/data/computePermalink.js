const path = require("path")

const computePermalink = ({ slug, _meta }, config, { pages }) => {
  // remove top level dir (dirs.content)
  let permalink = _meta.inputPath.replace(
    new RegExp(`^${config.dirs.content}`),
    "",
  )
  if (_meta.outputType === "HTML") {
    permalink = permalink
      // replace index.[ext] or post.[ext] by terminal /
      .replace(new RegExp(/\/index\.[a-z]+$/), "/")
      .replace(new RegExp(/\/post\.[a-z]+$/), "/")
      // remove extensions
      .replace(new RegExp(/\.[a-z]+$/), "")
  }
  let basePermalink
  if (slug) {
    // if the basename starts with post or index, the slug will be a directory
    if (
      _meta.basename.startsWith("post.") ||
      _meta.basename.startsWith("index.")
    ) {
      slug += "/"
    }
  } else {
    const parts = permalink.split("/")
    // get the slug from the last non empty part of the permalink
    if (permalink.endsWith("/")) {
      slug = parts[parts.length - 2] + "/"
    } else {
      slug = parts[parts.length - 1]
    }
  }

  if (_meta.parent) {
    // we want to look into the parent in case they have a customized permalink
    const parent = pages[_meta.parent]
    if (typeof parent.permalink === "function") {
      // return the function itself hoping parent permalint will be computed later
      return computePermalink({ slug, _meta }, config, { pages })
    }
    if (typeof parent.permalink === "string") {
      basePermalink = parent.permalink
    }
  }
  if (!basePermalink) {
    // basePermalink is everything before the slug
    basePermalink = permalink.slice(0, -slug.length)
  }
  permalink = path.join(basePermalink, slug)
  if (_meta.isDirectory && !permalink.endsWith("/")) {
    permalink += "/"
  }
  return permalink
}

computePermalink.kissDependencies = ["slug", ["_meta.parent", "permalink"]]

module.exports = computePermalink

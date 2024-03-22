const computeCategory = require("./computeCategory")
const computeCreated = require("./computeCreated")
const computeDescription = require("./computeDescription")
const computeImage = require("./computeImage")
const computeLayout = require("./computeLayout")
const computeModified = require("./computeModified")
const computePermalink = require("./computePermalink")
const {
  computeAscendants,
  computeChildren,
  computeDescendants,
  computeIsCollection,
  computeIsPost,
  computeOutputPath,
} = require("./computeMeta")
const computeTitle = require("./computeTitle")
const computeURL = require("./computeURL")

const initialPageData = {
  author: {
    name: null,
    email: null,
    uri: null,
  },
  category: computeCategory,
  created: computeCreated,
  description: computeDescription,
  excludeFromCollection: false,
  excludeFromSitemap: false,
  image: computeImage,
  layout: computeLayout,
  modified: computeModified,
  permalink: computePermalink,
  slug: null, // use to overide the default slug of the permalink
  title: computeTitle,
  url: computeURL,
  // populated by baseLoader
  _meta: {
    ascendants: computeAscendants,
    id: "",
    basename: "",
    children: computeChildren,
    descendants: computeDescendants,
    fileCreated: null,
    fileModified: null,
    inputPath: "",
    isCollection: computeIsCollection,
    isDirectory: false,
    isPost: computeIsPost,
    outputPath: computeOutputPath,
    parent: null,
    outputType: null,
  },
  _html: null, // populated by content transformers
}

module.exports = initialPageData

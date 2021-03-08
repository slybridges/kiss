const _ = require("lodash")
const { copy, outputFile } = require("fs-extra")

// removing any key ending with _no_cascade
const omitNoCascadeAttributes = (obj) => {
  let result = {}
  _.forEach(obj, (value, key) => {
    if (_.isPlainObject(value)) {
      result[key] = omitNoCascadeAttributes(value)
    } else if (!key.endsWith("_no_cascade")) {
      result[key] = value
    }
  })
  return result
}

const flattenObjects = (obj, predicate) => {
  let flatArray = []
  _.forEach(obj, (value) => {
    if (_.isPlainObject(value) && predicate(value)) {
      flatArray.push(value)
      flatArray = [...flatArray, ...flattenObjects(value, predicate)]
    }
  })
  return flatArray
}

const getChildrenPages = (page, pages, filterOptions) => {
  const children = page._meta.children.map((c) => pages[c])
  if (filterOptions) {
    return _.filter(children, filterOptions)
  }
  return children
}

const getDescendantPages = (page, pages, { filterBy, orderBy } = {}) => {
  let descendants = page._meta.descendants.map((desc) => pages[desc])
  let reverse = false
  if (filterBy) {
    descendants = _.filter(descendants, filterBy)
  }
  if (orderBy) {
    if (orderBy[0] === "-") {
      reverse = true
      orderBy = orderBy.slice(1)
    }
    descendants = _.orderBy(descendants, orderBy)
    if (reverse) {
      descendants = descendants.reverse()
    }
  }
  return descendants
}

// returns the parent sanitizing the data for the cascade
const getParentPage = (pages, id) => {
  if (id === ".") {
    // top level, no parent
    return {}
  }
  let parent = pages[id]
  if (!parent) {
    global.logger.error(`Couldn't find parent with id '${id}'`)
    console.log(Object.keys(pages))
  }
  return omitNoCascadeAttributes(parent)
}

const copyFileAtPath = async (srcPath, destPath) => {
  try {
    await copy(srcPath, destPath)
    return { file: destPath, err: null }
  } catch (err) {
    return { file: destPath, err }
  }
}

const findCollectionById = (collections, id) => {
  const flatCollections = flattenObjects(
    collections,
    (v) => v._type === "collection"
  )
  return flatCollections.find((collection) => collection._id === id)
}

const unslugify = (slug, options = {}) => {
  const { dash = " ", slash = " ", words = [] } = options
  return slug
    .replace(/^\/|\/$/g, "")
    .replace(/-/g, dash)
    .replace(/\//g, slash)
    .replace(/[-_]/g, " ")
    .replace(/\w\S*/g, (word) => {
      words.forEach((r) => {
        if (r[0] === word) {
          word = r[1]
        }
      })
      return word
    })
    .trim()
}

const writeFileAtPath = async (file, content) => {
  try {
    await outputFile(file, content)
    return { file, err: null }
  } catch (err) {
    return { file, err }
  }
}

module.exports = {
  copyFileAtPath,
  findCollectionById,
  getChildrenPages,
  getDescendantPages,
  getParentPage,
  unslugify,
  writeFileAtPath,
}

const { readFileSync } = require("fs")
const frontMatter = require("front-matter")
const marked = require("marked")
const path = require("path")
const _ = require("lodash")
const fg = require("fast-glob")

const { getParentPage } = require("./utils")

const getTopLevelData = (pages, config) => {
  const topPage = _.find(
    pages,
    (page) =>
      !page._meta.parent &&
      (page._meta.inputPath === config.contentDir ||
        page._meta.inputPath.match(`^${config.contentDir}/index\\.\\w+$`))
  )
  if (!pages) {
    global.logger.warn(
      `getTopLevelData: Could not find top level page. Returning default config data instead.`
    )
    return config.topLevelPageData
  }
  return topPage
}

// load content from disk
const loadFileContent = async (config) => {
  let pages = {}
  await Promise.all(
    config.sources
      .filter((source) => source.source === "file")
      .map(async ({ match, matchOptions = {}, loader, ...options }) => {
        let fgOptions = {
          cwd: config.contentDir,
          markDirectories: true,
          ...matchOptions,
        }
        let files = fg.stream(match, fgOptions)
        global.logger.info(
          `Loading files matching ${match} using ${loader.name}`
        )
        for await (const file of files) {
          let pathname = path.join(config.contentDir, file)
          let page = {}
          try {
            // load parent folders, if any
            pages = directoryCollectionLoader(pathname, options, config, pages)
            // load base data including _meta infos and based on ParentData
            page = baseLoader(pathname, options, {}, pages)
            // load content specific data
            page = loader(pathname, options, page)
            pages[page._meta.id] = page
            global.logger.log(
              `- [${loader.name}] loaded '${page._meta.inputPath}'`
            )
          } catch (err) {
            global.logger.error(
              `- [${loader.name}] error loading '${_.get(
                page,
                "_meta.inputPath"
              )}'\n`,
              err
            )
          }
        }
      })
  )
  return pages
}

// load content derived from existing pages
const loadDerivedContent = (pages, config) => {
  let computedPages = {}
  _.filter(config.sources, (s) => s.source === "computed").forEach((source) => {
    const { loader, ...sourceOptions } = source
    computedPages = {
      ...computedPages,
      ...loader(pages, sourceOptions, config),
    }
  })
  return { ...pages, ...computedPages }
}

const directoryCollectionLoader = (pathname, options, config, pages) => {
  const parentname = path.dirname(pathname)
  if (pages[parentname]) {
    // parent already in the collection
    return pages
  }
  let isTopLevel = true
  const parentBasename = path.basename(parentname)
  if (parentBasename !== parentname) {
    // there is a parent of the parent folder
    // according to our top down data cascade approach,
    // we need to compute this one first
    isTopLevel = false
    pages = directoryCollectionLoader(parentname, options, config, pages)
  }
  let parent = baseLoader(
    parentname,
    { type: "collection", isDirectory: true, collectionGroup: "directory" },
    isTopLevel ? config.topLevelPageData : {},
    pages
  )

  return _.merge({}, pages, {
    [parentname]: parent,
  })
}

const baseLoader = (inputPath, options = {}, page = {}, pages = {}) => {
  let parent = path.dirname(inputPath)
  let basename = path.basename(inputPath)
  const parentData = getParentPage(pages, parent)
  let isDirectory = options.isDirectory || inputPath.endsWith("/")
  let id = inputPath
  let type = options.type
  let collectionGroup = options.collectionGroup
  if (basename.startsWith("index.")) {
    // directory index, replace parent and most parent _meta
    // FIXME: how about index.jpg?
    id = _.get(parentData, "_meta.id", "")
    parent = _.get(parentData, "_meta.parent", "")
    basename = _.get(parentData, "_meta.basename", "")
    isDirectory = true
    type = "collection"
  } else if (basename.startsWith("post.")) {
    // directory post, replace parent but overwrite the rest
    // FIXME: how about post.jpg?
    id = _.get(parentData, "_meta.id", "")
    parent = _.get(parentData, "_meta.parent", "")
    type = "post"
  }
  if (type === "collection") {
    if (!collectionGroup) {
    // default collection group to directory
    collectionGroup = "directory"
    }
  } else {
    // collectionGroup only applies to collection type
    collectionGroup = null
  }

  page = _.merge({}, parentData, page, {
    _meta: {
      id,
      basename,
      inputPath,
      isDirectory,
      parent: parent === "." ? null : parent,
      source: options.source,
      type,
      collectionGroup,
    },
  })
  return page
}

const htmlLoader = (id, options, page) => {
  const fileContent = readFileSync(page._meta.inputPath, "utf8")
  const fileData = frontMatter(fileContent)
  const content = fileData.body
  return { ...page, ...fileData.attributes, content }
}

const jsLoader = (id, options, page) => {
  const filePath = path.resolve(page._meta.inputPath)
  const fileData = require(filePath)
  return { ...page, ...fileData }
}

const markdownLoader = (id, options, page) => {
  const fileContent = readFileSync(page._meta.inputPath, "utf8")
  const fileData = frontMatter(fileContent)
  const content = marked(fileData.body)
  return { ...page, ...fileData.attributes, content }
}

const staticLoader = (id, options, { slug, _meta }) => ({ slug, _meta })

const computeCollectionLoader = (pages, options, config) => {
  const { libs } = config
  let normalizedPages
  if (!options.groupBy) {
    throw new Error("computeCollectionLoader needs a groupBy option.")
  }
  if (!options.pageData) {
    options.pageData = getTopLevelData(pages, config)
  }
  if (!options.filter) {
    options.filter = (page) => page._meta.type === "post"
  }
  if (!options.name) {
    options.name = options.groupBy
  }
  let baseSlug = path.join(
    "/",
    options.baseSlug || libs.slugify(options.groupBy)
  )
  if (options.groupByType === "array") {
    if (typeof options.groupBy !== "string") {
      throw new Error(
        "computeCollectionLoader: groupBy options needs to be a string"
      )
    }
    // we need to normalize pages to list each array element individually
    normalizedPages = _.reduce(
      pages,
      (result, page) => {
        let elements = _.get(page, options.groupBy)
        if (!elements) {
          return result
        }
        if (!_.isArray(elements)) {
          // not iterable, lets use it as groupKey
          result.push({ ...page, _groupKey: elements })
          return result
        }
        elements.map((element) => result.push({ ...page, _groupKey: element }))
        return result
      },
      []
    )
    options.groupBy = "_groupKey"
  } else {
    normalizedPages = pages
  }
  const groupedPages = _.chain(normalizedPages)
    .filter(options.filter)
    .groupBy(options.groupBy)
    // don't include pages that result in 'undefined' key during groupBy
    .omit(undefined)
    .map((pages, collection) => ({
      collection,
      children: pages.map((page) => page._meta.id),
    }))
    .value()

  // add the main top level page
  const inputPath = path.join(config.contentDir, baseSlug)

  // FIXME: baseLoader shouldn't called
  // in a computed handler but outside of it
  let topLevelPage = baseLoader(
    inputPath,
    { type: "collection", source: "computed", collectionGroup: options.name },
    {},
    pages
  )
  pages[topLevelPage._meta.id] = topLevelPage

  // individual pages
  _.forEach(groupedPages, ({ collection, children }) => {
    let inputPath = path.join(
      config.contentDir,
      baseSlug,
      libs.slugify(collection)
    )
    let computedPage = baseLoader(
      inputPath,
      { type: "collection", source: "computed", collectionGroup: options.name },
      {
        _meta: {
          children,
          descendants: children,
        },
      },
      pages
    )
    pages[computedPage._meta.id] = computedPage
  })
  return { ...pages }
}

module.exports = {
  htmlLoader,
  jsLoader,
  loadFileContent,
  loadDerivedContent,
  markdownLoader,
  staticLoader,
  computeCollectionLoader,
}

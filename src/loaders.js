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

const loadContent = async (config) => {
  let pages = {}
  // file loaders
  await Promise.all(
    config.sources
      .filter((source) => !source.source || source.source === "file")
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
  // computed loaders
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
  const parentName = path.dirname(pathname)
  if (pages[parentName]) {
    // parent already in the collection
    return pages
  }
  let isTopLevel = true
  const parentBasename = path.basename(parentName)
  if (parentBasename !== parentName) {
    // there is a parent of the parent folder
    // according to our top down data cascade approach,
    // we need to compute this one first
    isTopLevel = false
    pages = directoryCollectionLoader(parentName, options, config, pages)
  }
  let parent = baseLoader(
    parentName,
    { isDirectory: true, collectionGroup: "directory" },
    isTopLevel ? config.topLevelPageData : {},
    pages
  )

  return _.merge({}, pages, {
    [parentName]: parent,
  })
}

const baseLoader = (inputPath, options = {}, page = {}, pages = {}) => {
  let parent = path.dirname(inputPath)
  let basename = path.basename(inputPath)
  const parentData = getParentPage(pages, parent)
  let isDirectory = options.isDirectory || inputPath.endsWith("/")
  let id = inputPath
  let outputType = options.outputType || "HTML"
  let collectionGroup = options.collectionGroup
  if (outputType === "HTML") {
    // only files converted as HTML can override
    // they parent entry
    if (basename.startsWith("index.")) {
      // directory index, replace parent and most parent _meta
      id = _.get(parentData, "_meta.id", "")
      parent = _.get(parentData, "_meta.parent", "")
      basename = _.get(parentData, "_meta.basename", "")
      isDirectory = true
    } else if (basename.startsWith("post.")) {
      // directory post, replace parent and overwrite the rest
      id = _.get(parentData, "_meta.id", "")
      parent = _.get(parentData, "_meta.parent", "")
    }
  }
  if (isDirectory) {
    if (!collectionGroup) {
      // set default collection group to directory
      collectionGroup = "directory"
    }
  }

  page = { ...parentData, ...page }
  // deep merge metadata to keep parent ones
  page._meta = _.merge(parentData._meta, page._meta, {
    id,
    basename,
    inputPath,
    isDirectory,
    parent: parent === "." ? null : parent,
    source: options.source,
    outputType,
    collectionGroup,
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

const staticLoader = (id, options, { slug, _meta }) => {
  return {
    slug,
    _meta: {
      // remove relationship information
      ..._.omit(_meta, [
        "ascendants",
        "children",
        "descendants",
        "isCollection",
        "isPost",
        "parent",
      ]),
      outputType: options.outputType || "STATIC",
    },
  }
}

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
    options.filter = (page) => !!page.content //no access to isPost yet (we're pre-cascade)
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
    { source: "computed", collectionGroup: options.name },
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
      { source: "computed", collectionGroup: options.name },
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
  loadContent,
  markdownLoader,
  staticLoader,
  computeCollectionLoader,
}

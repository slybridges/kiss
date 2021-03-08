const path = require("path")
const _ = require("lodash")

const { getParentPage, getDescendantPages } = require("./utils")

const isChild = (page, child) => child._meta.parent === page._meta.id

const isDescendant = (page, descendant, pages) =>
  isChild(page, descendant) ||
  _.some(computeChildren(page, {}, pages), (child) =>
    isDescendant(pages[child], descendant, pages)
  )

const countPendingDependencies = (page, pages, deps = []) => {
  let pendingCount = 0
  deps.forEach((dep) => {
    if (typeof dep === "string") {
      // assume attribute is part of the page data
      if (typeof _.get(page, dep) === "function") {
        // dependency is not yet computed
        pendingCount++
      }
    } else if (_.isArray(dep)) {
      // list of chained dependencies, we have to look into other pages
      let [data, ...restDeps] = dep
      if (_.isArray(data)) {
        // assume list of page ids
        data.forEach(
          (id) =>
            (pendingCount += countPendingDependencies(
              pages[id],
              pages,
              restDeps
            ))
        )
      } else {
        // assume a single page id
        pendingCount += countPendingDependencies(pages[data], pages, restDeps)
      }
    } else {
      throw new Error(
        `countPendingDependencies: dependency should either be a string or an array of strings: ${dep}`
      )
    }
  })
  return pendingCount
}

const computeAscendants = ({ _meta }, config, pages) => {
  if (_meta.parent) {
    const parent = getParentPage(pages, _meta.parent)
    return [...computeAscendants(parent, config, pages), parent._meta.id]
  }
  return []
}

const computeCategory = ({ _meta }, config, pages) => {
  if (_meta.parent) {
    const parent = getParentPage(pages, _meta.parent)
    return parent._meta.basename.replace(new RegExp(/index\.\w+$/), "")
  }
  return ""
}

const computeChildren = (page, config, pages) =>
  _.filter(pages, (child) => isChild(page, child)).map(
    (child) => child._meta.id
  )

const computeDescendants = (page, config, pages) =>
  _.filter(pages, (child) => isDescendant(page, child, pages)).map(
    (child) => child._meta.id
  )

const computeDescription = (page, config) => {
  // https://moz.com/learn/seo/meta-description
  // Meta descriptions can be any length, but Google generally truncates snippets to ~155–160 characters.
  if (!page.content) {
    return ""
  }
  const { JSDOM } = config.libs.jsdom
  const dom = new JSDOM(page.content)
  console.log
  return _.truncate(dom.window.document.body.textContent, {
    length: 160,
    separator: " ",
  })
}

const computeImage = (page, config) => {
  if (!page.content) {
    return null
  }
  const { JSDOM } = config.libs.jsdom
  const dom = new JSDOM(page.content)
  const img = dom.window.document.querySelector("img")
  if (!img) {
    return null
  }
  return path.isAbsolute(img.src) ? img.src : path.join(page.slug, img.src)
}

const computeLayout = ({ _meta }, config) =>
  _meta.type ? `${_meta.type}.njk` : config.defaultLayout

const computeOutputPath = ({ slug }, config) => {
  // replace top level dir (contentDir) by publicDir
  let outputPath = path.join(config.publicDir, slug)
  if (outputPath.endsWith("/")) {
    return path.join(outputPath, "index.html")
  }
  if (path.extname(outputPath) === "") {
    return outputPath + ".html"
  }
  return outputPath
}

const computeSlug = ({ _meta }, config) => {
  // remove top level dir (contentDir) and index.[ext]
  let slug = _meta.inputPath.replace(new RegExp(`^${config.contentDir}`), "")
  if (_meta.type !== "static") {
    slug = slug
      .replace(new RegExp(/\/index\.[a-z]+$/), "/")
      .replace(new RegExp(/\/post\.[a-z]+$/), "/")
      .replace(new RegExp(/\.[a-z]+$/), "")
  }
  if (_meta.isDirectory && !slug.endsWith("/")) {
    slug += "/"
  }
  return slug
}

const computeTitle = ({ slug }, config) =>
  config.libs.unslugify(slug, { slash: " | " })

const computePageData = (data, config, pages, options = {}) => {
  let computed = {
    data: null,
    pendingCount: 0,
  }
  if (_.isArray(data)) {
    computed.data = [...data]
  } else {
    computed.data = { ...data }
  }
  if (!options.topLevelData) {
    // for recursive call
    options.topLevelData = data
  }
  for (let key in data) {
    let value = data[key]
    //_.forEach(data, (value, key) => {
    if (typeof key === "string" && key.endsWith("_no_cascade")) {
      // this is an override key, computing original key value
      key = key.split("_no_cascade")[0]
    } else if (
      Object.prototype.hasOwnProperty.call(data, key + "_no_cascade")
    ) {
      // there is a data override attribute, bail out.
      continue
    }
    if (typeof value === "function") {
      // it's a function we need to compute the result
      computed.data[key] = value(options.topLevelData, config, pages)
    } else if (_.isPlainObject(value) || _.isArray(value)) {
      if (value._kissCheckDependencies) {
        // function was wrapped using withDependencies()
        let currentPending = countPendingDependencies(
          options.topLevelData,
          pages,
          value.deps
        )
        if (currentPending == 0) {
          // data can be computed
          computed.data[key] = value.handler(
            options.topLevelData,
            config,
            pages
          )
        } else {
          // data needs other dependencies to be computed first
          computed.pendingCount += currentPending
          computed.data[key] = value
        }
      } else {
        // it's a normal object: we need to see if there is data to compute inside
        let subComputed = computePageData(value, config, pages, options)
        computed.data[key] = subComputed.data
        computed.pendingCount += subComputed.pendingCount
      }
    } else {
      computed.data[key] = value
    }
  }
  return computed
}

const computeAllPagesData = (pages, config) => {
  let computedPages = { ...pages }
  let pendingTotal = 0
  let round = 1
  let computed = {}

  while (round === 1 || pendingTotal > 0) {
    pendingTotal = 0
    _.forEach(computedPages, (page, key) => {
      computed = computePageData(page, config, computedPages)
      computedPages[key] = computed.data
      pendingTotal += computed.pendingCount
    })
    if (pendingTotal > 0 && round + 1 > config.maxComputingRounds) {
      global.logger.error(
        ```- Could not compute all data in ${config.maxComputingRounds} rounds. Check for circular 
dependencies or increase the 'maxComputingRounds' settings```
      )
      break
    }
    if (pendingTotal > 0) {
      global.logger.log(
        `- Round ${round}: ${pendingTotal} data points could not yet be computed. New round.`
      )
    } else {
      global.logger.log(`- Round ${round}: all data points computed.`)
    }
    ++round
  }
  return computedPages
}

// load content derived from existing pages
const computeDataViews = (siteData, config) => {
  config.dataViews.forEach((view) => {
    const { attribute, handler, ...options } = view
    global.logger.info(
      `Computing '${attribute}' data view using '${handler.name}'`
    )
    siteData[attribute] = handler(siteData, options, config)
  })
  return siteData
}

const computeCategoriesDataView = (siteData, options = {}, config) => {
  if (!options.parent) {
    options.parent = config.contentDir
  }
  let categories = []
  _.filter(
    siteData.pages,
    ({ _meta }) => _meta.isDirectory && _meta.parent === options.parent
  ).forEach((page) => {
    categories.push({
      name: config.libs.unslugify(page._meta.basename),
      entry: page,
      count: getDescendantPages(page, siteData.pages, {
        filterBy: (d) => d._meta.type === "post",
      }).length,
      children: computeCategoriesDataView(
        siteData,
        { ...options, parent: page._meta.id },
        config,
        page._meta.id
      ),
    })
  })
  return categories
}

const computeCollectionDataView = ({ pages }, options = {}, config) => {
  let isRootCall = false
  if (!options.parent) {
    // FIXME: not too clean this
    options.parent = config.contentDir
    isRootCall = true
  }
  if (!options.orderBy) {
    options.orderBy = config.defaultCollectionOrderBy
  }
  let collections = _.filter(
    pages,
    ({ _meta }) =>
      _meta.type === "collection" && _meta.parent === options.parent
  ).reduce((collections, page) => {
    if (!page._meta.descendants) {
      return collections
    }
    let key = _.camelCase(page._meta.basename)
    return {
      ...collections,
      [key]: {
        _id: page._meta.id,
        _type: "collection",
        _group: page._meta.collectionGroup,
        allPosts: getDescendantPages(page, pages, {
          filterBy: (p) => p._meta.type === "post",
          orderBy: options.orderBy,
        }),
        ...computeCollectionDataView(
          { pages },
          { ...options, parent: page._meta.id },
          config
        ),
      },
    }
  }, {})
  if (isRootCall) {
    collections.allPosts = getDescendantPages(
      // FIXME: not too clean this
      pages[config.contentDir],
      pages,
      {
        filterBy: (p) => p._meta.type === "post",
        orderBy: options.orderBy,
      }
    )
  }
  return collections
}

const withDependencies = (handler, deps) => {
  return {
    handler,
    deps,
    _kissCheckDependencies: true,
  }
}

const topLevelPageData = {
  site: {
    url: "https://example.com",
    name: "Keep it simple and static demo",
  },
  category: computeCategory,
  description: withDependencies(computeDescription, ["content"]),
  image: withDependencies(computeImage, ["content", "slug"]),
  layout: computeLayout,
  slug: computeSlug,
  title: withDependencies(computeTitle, ["slug"]),
  // populated by baseLoader
  _meta: {
    ascendants: computeAscendants,
    id: "",
    basename: "",
    children: computeChildren,
    descendants: computeDescendants,
    inputPath: "",
    isDirectory: false,
    outputPath: withDependencies(computeOutputPath, ["slug"]),
    parent: null,
    type: null,
  },
}

module.exports = {
  computeAllPagesData,
  computeCategoriesDataView,
  computeCollectionDataView,
  computeDataViews,
  topLevelPageData,
  withDependencies,
}

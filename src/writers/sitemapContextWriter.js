const { formatISO } = require("date-fns")
const { outputFile } = require("fs-extra")
const _ = require("lodash")
const path = require("path")
const xml = require("xml")

// reference documentation: https://www.sitemaps.org/protocol.html

const pageObject = (page, options, config) => {
  let lastMod =
    _.get(page, config.defaults.pageUpdatedAttribute) ||
    _.get(page, config.defaults.pagePublishedAttribute)
  let changeFreq, priority
  if (page.permalink === "/") {
    changeFreq = options.changeFreq.home
    priority = options.priority.home
  } else if (page._meta.isPost) {
    changeFreq = options.changeFreq.post
    priority = options.priority.post
  } else {
    changeFreq = options.changeFreq.collection
    priority = options.priority.collection
  }
  if (lastMod) {
    try {
      lastMod = formatISO(lastMod)
    } catch (err) {
      global.logger.warn(
        `[${this.name}]: cannot format lastmod date '${lastMod}' to ISO for page '${page.permalink}'. Setting null.`
      )
      lastMod = null
    }
  }
  return {
    url: [
      { loc: page.permalink },
      { lastmod: lastMod },
      { changefreq: changeFreq },
      { priority: priority.toFixed(1) },
    ],
  }
}

const sitemapContextWriter = async (context, options, config) => {
  if (!options.target) {
    global.logger.warn(
      `[sitemapContextWriter]: No 'target' passed in options. Skipping write.`
    )
    return
  }
  const pages = _.filter(context.pages, options.pageFilter)
  const sitemapObject = {
    urlset: [
      {
        _attr: {
          xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
        },
      },
      ..._.map(pages, (page) => pageObject(page, options, config)),
    ],
  }
  const sitemapXML = xml(sitemapObject, options.xmlOptions)
  const file = path.join(config.dirs.public, options.target)
  return outputFile(file, sitemapXML)
}

module.exports = sitemapContextWriter

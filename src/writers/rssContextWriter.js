const { formatRFC3339 } = require("date-fns")
const { outputFile } = require("fs-extra")
const _ = require("lodash")
const cheerio = require("cheerio")
const path = require("path")
const xml = require("xml")

const {
  getAbsoluteURL,
  getLocale,
  sortPages,
  isValidURL,
} = require("../helpers")

// Although called RSS, this is really an Atom feed generator
// See https://www.saksoft.com/blog/rss-vs-atom/ for more infos
// Atom summary: https://validator.w3.org/feed/docs/atom.html
// Atom spec: https://tools.ietf.org/html/rfc4287

const getAbsoluteURLContent = (content, baseURL) => {
  // there are more (niche) attributes
  // see https://github.com/posthtml/posthtml-urls/blob/master/lib/defaultOptions.js
  // but the ones below should cover all cases where we actually want absolute URLs in the feed
  const $ = cheerio.load(content, null, false)
  const htmlAttributes = ["href", "src"]
  htmlAttributes.map((attr) => {
    $("[" + attr + "]").each((i, el) => {
      const url = $(el).attr(attr)
      $(el).attr(attr, getAbsoluteURL(url, baseURL))
    })
  })

  // special case for srcset, we need to parse the attribute
  $("[srcset]").each((i, el) => {
    const srcset = $(el).attr("srcset")
    let absoluteSrcset = []
    srcset.split(",").forEach((src) => {
      const [url, width] = src.trim().split(" ", 2)
      let absoluteSrc = getAbsoluteURL(url, baseURL)
      if (width) {
        absoluteSrc += " " + width
      }
      absoluteSrcset.push(absoluteSrc)
    })
    $(el).attr("srcset", absoluteSrcset.join(","))
  })

  return $.root().html()
}

const pageObject = (page, options, config) => {
  let publishedDate = _.get(page, config.defaults.pagePublishedAttribute)
  let updatedDate = _.get(page, config.defaults.pageUpdatedAttribute)

  if (publishedDate) {
    try {
      publishedDate = formatRFC3339(publishedDate)
    } catch (err) {
      global.logger.warn(
        `[rssContextWriter]: cannot format published date '${publishedDate}' to RFC3339 for page '${page.permalink}': ${err}.`,
      )
      publishedDate = null
    }
  }

  if (updatedDate) {
    try {
      updatedDate = formatRFC3339(updatedDate)
    } catch (err) {
      global.logger.warn(
        `[rssContextWriter]: cannot format updated date '${updatedDate}' to RFC3339 for page '${page.permalink}': ${err}.`,
      )
      updatedDate = null
    }
  }

  let entry = [
    { title: page.title },
    { link: { _attr: { rel: "alternate", href: page.url } } },
    { id: page.url },
    { summary: [{ _attr: { type: "text" } }, page.description] },
  ]

  if (publishedDate) {
    entry.push({ published: publishedDate })
  }

  if (updatedDate) {
    entry.push({ updated: updatedDate })
  }

  if (page.author) {
    let author = []
    if (typeof page.author === "object") {
      if (page.author.name) {
        author.push({ name: page.author.name })
      }
      if (page.author.email) {
        author.push({ email: page.author.email })
      }
      if (page.author.uri) {
        author.push({ uri: page.author.uri })
      }
    } else {
      author.push({ name: page.author })
    }
    entry.push({ author: author })
  }

  // optional category
  if (page.category) {
    entry.push({
      category: {
        _attr: {
          term: page.category,
          label: config.libs.unslugify(page.category),
        },
      },
    })
  }

  if (page.content) {
    let content
    if (isValidURL(page.url)) {
      content = getAbsoluteURLContent(page.content, page.url)
    } else {
      global.logger.warn(
        `[rssContextWriter]: url '${page.url}' from page '${page._meta.id}' is not valid. Cannot create absolute links for this page.`,
      )
      content = page.content
    }
    entry.push({
      content: [{ _attr: { type: "html" } }, content],
    })
  }
  return { entry: entry }
}

const rssContextWriter = async (context, options, config) => {
  if (!options.target) {
    global.logger.warn(
      `[rssContextWriter]: No 'target' passed in options. Skipping write.`,
    )
    return
  }
  const feedURL = new URL(options.target, context.site.url)
  let updatedDate = context.site.lastUpdated
  if (updatedDate) {
    try {
      updatedDate = formatRFC3339(updatedDate)
    } catch (err) {
      global.logger.warn(
        `[${this.name}]: cannot format feed updated date '${updatedDate}' to RFC3339: ${err}.`,
      )
      updatedDate = null
    }
  }
  let feedObject = [
    {
      _attr: {
        xmlns: "http://www.w3.org/2005/Atom",
        "xml:lang": getLocale(context),
      },
    },
    { generator: "kiss RSS plugin" },
    { id: context.site.url },
    { title: context.site.title },
    { updated: updatedDate },
    {
      link: {
        _attr: { rel: "self", type: "application/atom+xml", href: feedURL },
      },
    },
    {
      link: {
        _attr: {
          rel: "alternate",
          type: "text/html",
          href: context.site.url,
        },
      },
    },
  ]
  // optional description
  if (context.site.description) {
    feedObject.push({ subtitle: context.site.description })
  }
  // optional category
  if (context.site.category) {
    feedObject.push({ category: context.site.category })
  }
  // page entries
  const pageObjects = _.map(
    sortPages(
      _.filter(context.pages, options.pageFilter),
      config.defaults.sortCollectionBy,
    ),
    (page) => pageObject(page, options, config),
  )
  feedObject = feedObject.concat(pageObjects)
  const feedXML = xml({ feed: feedObject }, options.xmlOptions)
  const file = path.join(config.dirs.public, options.target)
  return outputFile(file, feedXML)
}

module.exports = rssContextWriter

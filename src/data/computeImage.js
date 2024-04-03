const cheerio = require("cheerio")
const { getPageFromSource } = require("../helpers")

const computeImage = (
  page,
  config,
  { pages, site },
  { setDefaultImage = true } = {},
) => {
  if (typeof page.cover === "string") {
    // there is a manually set cover image
    return getImagePermalink(
      page.cover,
      page,
      pages,
      config,
      setDefaultImage,
      site.image,
    )
  }
  // needed as computeImage is called recursively
  if (typeof page.image === "string") {
    return getImagePermalink(
      page.image,
      page,
      pages,
      config,
      setDefaultImage,
      site.image,
    )
  }
  if (!page.content) {
    // Search in descendants
    if (!page._meta.descendants || page._meta.descendants.length === 0) {
      return setDefaultImage ? site.image : null
    }
    // return the first image it finds
    for (const id of page._meta.descendants) {
      const descendant = pages[id]
      let image = computeImage(
        descendant,
        config,
        { pages, site },
        { setDefaultImage: false },
      )
      if (image) {
        // found an image in descendants: break for loop
        // no need to call getImagePermalink() here, it would have been called in recursive call
        return image
      }
    }
    // no result anywhere
    return setDefaultImage ? site.image : null
  }
  // searches for an img tag in content
  const $ = cheerio.load(page.content)
  const src = $("img").first().attr("src")
  return getImagePermalink(
    src,
    page,
    pages,
    config,
    setDefaultImage,
    site.image,
  )
}

computeImage.kissDependencies = ["content", "permalink", "_meta.descendants"]

module.exports = computeImage

/** private */

const getImagePermalink = (
  src,
  page,
  pages,
  config,
  setDefaultImage,
  defaultImage,
) => {
  if (!src) {
    return setDefaultImage ? defaultImage : null
  }
  if (
    src.startsWith("http") ||
    src.startsWith("//") ||
    src.startsWith("data:") ||
    src.startsWith("@")
  ) {
    // external image, data URI or @attribute that will be resolved later
    return src
  }
  const pageFound = getPageFromSource(src, page, pages, config)
  if (!pageFound) {
    // something went wrong
    return src
  }
  return pageFound.permalink
}

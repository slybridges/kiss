const cheerio = require("cheerio")
const { getAbsolutePath } = require("../helpers")

const computeImage = (
  page,
  config,
  { pages, site },
  { setDefaultImage = true } = {}
) => {
  // needed as computeImage is called recursively
  if (typeof page.image === "string") {
    return getImagePermalink(
      page.image,
      page.permalink,
      setDefaultImage,
      site.image
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
        { setDefaultImage: false }
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
  return getImagePermalink(src, page.permalink, setDefaultImage, site.image)
}

computeImage.kissDependencies = ["content", "permalink", "_meta.descendants"]

module.exports = computeImage

/** private */

const getImagePermalink = (
  src,
  pagePermalink,
  setDefaultImage,
  defaultImage
) => {
  if (!src) {
    return setDefaultImage ? defaultImage : null
  }
  return getAbsolutePath(src, pagePermalink, { throwIfInvalid: true })
}

const cheerio = require("cheerio")
const path = require("path")
const { isValidURL } = require("../helpers")

const computeImage = (
  page,
  config,
  { pages, site },
  { setDefaultImage = true } = {}
) => {
  if (typeof page.image === "string") {
    // needed as computeImage is called recursively
    return page.image
  }
  if (!page.content) {
    // check if there are descendants
    if (!page._meta.descendants || page._meta.descendants.length === 0) {
      return setDefaultImage ? site.image : null
    }
    // return the first image it finds
    let id = page._meta.descendants.find((id) =>
      computeImage(
        pages[id],
        config,
        { pages, site },
        { setDefaultImage: false }
      )
    )
    if (id) {
      return computeImage(
        pages[id],
        config,
        { pages, site },
        { setDefaultImage: false }
      )
    }
    return setDefaultImage ? site.image : null
  }
  // searches for an img tag in content
  const $ = cheerio.load(page.content)
  const src = $("img").first().attr("src")
  if (!src) {
    return setDefaultImage ? site.image : null
  }
  if (isValidURL(src)) {
    return src
  }
  // return the image, as an absolute path
  return path.isAbsolute(src) ? src : path.join(page.permalink, src)
}

computeImage.kissDependencies = ["content", "permalink", "_meta.descendants"]

module.exports = computeImage

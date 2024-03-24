const sharp = require("sharp")
const path = require("path")
const { ensureDir, pathExists } = require("fs-extra")

const staticWriter = require("./staticWriter")

const imageWriter = async (page, options) => {
  // load
  let sourceImage = sharp(page._meta.inputPath)
  if (!page.derivatives) {
    // no derivatives, simply copy the image
    return staticWriter(page)
  }
  // process derivatives
  return Promise.all(
    page.derivatives.map(async (derivative) => {
      let image = sourceImage.clone()
      if (!options.overwrite) {
        if (await pathExists(derivative.outputPath)) {
          return
        }
      }
      await ensureDir(path.dirname(derivative.outputPath))
      // resize
      if (derivative.resize) {
        image = image.resize(derivative.resize)
      }
      // convert
      image = image[derivative.format](derivative.formatOptions)
      // save to file
      return image.toFile(derivative.outputPath)
    }),
  )
}

module.exports = imageWriter

const _ = require("lodash")
const cheerio = require("cheerio")
const path = require("path")
const sharp = require("sharp")

const { getAbsolutePath, isValidURL } = require("../helpers")

const META_SELECTORS = [
  "meta[property='og:image']",
  "meta[property='og:image:secure_url']",
  "meta[property='twitter:image']",
]

const imageContextTransform = async (context, options, config) => {
  for (let [id, page] of Object.entries(context.pages)) {
    if (!page._html || !page.permalink) {
      continue
    }
    const $ = cheerio.load(page._html)
    // images in <img> tag
    let imagesPromises = $("img").map(async (i, img) => {
      let src = decodeURI($(img).attr("src"))
      if (!img.attribs.alt) {
        global.logger.warn(
          `Image '${src}' on page '${page._meta.outputPath}' has no 'alt' attribute.`
        )
      }
      let imgPath = getAbsolutePath(src, page.permalink, {
        throwIfInvalid: true,
      })
      const imageDetails = await getImageDetails(imgPath, id, context, config)
      context.pages[imgPath] = imageDetails
      if (!imageDetails._meta.is404) {
        $(img).replaceWith(getImageTag($(img).clone(), imageDetails))
        context.pages[id]._html = $.html()
      }
    })

    // <meta> selectors
    let metaPromises = META_SELECTORS.map(async (selector) => {
      const content = $(selector).attr("content")
      if (!content) {
        return
      }
      if (!isValidURL(content)) {
        global.logger.warn(
          `Image URL '${content}' in meta ${selector} on page '${page._meta.outputPath}' is not a valid URL.`
        )
        return
      }
      const url = new URL(content)
      const imgPath = decodeURI(url.pathname)
      const imageDetails = await getImageDetails(imgPath, id, context, config)
      context.pages[imgPath] = imageDetails
      if (!imageDetails._meta.is404) {
        const newPathname = getDefaultDerivative(imageDetails).permalink
        $(selector).attr("content", new URL(newPathname, url.origin))
        context.pages[id]._html = $.html()
      }
    })

    await Promise.all([...imagesPromises, ...metaPromises])
  }
  return context
}

module.exports = imageContextTransform

/** Private **/

const getBase64LowResData = async (sharpImage, config) => {
  const resizeOptions = config.image.resizeOptions || {}
  const buffer = await sharpImage
    .resize({ ...resizeOptions, width: config.image.blurWidth || 32 })
    .blur()
    .toBuffer()
  return `data:image/png;base64,${buffer.toString("base64")}`
}

const getDefaultDerivative = (page) => {
  const { defaultFormat, defaultWidth, derivatives } = page
  if (!defaultFormat) {
    throw new Error(
      `[getDefaultDerivative] page '${page._meta.id}' does not have a 'defaultFormat'.`
    )
  }
  if (!defaultWidth) {
    throw new Error(
      `[getDefaultDerivative] page '${page._meta.id}' does not have a 'defaultWidth'.`
    )
  }
  if (!derivatives.length === 0) {
    throw new Error(
      `[getDefaultDerivative] page '${page._meta.id}' does not have any derivative.`
    )
  }
  const derivative = derivatives.find(
    (d) => d.format === defaultFormat && d.width === defaultWidth
  )
  return derivative ? derivative : derivatives[derivatives.length - 1]
}

const getDerivatives = (page, config) => {
  let derivatives = []
  for (const format of config.image.formats) {
    const resizeOptions = config.image.resizeOptions || {}
    for (const width of config.image.widths) {
      const filename = config.image.filename(page._meta.name, format, width)
      const permalink = path.join(page.permalinkDir, filename)
      let derivative = {
        format,
        formatOptions: config.image[format + "Options"] || {},
        outputPath: path.join(config.dirs.public, permalink),
        permalink,
        width,
      }
      if (width === "original") {
        derivative.resize = false
      } else if (typeof width === "number") {
        if (width > page._meta.width) {
          continue
        }
        derivative.resize = {
          width: width,
          ...resizeOptions,
        }
      } else {
        throw new Error(
          `[getDerivatives] Unknown 'width' option. Expected a number or 'original', got '${width}'.`
        )
      }
      derivatives.push(derivative)
    }
  }
  return derivatives
}

const getImageDetails = async (imgPath, sourceId, context, config) => {
  const blur = config.image.blur || false
  let details = {}
  if (!context.pages[imgPath]) {
    global.logger.log(`- image found: '${imgPath}'`)
    details = {
      blur,
      defaultWidth: config.image.defaultWidth || config.image.widths[0],
      defaultFormat: config.image.defaultFormat || config.image.formats[0],
      derivatives: [],
      formats: config.image.formats,
      permalink: imgPath, // original permalink
      permalinkDir: path.dirname(imgPath),
      sizes: config.image.sizes || [],
      sources: [],
      _meta: await getImageMetadata(imgPath, blur, config),
    }
    if (!details._meta.is404) {
      details.derivatives = getDerivatives(details, config)
    }
  } else {
    details = context.pages[imgPath]
  }
  details.sources.push(sourceId)
  return details
}

const getImageTag = (imgNode, page) => {
  const $ = cheerio.load("")
  const srcset = getSrcset(page.derivatives, "jpeg")
  const attrPrefix = page.blur ? "data-" : ""
  if (page.blur) {
    $(imgNode).addClass("lazy")
    $(imgNode).attr("src", page._meta.lowResImage)
  }
  $(imgNode).attr(attrPrefix + "src", getDefaultDerivative(page).permalink)
  $(imgNode).attr(attrPrefix + "srcset", srcset)
  $(imgNode).attr(attrPrefix + "sizes", getSizes(page.sizes))
  if (_.isEqual(page.formats, ["jpeg"])) {
    return imgNode
  }
  // more than just the jpeg format: wrap in <picture>/picture>
  const picture = $("<picture></picture>")
  for (const format of page.formats.filter((f) => f !== "jpeg")) {
    const source = $("<source/>")
    $(source).attr(attrPrefix + "sizes", getSizes(page.sizes))
    $(source).attr(attrPrefix + "srcset", getSrcset(page.derivatives, format))
    $(source).attr("type", "image/" + format)
    $(picture).append(source)
  }
  $(picture).append(imgNode)
  return picture
}

const getImageMetadata = async (imgPath, blur, config) => {
  const { ext, name } = path.parse(imgPath)
  const srcPath = path.join(config.dirs.content, imgPath)
  const outputPath = path.join(config.dirs.public, imgPath)
  let meta = {
    basename: name + ext,
    ext,
    id: imgPath,
    inputPath: srcPath,
    isURL: isValidURL(imgPath),
    name,
    outputPath, // output path of original file
    outputType: "IMAGE",
  }
  try {
    const image = sharp(srcPath)
    const { format, width, height } = await image.metadata()
    meta = {
      ...meta,
      format,
      height,
      width,
    }
    if (blur) {
      meta.lowResImage = await getBase64LowResData(image, config)
    }
  } catch (err) {
    global.logger.error(
      `[getImageMetadata] Error getting image metadata for ${srcPath}\n`,
      err.stack
    )
    meta.is404 = true
  }
  return meta
}

const getSizes = (sizes) => sizes.join(", ")

const getSrcset = (derivatives, format) =>
  derivatives
    .filter((d) => d.format === format)
    .map((src) => {
      const url = src.permalink
      const width = _.get(src, "resize.width")
      return width ? url + " " + width + "w" : url
    })
    .join(", ")

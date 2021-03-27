const _ = require("lodash")
const cheerio = require("cheerio")
const path = require("path")
const sharp = require("sharp")

const { getAbsolutePath, isValidURL } = require("../helpers")

const imageContextTransform = async (context, options, config) => {
  if (!options.namespace) {
    options.namespace = "images"
  }

  for (let [id, page] of Object.entries(context.pages)) {
    if (!page._html || !page.permalink) {
      continue
    }
    const $ = cheerio.load(page._html)
    await Promise.all(
      $("img").map(async (i, img) => {
        let src = decodeURI($(img).attr("src"))
        if (!img.attribs.alt) {
          global.logger.warn(
            `Image '${src}' on page '${page._meta.outputPath}' as no 'alt' attribute.`
          )
        }
        let imgPath = getAbsolutePath(src, page.permalink, {
          throwIfInvalid: true,
        })
        if (!context.pages[imgPath]) {
          global.logger.log(`- image found: '${imgPath}'`)
          const blur = config.image.blur || false
          context.pages[imgPath] = {
            blur,
            defaultWidth: config.image.defaultWidth || config.image.widths[0],
            defaultFormat:
              config.image.defaultFormat || config.image.formats[0],
            derivatives: [],
            formats: config.image.formats,
            permalink: imgPath, // original permalink
            permalinkDir: path.dirname(imgPath),
            sizes: config.image.sizes || [],
            sources: [],
            _meta: await getImageMetadata(imgPath, blur, config),
          }
          if (!context.pages[imgPath]._meta.is404) {
            context.pages[imgPath].derivatives = getDerivatives(
              context.pages[imgPath],
              config
            )
          }
        }
        context.pages[imgPath].sources.push(id)
        if (!context.pages[imgPath]._meta.is404) {
          $(img).replaceWith(
            getImageTag($(img).clone(), context.pages[imgPath])
          )
          context.pages[id]._html = $.html()
        }
      })
    )
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

const getImageTag = (imgNode, page) => {
  const $ = cheerio.load("")
  const srcset = getSrcset(page.derivatives, "jpeg")
  if (page.blur) {
    $(imgNode).addClass("lazy")
    $(imgNode).attr("src", page._meta.lowResImage)
    $(imgNode).attr("data-sizes", getSizes(page.sizes))
    $(imgNode).attr("data-src", getSrc(page.derivatives, page.defaultWidth))
    $(imgNode).attr("data-srcset", srcset)
  } else {
    $(imgNode).attr("sizes", getSizes(page.sizes))
    $(imgNode).attr("src", getSrc(page.derivatives, page.defaultWidth))
    $(imgNode).attr("srcset", srcset)
  }
  if (_.isEqual(page.formats, ["jpeg"])) {
    return imgNode
  }
  // more than just the jpeg format: wrap in <picture>/picture>
  const picture = $("<picture></picture>")
  for (const format of page.formats.filter((f) => f !== "jpeg")) {
    const source = $("<source/>")
    $(source).attr("data-sizes", getSizes(page.sizes))
    $(source).attr("data-srcset", getSrcset(page.derivatives, format))
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
      `[getImageMetadata] Error getting image metadata for ${imgPath}\n`,
      err.stack
    )
    meta.is404 = true
  }
  return meta
}

const getSizes = (sizes) => sizes.join(", ")

const getSrc = (derivatives, defaultWidth, defaultFormat) =>
  derivatives.find(
    (d) => d.format === defaultFormat && d.width === defaultWidth
  )

const getSrcset = (derivatives, format) =>
  derivatives
    .filter((d) => d.format === format)
    .map((src) => {
      const url = src.permalink
      const width = _.get(src, "resize.width")
      return width ? url + " " + width + "w" : url
    })
    .join(", ")

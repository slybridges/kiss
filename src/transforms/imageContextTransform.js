const _ = require("lodash")
const cheerio = require("cheerio")
const path = require("path")
const sharp = require("sharp")

const { getBuildEntries, getPageFromSource, isValidURL } = require("../helpers")

const META_SELECTORS = [
  "meta[property='og:image']",
  "meta[property='og:image:secure_url']",
  "meta[property='twitter:image']",
]

const imageContextTransform = async (context, options, config, buildFlags) => {
  const entries = getBuildEntries(context, buildFlags)

  // Three-phase approach to optimiza perfs while minimizing memory usage

  // Track unique images without storing heavy objects
  const uniqueImageIds = new Set()
  const imageReferences = []

  // Cache lookups to avoid repeated O(n) searches
  // Maps pageId:src to imgId (or null for not found)
  // This prevents redundant getPageFromSource calls for repeated images
  const seenSources = new Map()

  // Phase 1: Discovery - collect image IDs and references only
  // We don't process images yet, just identify what needs processing
  for (let [id, page] of entries) {
    if (!page._html || !page.permalink) {
      continue
    }

    const $ = cheerio.load(page._html)

    // Process images found
    $("img").each((i, img) => {
      const src = $(img).attr("src") || ""
      const decodedSrc = decodeURI(src)

      if (!src || isValidURL(decodedSrc)) {
        global.logger.log(
          `- [imageContextTransform] Page '${id}': image '${decodedSrc}' is a URL. Skipping.`,
        )
        return
      }

      if (!img.attribs.alt) {
        global.logger.warn(
          `Page '${id}': image '${decodedSrc}' has no 'alt' attribute.`,
        )
      }

      // Check if we've already processed this src for this page
      const sourceKey = `${id}:${src}`
      if (seenSources.has(sourceKey)) {
        const cachedImgId = seenSources.get(sourceKey)
        if (cachedImgId) {
          imageReferences.push({
            type: "img",
            pageId: id,
            imgId: cachedImgId,
            index: i,
          })
        }
        return
      }

      // else image not in cache, save

      if (!img.attribs.alt) {
        global.logger.warn(
          `Page '${id}': image '${src}' has no 'alt' attribute.`,
        )
      }
      const imgPage = getPageFromSource(
        decodedSrc,
        page,
        context.pages,
        config,
        { indexes: context._pageIndexes },
      )

      if (!imgPage?._meta?.id) {
        seenSources.set(sourceKey, null) // Cache negative result
        return
      }

      if (imgPage._meta.outputType !== "IMAGE") {
        // image is handled by another loader. skipping.
        global.logger.log(
          `- [imageContextTransform] Page '${id}': image '${decodedSrc}' is handled by another loader. Skipping.`,
        )
        seenSources.set(sourceKey, null) // Cache negative result
        return
      }

      const imgId = imgPage._meta.id
      seenSources.set(sourceKey, imgId) // Cache positive result
      uniqueImageIds.add(imgId)
      imageReferences.push({
        type: "img",
        pageId: id,
        imgId: imgId,
        index: i,
      })
    })

    // Process meta tags
    META_SELECTORS.forEach((selector, selectorIndex) => {
      const content = $(selector).attr("content")
      if (!content) {
        // No tag or empty content. Skipping.
        return
      }

      if (!isValidURL(content)) {
        global.logger.warn(
          `Page '${id}' in meta '${selector}': image URL '${content}' is not a valid URL.`,
        )
        seenSources.set(sourceKey, null) // Cache negative result
        return
      }

      // Check if we've already processed this URL for this page
      const sourceKey = `${id}:meta:${content}`
      if (seenSources.has(sourceKey)) {
        const cachedImgId = seenSources.get(sourceKey)
        if (cachedImgId) {
          imageReferences.push({
            type: "meta",
            pageId: id,
            imgId: cachedImgId,
            selectorIndex,
          })
        }
        return
      }

      // else image not in cache, save it
      const url = new URL(content)
      const imgPage = getPageFromSource(
        url.pathname,
        page,
        context.pages,
        config,
        { indexes: context._pageIndexes },
      )

      if (!imgPage) {
        seenSources.set(sourceKey, null) // Cache negative result
        return
      }

      if (imgPage._meta.outputType !== "IMAGE") {
        // image is handled by another loader. skipping.
        global.logger.log(
          `- [imageContextTransform] Page '${id}': image '${url.pathname}' is handled by another loader. Skipping.`,
        )
        seenSources.set(sourceKey, null) // Cache negative result
        return
      }

      const imgId = imgPage._meta.id
      seenSources.set(sourceKey, imgId) // Cache positive result
      uniqueImageIds.add(imgId)
      imageReferences.push({
        type: "meta",
        pageId: id,
        imgId: imgId,
        selectorIndex,
      })
    })

    // Clear the DOM immediately to free memory
    $.root().empty()
  }

  // Phase 2: Process unique images in small batches
  // Process only a few images at a time to avoid heap exhaustion
  // Sharp image processing is memory-intensive, especially for large images
  const BATCH_SIZE = 20
  const imageIds = Array.from(uniqueImageIds)

  for (let i = 0; i < imageIds.length; i += BATCH_SIZE) {
    const batch = imageIds.slice(i, i + BATCH_SIZE)

    // Process inage batch in parallel
    await Promise.all(
      batch.map(async (imgId) => {
        const imgPage = context.pages[imgId]
        if (!imgPage || imgPage.formats) {
          return // Already processed
        }

        try {
          const imageDetails = await getImageDetails(imgPage, options, config)
          // Update context immediately
          context.pages[imgId] = imageDetails
        } catch (err) {
          global.logger.error(`Error processing image ${imgId}: ${err.message}`)
        }
      }),
    )
  }

  // Phase 3: Update pages - process one at a time to minimize memory usage

  // Group references by page
  const pageGroups = {}
  for (const ref of imageReferences) {
    if (!pageGroups[ref.pageId]) {
      pageGroups[ref.pageId] = []
    }
    pageGroups[ref.pageId].push(ref)
  }

  // Process pages one at a time to control memory
  for (const [pageId, refs] of Object.entries(pageGroups)) {
    const page = context.pages[pageId]
    if (!page || !page._html) continue

    const $ = cheerio.load(page._html)

    let modified = false

    // Group refs by type for efficient processing
    const imgRefs = refs.filter((r) => r.type === "img")
    const metaRefs = refs.filter((r) => r.type === "meta")

    // Update img tags
    if (imgRefs.length > 0) {
      const imgElements = $("img").toArray()
      for (const ref of imgRefs) {
        const img = imgElements[ref.index]

        if (!img) {
          continue
        }

        const imageDetails = context.pages[ref.imgId]
        if (!imageDetails || imageDetails._meta.is404) {
          // Image not found or invalid, skip
          continue
        }

        // Update sources tracking
        if (!imageDetails.sources) {
          imageDetails.sources = []
        }
        if (imageDetails.sources.indexOf(pageId) === -1) {
          imageDetails.sources.push(pageId)
        }

        const newElement = getImageTag($(img).clone(), imageDetails, options)
        $(img).replaceWith(newElement)
        modified = true
      }
    }

    // Update meta tags
    if (metaRefs.length > 0) {
      for (const ref of metaRefs) {
        const selector = META_SELECTORS[ref.selectorIndex]
        const imageDetails = context.pages[ref.imgId]
        if (!imageDetails || imageDetails._meta.is404) continue

        // Update sources tracking
        if (!imageDetails.sources) imageDetails.sources = []
        if (imageDetails.sources.indexOf(pageId) === -1) {
          imageDetails.sources.push(pageId)
        }

        const content = $(selector).attr("content")
        if (content) {
          const derivative = getDefaultDerivative(imageDetails)
          const url = new URL(content)
          $(selector).attr("content", new URL(derivative.permalink, url.origin))
          modified = true
        }
      }
    }

    if (modified) {
      context.pages[pageId]._html = $.html()
    }

    // Clear the DOM to free memory
    $.root().empty()
  }

  return context
}

module.exports = imageContextTransform

/** Private **/

const getBase64LowResData = async (sharpImage, options) => {
  const resizeOptions = options.resizeOptions || {}
  const buffer = await sharpImage
    .resize({ ...resizeOptions, width: options.blurWidth })
    .blur()
    .toBuffer()
  return `data:image/png;base64,${buffer.toString("base64")}`
}

const getDefaultDerivative = (page) => {
  const { defaultFormat, defaultWidth, derivatives } = page
  if (!defaultFormat) {
    throw new Error(
      `[getDefaultDerivative] page '${page._meta.id}' does not have a 'defaultFormat'.`,
    )
  }
  if (!defaultWidth) {
    throw new Error(
      `[getDefaultDerivative] page '${page._meta.id}' does not have a 'defaultWidth'.`,
    )
  }
  if (!derivatives || derivatives.length === 0) {
    throw new Error(
      `[getDefaultDerivative] page '${page._meta.id}' does not have any derivative.`,
    )
  }
  const derivative = derivatives.find(
    (d) =>
      d.width === defaultWidth &&
      (defaultFormat === "original"
        ? d.isOriginalFormat
        : d.format === defaultFormat),
  )
  return derivative ? derivative : derivatives[derivatives.length - 1]
}

const getDerivatives = (imgPage, options, config) => {
  let derivatives = []
  for (let format of options.formats) {
    if (format === "original") {
      // keep the original format
      format = imgPage._meta.format
      if (["jpg", "jpe"].includes(format)) {
        // sharp only understands 'jpeg'
        format = "jpeg"
      }
    }
    const resizeOptions = options.resizeOptions || {}
    for (const width of options.widths) {
      const filename = options.filename(imgPage._meta.name, format, width)
      const permalink = path.join(imgPage.permalinkDir, filename)
      let derivative = {
        format,
        formatOptions: options[format + "Options"] || {},
        isOriginalFormat: format === imgPage._meta.format,
        outputPath: path.join(config.dirs.public, permalink),
        permalink,
        width,
      }
      if (width === "original") {
        derivative.resize = false
      } else if (typeof width === "number") {
        if (width > imgPage._meta.width) {
          // skip resizing if the image is smaller than the requested width
          continue
        }
        derivative.resize = {
          width: width,
          ...resizeOptions,
        }
      } else {
        throw new Error(
          `[getDerivatives] Unknown 'width' option. Expected a number or 'original', got '${width}'.`,
        )
      }
      derivatives.push(derivative)
    }
  }
  return derivatives
}

/**
 * Gather all details for an image page, including derivatives and metadata asynchronously.
 */
const getImageDetails = async (imgPage, options, config) => {
  const permalink = imgPage.permalink

  const imageDetails = {
    ...imgPage,
    blur: options.blur,
    defaultWidth: options.defaultWidth || options.widths[0],
    defaultFormat: options.defaultFormat || options.formats[0],
    derivatives: [],
    formats: options.formats,
    permalink,
    permalinkDir: path.dirname(permalink),
    sizes: options.sizes || [],
    sources: [],
    _meta: await getImageMetadata(imgPage._meta, permalink, options),
  }

  if (!imageDetails._meta.is404) {
    imageDetails.derivatives = getDerivatives(imageDetails, options, config)
  }

  return imageDetails
}

const getImageTag = (imgNode, page, options) => {
  const defaultFormat = options.defaultFormat || options.formats[0]
  const $ = cheerio.load("")
  const srcset = getSrcset(page.derivatives, defaultFormat)
  const attrPrefix = page.blur ? "data-" : ""
  if (page.blur) {
    $(imgNode).addClass("lazy")
    $(imgNode).attr("src", page._meta.lowResImage)
  }
  $(imgNode).attr(attrPrefix + "src", getDefaultDerivative(page).permalink)
  $(imgNode).attr(attrPrefix + "srcset", srcset)
  $(imgNode).attr(attrPrefix + "sizes", getSizes(page.sizes))
  if (page.formats.length === 1) {
    // only one format: return the image node
    return imgNode
  }
  // more than just one format: wrap in <picture>/picture>
  const picture = $("<picture></picture>")
  for (const format of page.formats.filter((f) => f !== defaultFormat)) {
    const source = $("<source/>")
    $(source).attr(attrPrefix + "sizes", getSizes(page.sizes))
    $(source).attr(attrPrefix + "srcset", getSrcset(page.derivatives, format))
    $(source).attr("type", "image/" + format)
    $(picture).append(source)
  }
  $(picture).append(imgNode)
  return picture
}

const getImageMetadata = async (meta, permalink, options) => {
  const { ext, name } = path.parse(meta.inputPath)
  meta = {
    ...meta,
    ext,
    isURL: isValidURL(permalink),
    name,
  }
  try {
    const image = sharp(meta.inputPath)
    const { format, width, height } = await image.metadata()
    meta = {
      ...meta,
      format,
      height,
      width,
    }
    if (options.blur) {
      meta.lowResImage = await getBase64LowResData(image, options)
    }
  } catch (err) {
    global.logger.error(
      `[getImageMetadata] Error getting image metadata for ${meta.inputPath}: ${err.message}`,
    )
    meta.is404 = true
  }
  return meta
}

const getSizes = (sizes) => sizes.join(", ")

const getSrcset = (derivatives, format) =>
  derivatives
    .filter((d) =>
      format === "original" ? d.isOriginalFormat : d.format === format,
    )
    .map((src) => {
      const url = src.permalink
      const width = _.get(src, "resize.width")
      return width ? url + " " + width + "w" : url
    })
    .join(", ")

const { AT_GENERIC_ATTRIBUTE_REGEX, isValidURL } = require("../helpers")

const atAttributesContentTransform = (page, options, config, context) => {
  let errorCount = 0
  page = { ...page }
  // we need to go though all the keys in the page
  // (that may be expesive, but yolo)
  for (const objKey in page) {
    if (typeof page[objKey] === "string" || typeof page[objKey] === "object") {
      let { objValue, errorCount: objErrorCount } =
        transformAtAttributesinObjValue(
          objKey,
          page[objKey],
          page,
          config,
          context,
        )
      page[objKey] = objValue
      errorCount += objErrorCount
    }
  }

  if (errorCount > 0) {
    throw new Error(
      `Page '${page.permalink}': ${errorCount} errors found tranforming @attributes`,
    )
  }

  return page
}

module.exports = atAttributesContentTransform

/** Private */

const transformAtAttributesinObjValue = (
  objKey,
  objValue,
  page,
  config,
  context,
) => {
  let pageFound = null
  let errorCount = 0
  let match
  if (typeof objValue === "object") {
    // we need to go though all the keys in the object
    for (const key in objValue) {
      if (typeof objValue[key] === "string") {
        let { objValue: newValue, errorCount: newErrorCount } =
          transformAtAttributesinObjValue(key, objValue[key], page, context)
        objValue[key] = newValue
        errorCount += newErrorCount
      }
    }
    return { objValue, errorCount }
  }
  // we have a string
  while ((match = AT_GENERIC_ATTRIBUTE_REGEX.exec(objValue))) {
    let [fullMatch, attribute, value] = match
    switch (attribute) {
      case "permalink":
        // Replace the fullMach with the permalink even if there are errors down the line
        objValue = objValue.replaceAll(fullMatch, value)
        if (isValidURL(value)) {
          global.logger.warn(
            `Key '${objKey}' in page '${page.permalink}': @permalink '${value}' is a URL. Skipping.`,
          )
          continue
        }
        // check if we have a page with this permalink
        pageFound = Object.values(context.pages).find(
          (page) => page.permalink === value,
        )
        if (pageFound) {
          // found the corresponding page
        } else {
          // we have an error
          global.logger.error(
            `Key '${objKey}' in page '${page.permalink}': no page found with @permalink '${value}'`,
          )
          errorCount++
        }
        break
      case "file":
        // At this stage, we know we have the full path already
        // it was computed during file loading
        // Search if a have a page with that inputPath
        pageFound = findPageByFilepath(value, page, config, context)
        if (pageFound) {
          // found the corresponding page: replace all occurences with permalink
          objValue = objValue.replaceAll(fullMatch, pageFound.permalink)
        } else {
          // something's wrong
          // remove the @file attribute in case the file is found magically later
          objValue = objValue.replaceAll(fullMatch, value)
          errorCount++
        }
        break
      default:
        global.logger.error(
          `Key '${objKey}' in page '${page.permalink}': unknown @attribute '${attribute}'`,
        )
        errorCount++
    }
  }
  return { objValue, errorCount }
}

const findPageByFilepath = (filepath, page, config, context) => {
  const pageFound = Object.values(context.pages).find(
    (page) => page._meta.inputPath === filepath,
  )
  if (pageFound) {
    return pageFound
  }
  global.logger.error(
    `Page '${page.permalink}': no page found for @file '${filepath}' in ${filepath}`,
  )
}

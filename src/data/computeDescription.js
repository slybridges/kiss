const _ = require("lodash")
const cheerio = require("cheerio")

const computeDescription = ({ content }, config) => {
  const truncateLength = config.defaults.descriptionLength || 160
  if (!content) {
    return ""
  }
  const $ = cheerio.load(content)
  // Remove all newlines and replace multiple spaces with a single space
  const textWithoutNewlines = $.text().replace(/\s+/g, " ").trim()
  return _.truncate(textWithoutNewlines, {
    length: truncateLength,
    separator: " ",
  })
}

computeDescription.kissDependencies = ["content"]

module.exports = computeDescription

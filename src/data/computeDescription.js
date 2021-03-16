const _ = require("lodash")
const cheerio = require("cheerio")

const computeDescription = ({ content }) => {
  if (!content) {
    return ""
  }
  const $ = cheerio.load(content)
  // Meta descriptions can be any length, but Google generally truncates snippets to ~155–160 characters.
  // https://moz.com/learn/seo/meta-description
  return _.truncate($.text(), { length: 160, separator: " " })
}

computeDescription.kissDependencies = ["content"]

module.exports = computeDescription

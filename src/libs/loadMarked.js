const { marked } = require("marked")

const loadMarked = (_, config) => {
  config.libs.marked = marked
  return config
}

module.exports = loadMarked

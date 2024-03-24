const {
  parseISO,
  format: _formatDate,
  formatISO: _formatDateISO,
} = require("date-fns")
const locales = require("date-fns/locale")

const allFilters = (_, config) => {
  if (!config.libs.nunjucks) {
    global.logger.error(
      "[nunjucksFilters.all]: can't load filters, nunjucks lib isn't loaded.",
    )
    return config
  }
  config = formatDate(_, config)
  config = formatDateISO(_, config)
  config = markdown(_, config)
  config = markdownInline(_, config)
  config = unslugify(_, config)
  config = slugify(_, config)
  return config
}

const formatDate = (_, config) => {
  config.libs.nunjucks.addFilter("formatDate", (str, format) => {
    if (!str) {
      return ""
    }
    let date = typeof str === "string" ? parseISO(str) : str
    const fullLocale = config.context.site.locale.join("")
    const shortLocale = config.context.site.locale[0]
    let locale = locales["en"]
    if (locales[fullLocale]) {
      locale = locales[fullLocale]
    } else if (locales[shortLocale]) {
      locale = locales[shortLocale]
    }
    return _formatDate(date, format || config.defaults.dateFormat, { locale })
  })
  return config
}

const formatDateISO = (_, config) => {
  config.libs.nunjucks.addFilter("formatDateISO", (str) => {
    if (!str) {
      return ""
    }
    let date = typeof str === "string" ? parseISO(str) : str
    return _formatDateISO(date)
  })
  return config
}

const markdown = (_, config) => {
  const safe = config.libs.nunjucks.getFilter("safe")
  config.libs.nunjucks.addFilter("markdown", (str = "") =>
    safe(config.libs.marked(str)),
  )
  return config
}

const markdownInline = (_, config) => {
  const safe = config.libs.nunjucks.getFilter("safe")
  config.libs.nunjucks.addFilter("markdownInline", (str = "") =>
    safe(config.libs.marked.parseInline(str)),
  )
  return config
}

const slugify = (_, config) => {
  config.libs.nunjucks.addFilter("slugify", (str) => config.libs.slugify(str))
  return config
}

const unslugify = (_, config) => {
  config.libs.nunjucks.addFilter("unslugify", (str) =>
    config.libs.unslugify(str),
  )
  return config
}

module.exports = {
  allFilters,
  formatDate,
  formatDateISO,
  markdown,
  markdownInline,
  slugify,
  unslugify,
}

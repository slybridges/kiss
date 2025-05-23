const _ = require("lodash")

const staticLoader = (inputPath, options, { permalink, _meta }) => {
  return {
    permalink,
    _meta: {
      // static files are not included in the page hierarchy
      // remove relationship information
      ..._.omit(_meta, [
        "ascendants",
        "children",
        "descendants",
        "isCollection",
        "isPost",
      ]),
      outputType: options.outputType || "STATIC",
    },
  }
}

module.exports = staticLoader

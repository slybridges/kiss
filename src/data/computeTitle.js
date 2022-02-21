const computeTitle = ({ _meta }, config) => {
  return _meta.baseTitle
    ? _meta.baseTitle
    : config.libs.unslugify(_meta.basename)
}

computeTitle.kissDependencies = ["_meta.basename", "_meta.baseTitle"]

module.exports = computeTitle

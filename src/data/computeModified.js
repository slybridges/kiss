const computeModified = ({ _meta }) => {
  if (_meta.fileModified) {
    return _meta.fileModified
  }
}

module.exports = computeModified

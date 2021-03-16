const computeCreated = ({ _meta }) => {
  if (_meta.fileCreated) {
    return _meta.fileCreated
  }
}

module.exports = computeCreated

// Super basic computation, you probably want to set the title manually
// or do something smarter according to your context
const computeTitle = ({ permalink }, config) =>
  config.libs.unslugify(permalink, { slash: " | " })

computeTitle.kissDependencies = ["permalink"]

module.exports = computeTitle

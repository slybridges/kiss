const _ = require("lodash")

const computeIterableCollectionDataView = (context, options = {}, config) => {
  console.log(options.name)
  if (!options.name) {
    throw new Error(
      "computeIterableCollectionDataView needs a collection 'name' option."
    )
  }
  if (!context.collections) {
    throw new Error(
      "computeIterableCollectionDataView: collections not found. Were they computed?"
    )
  }
  const collection = context.collections[options.name]
  if (!collection) {
    throw new Error(
      `computeIterableCollectionDataView: no collection with name '${options.name}'`
    )
  }
  return getCollectionObject(collection, "allPosts", context, config)
}

module.exports = computeIterableCollectionDataView

/** Private **/

const getCollectionObject = (collection, name, context, config) => {
  const page = context.pages[collection._id]
  if (!page) {
    throw new Error(
      `computeIterableCollectionDataView: couldn't find page with id'${collection._id}'`
    )
  }
  const childrenCollection = _.pickBy(collection, (entry) =>
    _.isPlainObject(entry)
  )
  return {
    name: config.libs.unslugify(name),
    entry: page,
    allPosts: collection.allPosts,
    children: _.map(childrenCollection, (child, childName) =>
      getCollectionObject(child, childName, context, config)
    ),
  }
}

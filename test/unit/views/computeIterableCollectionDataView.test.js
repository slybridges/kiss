const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeIterableCollectionDataView = require("../../../src/views/computeIterableCollectionDataView")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeIterableCollectionDataView", () => {
  let config

  beforeEach(() => {
    config = createMockConfig()
  })

  it("should throw error when no collection name provided", () => {
    const context = {
      collections: {},
    }

    assert.throws(
      () => computeIterableCollectionDataView(context, {}, config),
      {
        message:
          "computeIterableCollectionDataView needs a collection 'name' option.",
      },
    )
  })

  it("should throw error when collections not found", () => {
    const context = {}

    assert.throws(
      () =>
        computeIterableCollectionDataView(context, { name: "posts" }, config),
      {
        message:
          "computeIterableCollectionDataView: collections not found. Were they computed?",
      },
    )
  })

  it("should throw error when specified collection doesn't exist", () => {
    const context = {
      collections: {
        blog: { _id: "./blog", allPosts: [] },
      },
    }

    assert.throws(
      () =>
        computeIterableCollectionDataView(context, { name: "posts" }, config),
      {
        message:
          "computeIterableCollectionDataView: no collection with name 'posts'",
      },
    )
  })

  it("should return collection object for valid collection", () => {
    const context = {
      collections: {
        posts: {
          _id: "./posts",
          allPosts: [
            { title: "Post 1", _meta: { id: "./posts/post1" } },
            { title: "Post 2", _meta: { id: "./posts/post2" } },
          ],
        },
      },
      pages: {
        "./posts": {
          _meta: { id: "./posts", basename: "posts" },
          title: "Posts Collection",
        },
      },
    }

    const result = computeIterableCollectionDataView(
      context,
      { name: "posts" },
      config,
    )

    assert.equal(result.name, "All Posts")
    assert.equal(result.entry._meta.id, "./posts")
    assert.equal(result.allPosts.length, 2)
    assert.deepEqual(result.children, [])
  })

  it("should handle nested collections", () => {
    const context = {
      collections: {
        posts: {
          _id: "./posts",
          allPosts: [{ title: "Post 1", _meta: { id: "./posts/post1" } }],
          tech: {
            _id: "./posts/tech",
            allPosts: [
              { title: "Tech Post", _meta: { id: "./posts/tech/techpost" } },
            ],
            js: {
              _id: "./posts/tech/js",
              allPosts: [
                { title: "JS Post", _meta: { id: "./posts/tech/js/jspost" } },
              ],
            },
          },
        },
      },
      pages: {
        "./posts": {
          _meta: { id: "./posts", basename: "posts" },
          title: "Posts Collection",
        },
        "./posts/tech": {
          _meta: { id: "./posts/tech", basename: "tech" },
          title: "Tech Collection",
        },
        "./posts/tech/js": {
          _meta: { id: "./posts/tech/js", basename: "js" },
          title: "JS Collection",
        },
      },
    }

    const result = computeIterableCollectionDataView(
      context,
      { name: "posts" },
      config,
    )

    assert.equal(result.name, "All Posts")
    assert.equal(result.children.length, 1)

    const techChild = result.children[0]
    assert.equal(techChild.name, "Tech")
    assert.equal(techChild.entry._meta.id, "./posts/tech")
    assert.equal(techChild.allPosts.length, 1)
    assert.equal(techChild.children.length, 1)

    const jsChild = techChild.children[0]
    assert.equal(jsChild.name, "Js")
    assert.equal(jsChild.entry._meta.id, "./posts/tech/js")
    assert.equal(jsChild.allPosts.length, 1)
    assert.equal(jsChild.children.length, 0)
  })

  it("should throw error when page not found for collection", () => {
    const context = {
      collections: {
        posts: {
          _id: "./nonexistent",
          allPosts: [],
        },
      },
      pages: {},
    }

    assert.throws(
      () =>
        computeIterableCollectionDataView(context, { name: "posts" }, config),
      {
        message:
          "computeIterableCollectionDataView: couldn't find page with id'./nonexistent'",
      },
    )
  })

  it("should handle collection with no children", () => {
    const context = {
      collections: {
        simple: {
          _id: "./simple",
          allPosts: [{ title: "Simple Post", _meta: { id: "./simple/post" } }],
        },
      },
      pages: {
        "./simple": {
          _meta: { id: "./simple", basename: "simple" },
          title: "Simple Collection",
        },
      },
    }

    const result = computeIterableCollectionDataView(
      context,
      { name: "simple" },
      config,
    )

    assert.equal(result.name, "All Posts")
    assert.equal(result.entry.title, "Simple Collection")
    assert.equal(result.allPosts.length, 1)
    assert.equal(result.children.length, 0)
  })

  it("should handle complex nested structure", () => {
    const context = {
      collections: {
        content: {
          _id: "./content",
          allPosts: [],
          posts: {
            _id: "./content/posts",
            allPosts: [{ title: "Blog Post" }],
          },
          docs: {
            _id: "./content/docs",
            allPosts: [{ title: "Documentation" }],
            api: {
              _id: "./content/docs/api",
              allPosts: [{ title: "API Doc" }],
            },
          },
        },
      },
      pages: {
        "./content": { _meta: { id: "./content", basename: "content" } },
        "./content/posts": {
          _meta: { id: "./content/posts", basename: "posts" },
        },
        "./content/docs": { _meta: { id: "./content/docs", basename: "docs" } },
        "./content/docs/api": {
          _meta: { id: "./content/docs/api", basename: "api" },
        },
      },
    }

    const result = computeIterableCollectionDataView(
      context,
      { name: "content" },
      config,
    )

    assert.equal(result.name, "All Posts")
    assert.equal(result.children.length, 2)

    const childNames = result.children.map((child) => child.name).sort()
    assert.deepEqual(childNames, ["Docs", "Posts"])

    const docsChild = result.children.find((child) => child.name === "Docs")
    assert.ok(docsChild)
    assert.equal(docsChild.children.length, 1)
    assert.equal(docsChild.children[0].name, "Api")
  })

  it("should ignore non-object collection properties", () => {
    const context = {
      collections: {
        mixed: {
          _id: "./mixed",
          _type: "collection",
          _group: "directory",
          allPosts: [{ title: "Post" }],
          someString: "not a collection",
          someNumber: 123,
          someArray: ["not", "a", "collection"],
          validChild: {
            _id: "./mixed/child",
            allPosts: [{ title: "Child Post" }],
          },
        },
      },
      pages: {
        "./mixed": { _meta: { id: "./mixed", basename: "mixed" } },
        "./mixed/child": { _meta: { id: "./mixed/child", basename: "child" } },
      },
    }

    const result = computeIterableCollectionDataView(
      context,
      { name: "mixed" },
      config,
    )

    assert.equal(result.children.length, 1)
    assert.equal(result.children[0].name, "Valid Child")
  })

  it("should use startCase for name formatting", () => {
    const context = {
      collections: {
        myBlogPosts: {
          _id: "./myBlogPosts",
          allPosts: [],
        },
      },
      pages: {
        "./myBlogPosts": {
          _meta: { id: "./myBlogPosts", basename: "myBlogPosts" },
        },
      },
    }

    const result = computeIterableCollectionDataView(
      context,
      { name: "myBlogPosts" },
      config,
    )

    // startCase should convert "allPosts" to "All Posts"
    assert.equal(result.name, "All Posts")
  })
})

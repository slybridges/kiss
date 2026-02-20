const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const {
  computeAscendants,
  computeChildren,
  computeDescendants,
  computeIsCollection,
  computeIsPost,
  computeOutputPath,
} = require("../../../src/data/computeMeta")
const {
  createMockConfig,
  createMockPage,
} = require("../../../test-utils/helpers")

describe("computeMeta", () => {
  let config
  let pages
  let context

  beforeEach(() => {
    config = createMockConfig({
      defaults: {
        sortCollectionBy: "created",
      },
    })
    pages = {}
    context = { pages }
  })

  describe("computeAscendants", () => {
    it("should return empty array for root page", () => {
      const page = createMockPage({
        _meta: {
          parent: null,
        },
      })

      const result = computeAscendants(page, config, context)
      assert.deepEqual(result, [])
    })

    it("should return parent chain", () => {
      const grandparent = createMockPage({
        _meta: {
          id: ".",
          parent: null,
        },
      })
      const parent = createMockPage({
        _meta: {
          id: "./blog",
          parent: ".",
        },
      })

      pages["."] = grandparent
      pages["./blog"] = parent

      const page = createMockPage({
        _meta: {
          parent: "./blog",
        },
      })

      const result = computeAscendants(page, config, context)
      assert.deepEqual(result, [".", "./blog"])
    })

    it("should handle deep nesting", () => {
      pages["."] = createMockPage({
        _meta: { id: ".", parent: null },
      })
      pages["./a"] = createMockPage({
        _meta: { id: "./a", parent: "." },
      })
      pages["./a/b"] = createMockPage({
        _meta: { id: "./a/b", parent: "./a" },
      })
      pages["./a/b/c"] = createMockPage({
        _meta: { id: "./a/b/c", parent: "./a/b" },
      })

      const page = createMockPage({
        _meta: {
          parent: "./a/b/c",
        },
      })

      const result = computeAscendants(page, config, context)
      assert.deepEqual(result, [".", "./a", "./a/b", "./a/b/c"])
    })

    it("should check kissDependencies", () => {
      assert(Array.isArray(computeAscendants.kissDependencies))
      assert(computeAscendants.kissDependencies.includes("_meta.parent"))
    })
  })

  describe("computeChildren", () => {
    it("should return empty array for page with no children", () => {
      const page = createMockPage({
        _meta: {
          id: "./parent",
        },
      })

      const result = computeChildren(page, config, context)
      assert.deepEqual(result, [])
    })

    it("should return children IDs", () => {
      const parent = createMockPage({
        _meta: {
          id: "./blog",
        },
      })

      pages["./blog/post1"] = createMockPage({
        _meta: {
          id: "./blog/post1",
          parent: "./blog",
        },
        created: new Date("2024-01-01"),
      })
      pages["./blog/post2"] = createMockPage({
        _meta: {
          id: "./blog/post2",
          parent: "./blog",
        },
        created: new Date("2024-02-01"),
      })
      pages["./other"] = createMockPage({
        _meta: {
          id: "./other",
          parent: ".",
        },
      })

      const result = computeChildren(parent, config, context)
      assert.deepEqual(result, ["./blog/post1", "./blog/post2"])
    })

    it("should sort children by config default", () => {
      config.defaults.sortCollectionBy = "-created"

      const parent = createMockPage({
        _meta: {
          id: "./blog",
        },
      })

      pages["./blog/old"] = createMockPage({
        _meta: {
          id: "./blog/old",
          parent: "./blog",
        },
        created: new Date("2024-01-01"),
      })
      pages["./blog/new"] = createMockPage({
        _meta: {
          id: "./blog/new",
          parent: "./blog",
        },
        created: new Date("2024-06-01"),
      })

      const result = computeChildren(parent, config, context)
      assert.deepEqual(result, ["./blog/new", "./blog/old"])
    })

    it("should use page sortCollectionBy over config default", () => {
      const parent = createMockPage({
        sortCollectionBy: "title",
        _meta: {
          id: "./blog",
        },
      })

      pages["./blog/zebra"] = createMockPage({
        title: "Zebra",
        _meta: {
          id: "./blog/zebra",
          parent: "./blog",
        },
      })
      pages["./blog/apple"] = createMockPage({
        title: "Apple",
        _meta: {
          id: "./blog/apple",
          parent: "./blog",
        },
      })

      const result = computeChildren(parent, config, context)
      assert.deepEqual(result, ["./blog/apple", "./blog/zebra"])
    })

    it("should check kissDependencies", () => {
      assert(Array.isArray(computeChildren.kissDependencies))
      assert(computeChildren.kissDependencies.includes("_meta.parent"))
    })
  })

  describe("computeDescendants", () => {
    it("should return empty array for page with no children", () => {
      const page = createMockPage({
        _meta: {
          id: "./parent",
          children: [],
        },
      })

      const result = computeDescendants(page, config, context)
      assert.deepEqual(result, [])
    })

    it("should return all descendants recursively", () => {
      const root = createMockPage({
        _meta: {
          id: "./root",
          children: ["./child1", "./child2"],
        },
      })

      pages["./child1"] = createMockPage({
        _meta: {
          id: "./child1",
          children: ["./grandchild1"],
        },
        created: new Date("2024-02-01"),
      })
      pages["./child2"] = createMockPage({
        _meta: {
          id: "./child2",
          children: [],
        },
        created: new Date("2024-01-01"),
      })
      pages["./grandchild1"] = createMockPage({
        _meta: {
          id: "./grandchild1",
          children: [],
        },
        created: new Date("2024-03-01"),
      })

      const result = computeDescendants(root, config, context)
      assert(result.includes("./child1"))
      assert(result.includes("./child2"))
      assert(result.includes("./grandchild1"))
      assert.equal(result.length, 3)
    })

    it("should sort descendants", () => {
      config.defaults.sortCollectionBy = "-created"

      const root = createMockPage({
        _meta: {
          id: "./root",
          children: ["./a", "./b"],
        },
      })

      pages["./a"] = createMockPage({
        _meta: { id: "./a", children: [] },
        created: new Date("2024-01-01"),
      })
      pages["./b"] = createMockPage({
        _meta: { id: "./b", children: [] },
        created: new Date("2024-06-01"),
      })

      const result = computeDescendants(root, config, context)
      assert.deepEqual(result, ["./b", "./a"])
    })

    it("should handle null page", () => {
      const result = computeDescendants(null, config, context)
      assert.deepEqual(result, [])
    })

    it("should check kissDependencies", () => {
      assert(Array.isArray(computeDescendants.kissDependencies))
      assert(computeDescendants.kissDependencies.includes("_meta.children"))
    })
  })

  describe("computeIsCollection", () => {
    it("should return true if explicitly set", () => {
      const page = createMockPage({
        isCollection: true,
        _meta: {
          children: [],
        },
      })

      const result = computeIsCollection(page)
      assert.equal(result, true)
    })

    it("should return true if has children", () => {
      const page = createMockPage({
        _meta: {
          children: ["./child1"],
        },
      })

      const result = computeIsCollection(page)
      assert.equal(result, true)
    })

    it("should return false if no children and not set", () => {
      const page = createMockPage({
        _meta: {
          children: [],
        },
      })

      const result = computeIsCollection(page)
      assert.equal(result, false)
    })

    it("should return false/null if children is null", () => {
      const page = createMockPage({
        _meta: {
          children: null,
        },
      })

      const result = computeIsCollection(page)
      // null is falsy, which is what matters
      assert.equal(result, null)
    })

    it("should check kissDependencies", () => {
      assert(Array.isArray(computeIsCollection.kissDependencies))
      assert(computeIsCollection.kissDependencies.includes("isCollection"))
      assert(computeIsCollection.kissDependencies.includes("_meta.children"))
    })
  })

  describe("computeIsPost", () => {
    it("should return true if explicitly set", () => {
      const page = createMockPage({
        isPost: true,
        _meta: {},
      })

      const result = computeIsPost(page)
      assert.equal(result, true)
    })

    it("should return true if has content", () => {
      const page = createMockPage({
        content: "<p>Some content</p>",
        _meta: {},
      })

      const result = computeIsPost(page)
      assert.equal(result, true)
    })

    it("should return true if not a collection", () => {
      const page = createMockPage({
        _meta: {
          isCollection: false,
        },
      })

      const result = computeIsPost(page)
      assert.equal(result, true)
    })

    it("should return false if collection without content", () => {
      const page = createMockPage({
        content: undefined,
        _meta: {
          isCollection: true,
        },
      })

      const result = computeIsPost(page)
      assert.equal(result, false)
    })

    it("should prioritize explicit isPost", () => {
      const page = createMockPage({
        isPost: true,
        content: null,
        _meta: {
          isCollection: true,
        },
      })

      const result = computeIsPost(page)
      assert.equal(result, true)
    })

    it("should check kissDependencies", () => {
      assert(Array.isArray(computeIsPost.kissDependencies))
      assert(computeIsPost.kissDependencies.includes("content"))
      assert(computeIsPost.kissDependencies.includes("isPost"))
      assert(computeIsPost.kissDependencies.includes("_meta.isCollection"))
    })
  })

  describe("computeOutputPath", () => {
    it("should return null if no permalink", () => {
      const page = createMockPage({
        permalink: undefined,
        _meta: {},
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, null)
    })

    it("should handle HTML pages with directory permalinks", () => {
      const page = createMockPage({
        permalink: "/about/",
        _meta: {
          outputType: "HTML",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "public/about/index.html")
    })

    it("should handle HTML pages without extension", () => {
      const page = createMockPage({
        permalink: "/about",
        _meta: {
          outputType: "HTML",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "public/about.html")
    })

    it("should handle HTML pages with .html extension", () => {
      const page = createMockPage({
        permalink: "/about.html",
        _meta: {
          outputType: "HTML",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "public/about.html")
    })

    it("should preserve non-HTML file extensions", () => {
      const page = createMockPage({
        permalink: "/data.json",
        _meta: {
          outputType: "JSON",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "public/data.json")
    })

    it("should handle root permalink", () => {
      const page = createMockPage({
        permalink: "/",
        _meta: {
          outputType: "HTML",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "public/index.html")
    })

    it("should handle nested paths", () => {
      const page = createMockPage({
        permalink: "/blog/post/",
        _meta: {
          outputType: "HTML",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "public/blog/post/index.html")
    })

    it("should use custom public directory", () => {
      config.dirs.public = "dist"
      const page = createMockPage({
        permalink: "/about",
        _meta: {
          outputType: "HTML",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "dist/about.html")
    })

    it("should handle permalinks with dots", () => {
      const page = createMockPage({
        permalink: "/file.test.config",
        _meta: {
          outputType: "HTML",
        },
      })

      const result = computeOutputPath(page, config)
      assert.equal(result, "public/file.test.config.html")
    })

    it("should check kissDependencies", () => {
      assert(Array.isArray(computeOutputPath.kissDependencies))
      assert(computeOutputPath.kissDependencies.includes("permalink"))
      assert(computeOutputPath.kissDependencies.includes("_meta.outputType"))
    })
  })
})

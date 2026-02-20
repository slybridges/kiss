const { describe, it, beforeEach } = require("node:test")
const assert = require("assert/strict")
const computeCollectionDataView = require("../../../src/views/computeCollectionDataView")
const { createMockConfig } = require("../../../test-utils/helpers")

describe("computeCollectionDataView", () => {
  let config

  beforeEach(() => {
    config = createMockConfig({
      defaults: {
        sortCollectionBy: "created",
      },
    })
  })

  it("should return empty object when no collections exist", () => {
    const pages = {
      ".": { _meta: { id: ".", parent: null } },
      "./posts": { _meta: { id: "./posts", isCollection: false, parent: "." } },
    }

    const result = computeCollectionDataView({ pages }, {}, config)
    assert.deepEqual(result, { allPosts: [] })
  })

  it("should compute collections with nested structure", () => {
    const pages = {
      ".": {
        _meta: {
          id: ".",
          parent: null,
          descendants: ["./posts", "./posts/tech", "./posts/tech/js"],
        },
        sortCollectionBy: "created",
      },
      "./posts": {
        _meta: {
          id: "./posts",
          isCollection: true,
          parent: ".",
          basename: "posts",
          collectionGroup: "directory",
          descendants: ["./posts/tech", "./posts/tech/js"],
        },
      },
      "./posts/tech": {
        _meta: {
          id: "./posts/tech",
          isCollection: true,
          parent: "./posts",
          basename: "tech",
          collectionGroup: "directory",
          descendants: ["./posts/tech/js"],
        },
      },
      "./posts/tech/js": {
        _meta: {
          id: "./posts/tech/js",
          isCollection: true,
          parent: "./posts/tech",
          basename: "js",
          collectionGroup: "directory",
          descendants: [],
        },
      },
    }

    const result = computeCollectionDataView({ pages }, {}, config)

    assert.ok(result.posts)
    assert.equal(result.posts._id, "./posts")
    assert.equal(result.posts._type, "collection")
    assert.equal(result.posts._group, "directory")
    assert.ok(result.posts.tech)
    assert.equal(result.posts.tech._id, "./posts/tech")
    assert.ok(result.posts.tech.js)
    assert.equal(result.posts.tech.js._id, "./posts/tech/js")
  })

  it("should filter posts correctly", () => {
    const pages = {
      ".": {
        _meta: {
          id: ".",
          parent: null,
          descendants: ["./posts", "./posts/post1", "./posts/post2"],
        },
        sortCollectionBy: "created",
      },
      "./posts": {
        _meta: {
          id: "./posts",
          isCollection: true,
          parent: ".",
          basename: "posts",
          collectionGroup: "directory",
          descendants: ["./posts/post1", "./posts/post2"],
        },
      },
      "./posts/post1": {
        _meta: { id: "./posts/post1", isPost: true, parent: "./posts" },
        permalink: "/posts/post1/",
        created: new Date("2023-01-01"),
      },
      "./posts/post2": {
        _meta: { id: "./posts/post2", isPost: true, parent: "./posts" },
        permalink: "/posts/post2/",
        excludeFromCollection: true,
        created: new Date("2023-01-02"),
      },
      "./posts/post3": {
        _meta: { id: "./posts/post3", isPost: true, parent: "./posts" },
        // No permalink - should be excluded
        created: new Date("2023-01-03"),
      },
      "./posts/post4": {
        _meta: { id: "./posts/post4", isPost: true, parent: "./posts" },
        permalink: "/posts/post4/",
        excludeFromWrite: true,
        created: new Date("2023-01-04"),
      },
    }

    const result = computeCollectionDataView({ pages }, {}, config)

    // Only post1 should be included (post2 excluded by excludeFromCollection,
    // post3 has no permalink, post4 excluded by excludeFromWrite)
    assert.equal(result.posts.allPosts.length, 1)
    assert.equal(result.posts.allPosts[0]._meta.id, "./posts/post1")
  })

  it("should handle custom parent option", () => {
    const pages = {
      "./custom": {
        _meta: {
          id: "./custom",
          isCollection: true,
          parent: "./parent",
          basename: "custom",
          collectionGroup: "directory",
          descendants: [],
        },
      },
    }

    const result = computeCollectionDataView(
      { pages },
      { parent: "./parent" },
      config,
    )

    assert.ok(result.custom)
    assert.equal(result.custom._id, "./custom")
  })

  it("should skip collections without descendants", () => {
    const pages = {
      "./posts": {
        _meta: {
          id: "./posts",
          isCollection: true,
          parent: ".",
          basename: "posts",
          collectionGroup: "directory",
          // No descendants
        },
      },
    }

    const result = computeCollectionDataView({ pages }, {}, config)
    assert.deepEqual(result, { allPosts: [] })
  })

  it("should handle recursive calls correctly", () => {
    const pages = {
      ".": {
        _meta: { id: ".", parent: null, descendants: ["./level1"] },
        sortCollectionBy: "created",
      },
      "./level1": {
        _meta: {
          id: "./level1",
          isCollection: true,
          parent: ".",
          basename: "level1",
          collectionGroup: "directory",
          descendants: ["./level1/level2"],
        },
      },
      "./level1/level2": {
        _meta: {
          id: "./level1/level2",
          isCollection: true,
          parent: "./level1",
          basename: "level2",
          collectionGroup: "directory",
          descendants: [],
        },
      },
    }

    const result = computeCollectionDataView({ pages }, {}, config)

    assert.ok(result.level1)
    assert.ok(result.level1.level2)
    assert.equal(result.level1.level2._id, "./level1/level2")
  })

  it("should use camelCase for collection keys", () => {
    const pages = {
      "./my-collection": {
        _meta: {
          id: "./my-collection",
          isCollection: true,
          parent: ".",
          basename: "my-collection",
          collectionGroup: "directory",
          descendants: [],
        },
      },
      "./another_collection": {
        _meta: {
          id: "./another_collection",
          isCollection: true,
          parent: ".",
          basename: "another_collection",
          collectionGroup: "directory",
          descendants: [],
        },
      },
    }

    const result = computeCollectionDataView({ pages }, {}, config)

    assert.ok(result.myCollection)
    assert.ok(result.anotherCollection)
  })

  it("should include allPosts at root level", () => {
    const pages = {
      ".": {
        _meta: { id: ".", parent: null, descendants: ["./post1"] },
        sortCollectionBy: "created",
      },
      "./post1": {
        _meta: { id: "./post1", isPost: true, parent: "." },
        permalink: "/post1/",
        created: new Date("2023-01-01"),
      },
    }

    const result = computeCollectionDataView({ pages }, {}, config)

    assert.ok(Array.isArray(result.allPosts))
    assert.equal(result.allPosts.length, 1)
    assert.equal(result.allPosts[0]._meta.id, "./post1")
  })

  it("should handle non-root calls", () => {
    const pages = {
      "./level1": {
        _meta: {
          id: "./level1",
          isCollection: true,
          parent: ".",
          basename: "level1",
          collectionGroup: "directory",
          descendants: [],
        },
      },
    }

    const result = computeCollectionDataView(
      { pages },
      { isRootCall: false, parent: "." },
      config,
    )

    // Non-root calls shouldn't have allPosts at the top level
    assert.equal(result.allPosts, undefined)
    assert.ok(result.level1)
  })
})

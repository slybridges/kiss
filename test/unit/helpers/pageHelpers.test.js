const { describe, it } = require("node:test")
const assert = require("assert/strict")
const {
  getChildrenPages,
  getDescendantPages,
  getPageFromInputPath,
  getPageFromSource,
  getParentPage,
  isChild,
  findCollectionById,
} = require("../../../src/helpers")
const {
  createMockPage,
  createMockConfig,
  mockGlobalLogger,
  restoreGlobalLogger,
} = require("../../../test-utils/helpers")

describe("getChildrenPages", () => {
  it("should return children pages", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./blog",
        children: ["./blog/post1", "./blog/post2"],
      },
    })
    const pages = {
      "./blog": parentPage,
      "./blog/post1": createMockPage({ _meta: { id: "./blog/post1" } }),
      "./blog/post2": createMockPage({ _meta: { id: "./blog/post2" } }),
    }

    const result = getChildrenPages(parentPage, pages)
    assert.equal(result.length, 2)
    assert.equal(result[0]._meta.id, "./blog/post1")
    assert.equal(result[1]._meta.id, "./blog/post2")
  })

  it("should filter children with filterOptions", () => {
    const parentPage = createMockPage({
      _meta: {
        id: "./blog",
        children: ["./blog/post1", "./blog/post2", "./blog/draft"],
      },
    })
    const pages = {
      "./blog": parentPage,
      "./blog/post1": createMockPage({
        draft: false,
        _meta: { id: "./blog/post1" },
      }),
      "./blog/post2": createMockPage({
        draft: false,
        _meta: { id: "./blog/post2" },
      }),
      "./blog/draft": createMockPage({
        draft: true,
        _meta: { id: "./blog/draft" },
      }),
    }

    const result = getChildrenPages(parentPage, pages, { draft: false })
    assert.equal(result.length, 2)
    assert.equal(result[0]._meta.id, "./blog/post1")
    assert.equal(result[1]._meta.id, "./blog/post2")
  })

  it("should handle empty children", () => {
    const parentPage = createMockPage({
      _meta: { id: "./blog", children: [] },
    })
    const pages = { "./blog": parentPage }

    const result = getChildrenPages(parentPage, pages)
    assert.equal(result.length, 0)
  })
})

describe("getDescendantPages", () => {
  it("should return all descendants", () => {
    const rootPage = createMockPage({
      _meta: {
        id: ".",
        descendants: ["./blog", "./blog/post1", "./about"],
      },
    })
    const pages = {
      ".": rootPage,
      "./blog": createMockPage({ _meta: { id: "./blog" } }),
      "./blog/post1": createMockPage({ _meta: { id: "./blog/post1" } }),
      "./about": createMockPage({ _meta: { id: "./about" } }),
    }

    const result = getDescendantPages(rootPage, pages)
    assert.equal(result.length, 3)
  })

  it("should filter descendants", () => {
    const rootPage = createMockPage({
      _meta: {
        id: ".",
        descendants: ["./blog", "./blog/post1", "./about"],
      },
    })
    const pages = {
      ".": rootPage,
      "./blog": createMockPage({ type: "page", _meta: { id: "./blog" } }),
      "./blog/post1": createMockPage({
        type: "post",
        _meta: { id: "./blog/post1" },
      }),
      "./about": createMockPage({ type: "page", _meta: { id: "./about" } }),
    }

    const result = getDescendantPages(rootPage, pages, {
      filterBy: { type: "post" },
    })
    assert.equal(result.length, 1)
    assert.equal(result[0]._meta.id, "./blog/post1")
  })

  it("should sort descendants", () => {
    const rootPage = createMockPage({
      _meta: {
        id: ".",
        descendants: ["./c", "./a", "./b"],
      },
    })
    const pages = {
      ".": rootPage,
      "./c": createMockPage({ title: "C", _meta: { id: "./c" } }),
      "./a": createMockPage({ title: "A", _meta: { id: "./a" } }),
      "./b": createMockPage({ title: "B", _meta: { id: "./b" } }),
    }

    const result = getDescendantPages(rootPage, pages, { sortBy: "title" })
    assert.equal(result[0].title, "A")
    assert.equal(result[1].title, "B")
    assert.equal(result[2].title, "C")
  })

  it("should sort descendants in descending order", () => {
    const rootPage = createMockPage({
      _meta: {
        id: ".",
        descendants: ["./c", "./a", "./b"],
      },
    })
    const pages = {
      ".": rootPage,
      "./c": createMockPage({ title: "C", _meta: { id: "./c" } }),
      "./a": createMockPage({ title: "A", _meta: { id: "./a" } }),
      "./b": createMockPage({ title: "B", _meta: { id: "./b" } }),
    }

    const result = getDescendantPages(rootPage, pages, { sortBy: "-title" })
    assert.equal(result[0].title, "C")
    assert.equal(result[1].title, "B")
    assert.equal(result[2].title, "A")
  })
})

describe("getPageFromInputPath", () => {
  it("should find page by input path", () => {
    const page = createMockPage({
      _meta: {
        id: "./test",
        inputSources: [{ path: "content/test.md" }],
      },
    })
    const pages = { "./test": page }

    const result = getPageFromInputPath("content/test.md", pages)
    assert.equal(result._meta.id, "./test")
  })

  it("should find page with multiple input sources", () => {
    const page = createMockPage({
      _meta: {
        id: "./test",
        inputSources: [
          { path: "content/test.md" },
          { path: "content/test.json" },
        ],
      },
    })
    const pages = { "./test": page }

    const result = getPageFromInputPath("content/test.json", pages)
    assert.equal(result._meta.id, "./test")
  })

  it("should return undefined when not found", () => {
    const pages = {
      "./test": createMockPage({
        _meta: {
          id: "./test",
          inputSources: [{ path: "content/test.md" }],
        },
      }),
    }

    const result = getPageFromInputPath("content/other.md", pages)
    assert.equal(result, undefined)
  })
})

describe("getPageFromSource", () => {
  const config = createMockConfig()

  it("should find page by permalink", () => {
    const parentPage = createMockPage({ permalink: "/blog/" })
    const targetPage = createMockPage({
      permalink: "/about/",
      _meta: { id: "./about" },
    })
    const pages = {
      "./blog": parentPage,
      "./about": targetPage,
    }
    const indexes = { permalinkIndex: { "/about/": "./about" } }

    const result = getPageFromSource("/about/", parentPage, pages, config, {
      indexes,
    })
    assert.equal(result._meta.id, "./about")
  })

  it("should handle relative paths", () => {
    const parentPage = createMockPage({ permalink: "/blog/" })
    const targetPage = createMockPage({
      permalink: "/blog/post/",
      _meta: { id: "./blog/post" },
    })
    const pages = {
      "./blog": parentPage,
      "./blog/post": targetPage,
    }
    const indexes = { permalinkIndex: { "/blog/post/": "./blog/post" } }

    const result = getPageFromSource("post/", parentPage, pages, config, {
      indexes,
    })
    assert.equal(result._meta.id, "./blog/post")
  })

  it("should decode URI encoded sources", () => {
    const parentPage = createMockPage({ permalink: "/blog/" })
    const targetPage = createMockPage({
      permalink: "/blog/hello world/",
      _meta: { id: "./blog/hello world" },
    })
    const pages = {
      "./blog": parentPage,
      "./blog/hello world": targetPage,
    }
    const indexes = {
      permalinkIndex: { "/blog/hello world/": "./blog/hello world" },
    }

    const result = getPageFromSource(
      "/blog/hello%20world/",
      parentPage,
      pages,
      config,
      { indexes },
    )
    assert.equal(result._meta.id, "./blog/hello world")
  })

  it("should throw when page not found by default", () => {
    const parentPage = createMockPage({ permalink: "/blog/" })
    const pages = { "./blog": parentPage }
    const indexes = { permalinkIndex: {} }

    assert.throws(() => {
      getPageFromSource("/missing/", parentPage, pages, config, { indexes })
    }, /Page .* not found/)
  })

  it("should return null when throwIfNotFound is false", () => {
    const parentPage = createMockPage({ permalink: "/blog/" })
    const pages = { "./blog": parentPage }
    const indexes = { permalinkIndex: {} }

    const result = getPageFromSource("/missing/", parentPage, pages, config, {
      indexes,
      throwIfNotFound: false,
    })
    assert.equal(result, null)
  })
})

describe("getParentPage", () => {
  it("should return parent page", () => {
    const parent = createMockPage({
      title: "Parent",
      content: "Parent content",
      _meta: { id: "./parent" },
    })
    const pages = { "./parent": parent }

    const result = getParentPage(pages, "./parent", false)
    assert.equal(result.title, "Parent")
    assert.equal(result.content, "Parent content")
  })

  it("should omit _meta.inputSources for non-post pages", () => {
    const parent = createMockPage({
      _meta: {
        id: "./parent",
        inputSources: [{ path: "content/parent.md" }],
      },
    })
    const pages = { "./parent": parent }

    const result = getParentPage(pages, "./parent", false)
    assert.equal(result._meta.inputSources, undefined)
  })

  it("should preserve _meta.inputSources for post pages", () => {
    const parent = createMockPage({
      _meta: {
        id: "./parent",
        inputSources: [{ path: "content/parent.md" }],
      },
    })
    const pages = { "./parent": parent }

    const result = getParentPage(pages, "./parent", true)
    assert.deepEqual(result._meta.inputSources, [{ path: "content/parent.md" }])
  })

  it("should omit _no_cascade attributes", () => {
    const parent = createMockPage({
      title: "Parent",
      secret_no_cascade: "should not cascade",
      nested: {
        value: "should cascade",
        private_no_cascade: "should not cascade",
      },
    })
    const pages = { "./parent": parent }

    const result = getParentPage(pages, "./parent", false)
    assert.equal(result.title, "Parent")
    assert.equal(result.secret_no_cascade, undefined)
    assert.equal(result.nested.value, "should cascade")
    assert.equal(result.nested.private_no_cascade, undefined)
  })

  it("should return null when parent not found", () => {
    // Mock global.logger to avoid undefined error
    const originalLogger = mockGlobalLogger()

    const pages = {}
    const result = getParentPage(pages, "./missing", false)
    assert.equal(result, null)

    // Restore original logger
    restoreGlobalLogger(originalLogger)
  })
})

describe("isChild", () => {
  it("should return true for direct child", () => {
    const parent = createMockPage({ _meta: { id: "./blog" } })
    const child = createMockPage({
      _meta: { id: "./blog/post", parent: "./blog" },
    })

    assert.equal(isChild(parent, child), true)
  })

  it("should return false for non-child", () => {
    const page1 = createMockPage({ _meta: { id: "./blog" } })
    const page2 = createMockPage({ _meta: { id: "./about", parent: null } })

    assert.equal(isChild(page1, page2), false)
  })

  it("should return false for grandchild", () => {
    const grandparent = createMockPage({ _meta: { id: "./blog" } })
    const grandchild = createMockPage({
      _meta: { id: "./blog/2024/post", parent: "./blog/2024" },
    })

    assert.equal(isChild(grandparent, grandchild), false)
  })
})

describe("findCollectionById", () => {
  it("should return root collections for '.'", () => {
    const collections = {
      blog: { _type: "collection", _id: "./blog" },
      docs: { _type: "collection", _id: "./docs" },
    }

    const result = findCollectionById(collections, ".")
    assert.deepEqual(result, collections)
  })

  it("should find collection by id", () => {
    const collections = {
      blog: {
        _type: "collection",
        _id: "./blog",
        2024: { _type: "collection", _id: "./blog/2024" },
      },
      docs: { _type: "collection", _id: "./docs" },
    }

    const result = findCollectionById(collections, "./blog/2024")
    assert.equal(result._id, "./blog/2024")
  })

  it("should return undefined when collection not found", () => {
    const collections = {
      blog: { _type: "collection", _id: "./blog" },
    }

    const result = findCollectionById(collections, "./missing")
    assert.equal(result, undefined)
  })

  it("should handle deeply nested collections", () => {
    const collections = {
      blog: {
        _type: "collection",
        _id: "./blog",
        2024: {
          _type: "collection",
          _id: "./blog/2024",
          "01": {
            _type: "collection",
            _id: "./blog/2024/01",
          },
        },
      },
    }

    const result = findCollectionById(collections, "./blog/2024/01")
    assert.equal(result._id, "./blog/2024/01")
  })
})

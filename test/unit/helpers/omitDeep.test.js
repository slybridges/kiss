const { describe, it } = require("node:test")
const assert = require("assert/strict")
const { omitDeep, getLocale } = require("../../../src/helpers")

describe("omitDeep", () => {
  it("should omit single key at top level", () => {
    const obj = {
      keep: "value",
      remove: "should be removed",
      another: "keeper",
    }

    const result = omitDeep(obj, "remove")
    assert.equal(result.keep, "value")
    assert.equal(result.another, "keeper")
    assert.equal(result.remove, undefined)
  })

  it("should omit multiple keys", () => {
    const obj = {
      keep: "value",
      remove1: "should be removed",
      remove2: "also removed",
      another: "keeper",
    }

    const result = omitDeep(obj, ["remove1", "remove2"])
    assert.equal(result.keep, "value")
    assert.equal(result.another, "keeper")
    assert.equal(result.remove1, undefined)
    assert.equal(result.remove2, undefined)
  })

  it("should omit keys deeply in nested objects", () => {
    const obj = {
      level1: {
        keep: "value",
        remove: "should be removed",
        level2: {
          keep: "nested value",
          remove: "also removed",
          level3: {
            remove: "deeply removed",
            keep: "deeply kept",
          },
        },
      },
    }

    const result = omitDeep(obj, "remove")
    assert.equal(result.level1.keep, "value")
    assert.equal(result.level1.remove, undefined)
    assert.equal(result.level1.level2.keep, "nested value")
    assert.equal(result.level1.level2.remove, undefined)
    assert.equal(result.level1.level2.level3.keep, "deeply kept")
    assert.equal(result.level1.level2.level3.remove, undefined)
  })

  it("should handle arrays", () => {
    const obj = {
      items: [
        { keep: "1", remove: "a" },
        { keep: "2", remove: "b" },
        { keep: "3", remove: "c" },
      ],
    }

    const result = omitDeep(obj, "remove")
    assert.equal(result.items.length, 3)
    result.items.forEach((item, i) => {
      assert.equal(item.keep, String(i + 1))
      assert.equal(item.remove, undefined)
    })
  })

  it("should handle nested arrays", () => {
    const obj = {
      matrix: [
        [
          { keep: "00", remove: "x" },
          { keep: "01", remove: "y" },
        ],
        [{ keep: "10", remove: "z" }],
      ],
    }

    const result = omitDeep(obj, "remove")
    assert.equal(result.matrix[0][0].keep, "00")
    assert.equal(result.matrix[0][0].remove, undefined)
    assert.equal(result.matrix[0][1].keep, "01")
    assert.equal(result.matrix[0][1].remove, undefined)
    assert.equal(result.matrix[1][0].keep, "10")
    assert.equal(result.matrix[1][0].remove, undefined)
  })

  it("should handle Date objects", () => {
    const date = new Date("2024-01-01")
    const obj = {
      created: date,
      data: {
        remove: "value",
        modified: new Date("2024-06-01"),
      },
    }

    const result = omitDeep(obj, "remove")
    assert(result.created instanceof Date)
    assert.equal(result.created.getTime(), date.getTime())
    assert(result.data.modified instanceof Date)
    assert.equal(result.data.remove, undefined)
  })

  it("should return non-objects as-is", () => {
    assert.equal(omitDeep("string", "key"), "string")
    assert.equal(omitDeep(42, "key"), 42)
    assert.equal(omitDeep(true, "key"), true)
    assert.equal(omitDeep(null, "key"), null)
    assert.equal(omitDeep(undefined, "key"), undefined)
  })

  it("should handle empty arrays and objects", () => {
    const obj = {
      emptyObj: {},
      emptyArr: [],
      nested: {
        emptyObj: {},
        emptyArr: [],
      },
    }

    const result = omitDeep(obj, "nonexistent")
    assert.deepEqual(result.emptyObj, {})
    assert.deepEqual(result.emptyArr, [])
    assert.deepEqual(result.nested.emptyObj, {})
    assert.deepEqual(result.nested.emptyArr, [])
  })

  it("should handle string as single key", () => {
    const obj = {
      a: 1,
      b: 2,
      c: {
        a: 3,
        b: 4,
      },
    }

    const result = omitDeep(obj, "a")
    assert.equal(result.a, undefined)
    assert.equal(result.b, 2)
    assert.equal(result.c.a, undefined)
    assert.equal(result.c.b, 4)
  })

  it("should handle non-array, non-string keys parameter", () => {
    const obj = {
      a: 1,
      b: 2,
    }

    const result = omitDeep(obj, 123) // Invalid keys type
    assert.deepEqual(result, obj) // Should return object unchanged
  })

  it("should omit multiple keys at different levels", () => {
    const obj = {
      id: "123",
      secret: "hidden",
      data: {
        value: "public",
        secret: "also hidden",
        nested: {
          info: "visible",
          password: "very hidden",
        },
      },
    }

    const result = omitDeep(obj, ["secret", "password"])
    assert.equal(result.id, "123")
    assert.equal(result.secret, undefined)
    assert.equal(result.data.value, "public")
    assert.equal(result.data.secret, undefined)
    assert.equal(result.data.nested.info, "visible")
    assert.equal(result.data.nested.password, undefined)
  })
})

describe("getLocale", () => {
  it("should return empty string when no locale", () => {
    const context = { site: {} }
    assert.equal(getLocale(context), "")
  })

  it("should return string locale as-is", () => {
    const context = { site: { locale: "en-US" } }
    assert.equal(getLocale(context), "en-US")
  })

  it("should join array locale with default separator", () => {
    const context = { site: { locale: ["en", "US"] } }
    assert.equal(getLocale(context), "en-US")
  })

  it("should join array locale with custom separator", () => {
    const context = { site: { locale: ["en", "US"] } }
    assert.equal(getLocale(context, "_"), "en_US")
  })

  it("should handle single element array", () => {
    const context = { site: { locale: ["en"] } }
    assert.equal(getLocale(context), "en")
  })

  it("should handle multiple element array", () => {
    const context = { site: { locale: ["en", "US", "UTF8"] } }
    assert.equal(getLocale(context), "en-US-UTF8")
  })

  it("should return empty string for non-string, non-array locale", () => {
    assert.equal(getLocale({ site: { locale: 123 } }), "")
    assert.equal(getLocale({ site: { locale: true } }), "")
    assert.equal(getLocale({ site: { locale: {} } }), "")
  })

  it("should handle missing site object", () => {
    assert.equal(getLocale({}), "")
  })

  it("should handle nested path not existing", () => {
    assert.equal(getLocale({ other: "data" }), "")
  })
})

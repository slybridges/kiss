const { describe, it } = require("node:test")
const assert = require("assert/strict")
const { jsonSafeStringify, jsonSafeParse } = require("../../../src/helpers")

describe("jsonSafeStringify", () => {
  it("should handle regular objects", () => {
    const obj = { name: "test", value: 42, nested: { key: "value" } }
    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const parsed = JSON.parse(jsonStr)

    assert.equal(parsed.name, "test")
    assert.equal(parsed.value, 42)
    assert.equal(parsed.nested.key, "value")
    assert.equal(specialValues.size, 0)
  })

  it("should handle functions", () => {
    const fn = () => "test"
    const obj = { name: "test", callback: fn }
    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const parsed = JSON.parse(jsonStr)

    assert.equal(parsed.name, "test")
    assert(parsed.callback.startsWith("__KISS_FUNCTION__"))
    assert.equal(specialValues.size, 1)
    assert.equal(specialValues.get(parsed.callback), fn)
  })

  it("should handle dates", () => {
    const date = new Date("2024-01-01")
    const obj = { created: date, name: "test" }
    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const parsed = JSON.parse(jsonStr)

    assert(parsed.created.startsWith("__KISS_DATE__"))
    assert.equal(specialValues.size, 1)
    assert.equal(specialValues.get(parsed.created).getTime(), date.getTime())
  })

  it("should handle undefined values", () => {
    const obj = { name: "test", optional: undefined, value: null }
    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const parsed = JSON.parse(jsonStr)

    assert.equal(parsed.name, "test")
    assert(parsed.optional.startsWith("__KISS_UNDEFINED__"))
    assert.equal(parsed.value, null) // null should remain null
    assert.equal(specialValues.size, 1)
    assert.equal(specialValues.get(parsed.optional), undefined)
  })

  it("should handle multiple special values", () => {
    const fn1 = () => 1
    const fn2 = () => 2
    const date1 = new Date("2024-01-01")
    const date2 = new Date("2024-12-31")

    const obj = {
      func1: fn1,
      func2: fn2,
      date1: date1,
      date2: date2,
      undef1: undefined,
      undef2: undefined,
    }

    const { specialValues } = jsonSafeStringify(obj)
    assert.equal(specialValues.size, 6)
  })

  it("should handle nested special values", () => {
    const obj = {
      level1: {
        func: () => "test",
        level2: {
          date: new Date("2024-01-01"),
          level3: {
            undef: undefined,
          },
        },
      },
    }

    const { specialValues } = jsonSafeStringify(obj)
    assert.equal(specialValues.size, 3)
  })

  it("should handle arrays with special values", () => {
    const fn = () => "test"
    const date = new Date()
    const obj = {
      items: [fn, date, undefined, null, "string", 42],
    }

    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const parsed = JSON.parse(jsonStr)

    assert(parsed.items[0].startsWith("__KISS_FUNCTION__"))
    assert(parsed.items[1].startsWith("__KISS_DATE__"))
    assert(parsed.items[2].startsWith("__KISS_UNDEFINED__"))
    assert.equal(parsed.items[3], null)
    assert.equal(parsed.items[4], "string")
    assert.equal(parsed.items[5], 42)
    assert.equal(specialValues.size, 3)
  })
})

describe("jsonSafeParse", () => {
  it("should restore functions", () => {
    const fn = () => "test result"
    const obj = { name: "test", callback: fn }
    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const restored = jsonSafeParse(jsonStr, specialValues)

    assert.equal(restored.name, "test")
    assert.equal(restored.callback, fn)
    assert.equal(restored.callback(), "test result")
  })

  it("should restore dates", () => {
    const date = new Date("2024-01-01T12:00:00Z")
    const obj = { created: date, name: "test" }
    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const restored = jsonSafeParse(jsonStr, specialValues)

    assert.equal(restored.name, "test")
    assert(restored.created instanceof Date)
    assert.equal(restored.created.getTime(), date.getTime())
  })

  it("should restore undefined values", () => {
    const obj = { name: "test", optional: undefined, value: null }
    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const restored = jsonSafeParse(jsonStr, specialValues)

    assert.equal(restored.name, "test")
    assert.equal(restored.optional, undefined)
    assert("optional" in restored) // Property should exist
    assert.equal(restored.value, null)
  })

  it("should handle multiple nested special values", () => {
    const fn1 = (x) => x * 2
    const fn2 = (x) => x + 1
    const date = new Date("2024-06-15")

    const obj = {
      level1: {
        func: fn1,
        data: "test",
        level2: {
          date: date,
          func: fn2,
          level3: {
            undef: undefined,
            value: 42,
          },
        },
      },
    }

    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const restored = jsonSafeParse(jsonStr, specialValues)

    assert.equal(restored.level1.func(5), 10)
    assert.equal(restored.level1.data, "test")
    assert.equal(restored.level1.level2.func(5), 6)
    assert.equal(restored.level1.level2.date.getTime(), date.getTime())
    assert.equal(restored.level1.level2.level3.undef, undefined)
    assert.equal(restored.level1.level2.level3.value, 42)
  })

  it("should handle arrays with special values", () => {
    const fn = (x) => x * 3
    const date = new Date("2024-03-15")

    const obj = {
      items: [fn, date, undefined, null, "string", 42, { nested: undefined }],
    }

    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const restored = jsonSafeParse(jsonStr, specialValues)

    assert.equal(restored.items[0](4), 12)
    assert.equal(restored.items[1].getTime(), date.getTime())
    assert.equal(restored.items[2], undefined)
    assert.equal(restored.items[3], null)
    assert.equal(restored.items[4], "string")
    assert.equal(restored.items[5], 42)
    assert.equal(restored.items[6].nested, undefined)
  })

  it("should round-trip complex objects", () => {
    const complexObj = {
      id: "test-123",
      metadata: {
        created: new Date("2024-01-01"),
        modified: new Date("2024-06-01"),
        author: "John Doe",
        tags: ["javascript", "testing"],
      },
      compute: (x, y) => x + y,
      transform: {
        uppercase: (str) => str.toUpperCase(),
        lowercase: (str) => str.toLowerCase(),
      },
      optional: undefined,
      nullable: null,
      config: {
        enabled: true,
        threshold: 100,
        callback: undefined,
        handler: () => console.log("handled"),
      },
    }

    const { jsonStr, specialValues } = jsonSafeStringify(complexObj)
    const restored = jsonSafeParse(jsonStr, specialValues)

    assert.equal(restored.id, "test-123")
    assert.equal(
      restored.metadata.created.getTime(),
      complexObj.metadata.created.getTime(),
    )
    assert.equal(
      restored.metadata.modified.getTime(),
      complexObj.metadata.modified.getTime(),
    )
    assert.equal(restored.metadata.author, "John Doe")
    assert.deepEqual(restored.metadata.tags, ["javascript", "testing"])
    assert.equal(restored.compute(3, 4), 7)
    assert.equal(restored.transform.uppercase("hello"), "HELLO")
    assert.equal(restored.transform.lowercase("WORLD"), "world")
    assert.equal(restored.optional, undefined)
    assert.equal(restored.nullable, null)
    assert.equal(restored.config.enabled, true)
    assert.equal(restored.config.threshold, 100)
    assert.equal(restored.config.callback, undefined)
    assert.equal(typeof restored.config.handler, "function")
  })

  it("should handle empty objects and arrays", () => {
    const obj = {
      emptyObj: {},
      emptyArr: [],
      nested: {
        emptyObj: {},
        emptyArr: [],
      },
    }

    const { jsonStr, specialValues } = jsonSafeStringify(obj)
    const restored = jsonSafeParse(jsonStr, specialValues)

    assert.deepEqual(restored.emptyObj, {})
    assert.deepEqual(restored.emptyArr, [])
    assert.deepEqual(restored.nested.emptyObj, {})
    assert.deepEqual(restored.nested.emptyArr, [])
  })
})

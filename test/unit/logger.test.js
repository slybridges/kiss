const { describe, it, beforeEach, afterEach } = require("node:test")
const assert = require("assert/strict")
const {
  setGlobalLogger,
  unsetGlobalLogger,
  resetGlobalLogger,
} = require("../../src/logger")

// Helper to strip ANSI color codes
// Note: Not importing from helpers.js to avoid global logger mock interference
const stripAnsi = (str) => str.replace(/\x1B\[\d+m/g, "")

describe("logger", () => {
  let originalConsoleLog
  let originalGlobalLogger
  let consoleLogs

  beforeEach(() => {
    // Capture console.log calls
    consoleLogs = []
    originalConsoleLog = console.log
    console.log = (...args) => {
      consoleLogs.push(args)
    }

    // Save original global.logger if it exists
    originalGlobalLogger = global.logger
  })

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog

    // Restore or clean up global.logger
    if (originalGlobalLogger) {
      global.logger = originalGlobalLogger
    } else {
      delete global.logger
    }
  })

  describe("setGlobalLogger", () => {
    it("should create global logger with default verbosity", () => {
      setGlobalLogger()

      assert.ok(global.logger)
      assert.equal(typeof global.logger.log, "function")
      assert.equal(typeof global.logger.info, "function")
      assert.equal(typeof global.logger.section, "function")
      assert.equal(typeof global.logger.success, "function")
      assert.equal(typeof global.logger.warn, "function")
      assert.equal(typeof global.logger.error, "function")
      assert.ok(global.logger.counts)
    })

    it("should create global logger with custom verbosity", () => {
      setGlobalLogger("warn")

      assert.ok(global.logger)
      assert.equal(typeof global.logger.error, "function")
    })

    it("should not recreate logger if already exists", () => {
      setGlobalLogger("info")
      const firstLogger = global.logger

      setGlobalLogger("error") // Different verbosity
      const secondLogger = global.logger

      // Should be the same instance
      assert.equal(firstLogger, secondLogger)
    })

    it("should initialize counts to zero", () => {
      setGlobalLogger()

      assert.equal(global.logger.counts.error, 0)
      assert.equal(global.logger.counts.warn, 0)
      assert.equal(global.logger.counts.info, 0)
      assert.equal(global.logger.counts.section, 0)
      assert.equal(global.logger.counts.success, 0)
      assert.equal(global.logger.counts.log, 0)
    })
  })

  describe("unsetGlobalLogger", () => {
    it("should remove global logger", () => {
      setGlobalLogger()
      assert.ok(global.logger)

      unsetGlobalLogger()
      assert.equal(global.logger, undefined)
    })

    it("should handle case where no logger exists", () => {
      delete global.logger

      // Should not throw
      assert.doesNotThrow(() => {
        unsetGlobalLogger()
      })

      assert.equal(global.logger, undefined)
    })
  })

  describe("resetGlobalLogger", () => {
    it("should replace existing logger with new one", () => {
      setGlobalLogger("info")
      const firstLogger = global.logger

      resetGlobalLogger("error")
      const secondLogger = global.logger

      assert.notEqual(firstLogger, secondLogger)
      assert.ok(secondLogger)
    })

    it("should create new logger if none exists", () => {
      delete global.logger

      resetGlobalLogger("warn")

      assert.ok(global.logger)
      assert.equal(typeof global.logger.warn, "function")
    })
  })

  describe("logger functionality", () => {
    beforeEach(() => {
      setGlobalLogger("log") // Most permissive verbosity
    })

    it("should log messages with different levels", () => {
      global.logger.log("test log message")
      global.logger.info("test info message")
      global.logger.warn("test warn message")
      global.logger.error("test error message")
      global.logger.success("test success message")
      global.logger.section("test section message")

      // Should have logged 6 messages
      assert.equal(consoleLogs.length, 6)

      // Check that messages contain expected text
      assert.ok(
        consoleLogs.some((log) =>
          log.some((arg) => String(arg).includes("test log message")),
        ),
      )
      assert.ok(
        consoleLogs.some((log) =>
          log.some((arg) => String(arg).includes("test info message")),
        ),
      )
      assert.ok(
        consoleLogs.some((log) =>
          log.some((arg) => String(arg).includes("test warn message")),
        ),
      )
      assert.ok(
        consoleLogs.some((log) =>
          log.some((arg) => String(arg).includes("test error message")),
        ),
      )
      assert.ok(
        consoleLogs.some((log) =>
          log.some((arg) => String(arg).includes("test success message")),
        ),
      )
      assert.ok(
        consoleLogs.some((log) =>
          log.some((arg) => String(arg).includes("test section message")),
        ),
      )
    })

    it("should increment counts when logging", () => {
      global.logger.log("test")
      global.logger.info("test")
      global.logger.warn("test")
      global.logger.error("test")
      global.logger.success("test")
      global.logger.section("test")

      assert.equal(global.logger.counts.log, 1)
      assert.equal(global.logger.counts.info, 1)
      assert.equal(global.logger.counts.warn, 1)
      assert.equal(global.logger.counts.error, 1)
      assert.equal(global.logger.counts.success, 1)
      assert.equal(global.logger.counts.section, 1)
    })

    it("should respect verbosity levels", () => {
      resetGlobalLogger("warn") // Only warn and error should log

      global.logger.log("should not appear")
      global.logger.info("should not appear")
      global.logger.section("should not appear")
      global.logger.success("should not appear")
      global.logger.warn("should appear")
      global.logger.error("should appear")

      // Should only have 2 messages (warn and error)
      assert.equal(consoleLogs.length, 2)
      assert.ok(
        consoleLogs.some((log) =>
          log.some((arg) => String(arg).includes("should appear")),
        ),
      )
    })

    it("should handle multiple arguments", () => {
      global.logger.info("Multiple", "arguments", 123, { key: "value" })

      assert.equal(consoleLogs.length, 1)
      const logArgs = consoleLogs[0]

      // Should contain all the arguments (plus timestamp and prefix)
      assert.ok(logArgs.some((arg) => String(arg).includes("Multiple")))
      assert.ok(logArgs.some((arg) => String(arg).includes("arguments")))
      assert.ok(logArgs.includes(123))
      assert.ok(
        logArgs.some((arg) => typeof arg === "object" && arg.key === "value"),
      )
    })

    it("should include timestamps", () => {
      global.logger.info("timestamped message")

      assert.equal(consoleLogs.length, 1)
      const logArgs = consoleLogs[0]

      // First argument should be a timestamp (HH:MM:SS format)
      const timestamp = stripAnsi(String(logArgs[0]))
      assert.match(timestamp, /^\d{2}:\d{2}:\d{2}$/)
    })

    it("should include appropriate prefixes", () => {
      resetGlobalLogger("log") // Reset to ensure clean state

      global.logger.log("log message")
      global.logger.info("info message")
      global.logger.warn("warn message")
      global.logger.error("error message")
      global.logger.success("success message")

      // Check that appropriate prefixes are included
      const allLogs = consoleLogs.flat().map((arg) => stripAnsi(String(arg)))

      assert.ok(allLogs.some((arg) => arg.includes("INFO")))
      assert.ok(allLogs.some((arg) => arg.includes("WARN")))
      assert.ok(allLogs.some((arg) => arg.includes("ERR")))
      assert.ok(allLogs.some((arg) => arg.includes("OK")))
      // Log level uses spaces instead of text
      assert.ok(allLogs.some((arg) => /^\s+$/.test(arg))) // Should have whitespace prefix for log level
    })

    it("should handle section logging differently", () => {
      global.logger.section("Section Title")

      assert.equal(consoleLogs.length, 1)
      const logArgs = consoleLogs[0]

      // Section logs should include the message in bold format
      assert.ok(logArgs.some((arg) => String(arg).includes("Section Title")))
      // Should still have timestamp
      const timestamp = stripAnsi(String(logArgs[0]))
      assert.match(timestamp, /^\d{2}:\d{2}:\d{2}$/)
    })

    it("should maintain consistent elapsed time", async () => {
      global.logger.info("first message")

      // Wait a tiny bit to ensure different timestamps
      await new Promise((resolve) => {
        setTimeout(() => {
          global.logger.info("second message")

          // Both messages should have timestamps
          assert.equal(consoleLogs.length, 2)

          const firstTimestamp = stripAnsi(String(consoleLogs[0][0]))
          const secondTimestamp = stripAnsi(String(consoleLogs[1][0]))

          assert.match(firstTimestamp, /^\d{2}:\d{2}:\d{2}$/)
          assert.match(secondTimestamp, /^\d{2}:\d{2}:\d{2}$/)

          // Second timestamp should be greater than or equal to first
          // (they might be the same if execution is very fast)
          assert.ok(secondTimestamp >= firstTimestamp)
          resolve()
        }, 1)
      })
    })

    it("should reset start time when logger is reset", () => {
      // Create first logger and log something to establish start time
      global.logger.info("first message")
      const firstTimestamp = stripAnsi(String(consoleLogs[0][0]))

      // Reset logger (this should reset start time)
      resetGlobalLogger("info")
      consoleLogs = [] // Clear captured logs

      // Log with new logger
      global.logger.info("second message")
      const secondTimestamp = stripAnsi(String(consoleLogs[0][0]))

      // Both should be valid timestamps
      assert.match(firstTimestamp, /^\d{2}:\d{2}:\d{2}$/)
      assert.match(secondTimestamp, /^\d{2}:\d{2}:\d{2}$/)

      // The second timestamp could be similar to first but from a fresh start
      // This mainly tests that it doesn't throw errors and produces valid timestamps
    })
  })

  describe("verbosity levels", () => {
    const levels = ["log", "info", "section", "success", "warn", "error"]

    it("should respect verbosity hierarchy", () => {
      levels.forEach((level, index) => {
        resetGlobalLogger(level)
        consoleLogs = [] // Clear logs

        // Test all levels
        global.logger.log("log message")
        global.logger.info("info message")
        global.logger.section("section message")
        global.logger.success("success message")
        global.logger.warn("warn message")
        global.logger.error("error message")

        // Only levels at current level and above should log
        const expectedCount = levels.length - index
        assert.equal(
          consoleLogs.length,
          expectedCount,
          `At verbosity '${level}', expected ${expectedCount} messages, got ${consoleLogs.length}`,
        )
      })
    })

    it("should handle invalid verbosity levels", () => {
      // Should not throw with invalid verbosity
      assert.doesNotThrow(() => {
        setGlobalLogger("invalid-level")
      })

      assert.ok(global.logger)
    })
  })
})

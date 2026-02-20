const fs = require("fs")
const path = require("path")
const os = require("os")
const { mkdirSync, rmSync, writeFileSync } = require("fs")
const _ = require("lodash")

// Mock global.logger for tests
if (!global.logger) {
  global.logger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    debug: () => {},
  }
}

const createTempDir = (prefix = "kiss-test-") => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  return tmpDir
}

const cleanupTempDir = (dir) => {
  if (fs.existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true })
  }
}

const createMockConfig = (overrides = {}) => {
  // Lazy-load defaultConfig to allow tests to set up mocks first
  // (e.g., sharp mocks in imageWriter tests)
  const defaultConfig = require("../src/config/defaultConfig")

  // Use real defaultConfig as base and deep merge overrides
  // This ensures tests stay in sync with actual config structure
  return _.merge({}, defaultConfig, overrides)
}

const createMockContext = (overrides = {}) => {
  return {
    site: {
      url: "https://example.com",
      title: "Test Site",
      description: "Test Description",
      ...overrides.site,
    },
    pages: overrides.pages || {},
    collections: overrides.collections || {},
    categories: overrides.categories || {},
    ...overrides,
  }
}

const createMockPage = (overrides = {}) => {
  const defaultPage = {
    title: "Test Page",
    content: "Test content",
    permalink: "/test/",
    _meta: {
      id: "./test",
      inputPath: "content/test.md",
      inputSources: [{ path: "content/test.md", loader: "markdown" }],
      outputType: "HTML",
      outputPath: "public/test/index.html",
      isDirectory: false,
      parent: null,
      children: [],
      descendants: [],
      ...overrides._meta,
    },
    ...overrides,
  }
  delete defaultPage._meta // Remove the nested _meta from overrides
  defaultPage._meta = {
    id: "./test",
    inputPath: "content/test.md",
    inputSources: [{ path: "content/test.md", loader: "markdown" }],
    outputType: "HTML",
    outputPath: "public/test/index.html",
    isDirectory: false,
    parent: null,
    children: [],
    descendants: [],
    ...(overrides._meta || {}),
  }
  return defaultPage
}

const assertFileExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`)
  }
}

const assertFileContent = (filePath, expectedContent) => {
  const actualContent = fs.readFileSync(filePath, "utf-8")
  if (actualContent !== expectedContent) {
    throw new Error(
      `File content mismatch:\nExpected: ${expectedContent}\nActual: ${actualContent}`,
    )
  }
}

const createTestFile = (dir, relativePath, content) => {
  const fullPath = path.join(dir, relativePath)
  const dirPath = path.dirname(fullPath)
  mkdirSync(dirPath, { recursive: true })
  writeFileSync(fullPath, content)
  return fullPath
}

const createTestFiles = (dir, files) => {
  const paths = {}
  for (const [relativePath, content] of Object.entries(files)) {
    paths[relativePath] = createTestFile(dir, relativePath, content)
  }
  return paths
}

// Logger mocking helpers
const mockGlobalLogger = () => {
  const originalLogger = global.logger
  global.logger = {
    log: () => {},
    info: () => {},
    section: () => {},
    success: () => {},
    warn: () => {},
    error: () => {},
    counts: {
      log: 0,
      info: 0,
      section: 0,
      success: 0,
      warn: 0,
      error: 0,
    },
  }
  return originalLogger
}

const restoreGlobalLogger = (originalLogger) => {
  if (originalLogger) {
    global.logger = originalLogger
  } else {
    delete global.logger
  }
}

const createCapturingLogger = () => {
  const captured = {
    log: [],
    info: [],
    section: [],
    success: [],
    warn: [],
    error: [],
  }

  const logger = {
    log: (...args) => captured.log.push(args),
    info: (...args) => captured.info.push(args),
    section: (...args) => captured.section.push(args),
    success: (...args) => captured.success.push(args),
    warn: (...args) => captured.warn.push(args),
    error: (...args) => captured.error.push(args),
    counts: {
      log: 0,
      info: 0,
      section: 0,
      success: 0,
      warn: 0,
      error: 0,
    },
  }

  return { logger, captured }
}

// Utility helpers
// eslint-disable-next-line no-control-regex
const stripAnsi = (str) => str.replace(/\x1B\[\d+m/g, "")

const mockProcessExit = () => {
  const originalExit = process.exit
  let exitCode = null

  process.exit = (code = 0) => {
    exitCode = code
    throw new Error(`Process exit called with code ${code}`)
  }

  return {
    get exitCode() {
      return exitCode
    },
    restore: () => {
      process.exit = originalExit
    },
  }
}

const clearRequireCache = (pathPattern) => {
  Object.keys(require.cache).forEach((key) => {
    if (key.includes(pathPattern)) {
      delete require.cache[key]
    }
  })
}

const mockProcessArgv = (args) => {
  const originalArgv = process.argv

  process.argv = args

  return {
    restore: () => {
      process.argv = originalArgv
    },
  }
}

// Copy fixture directory to temp location for isolated testing
const copyFixtureToTemp = (fixturePath, prefix = "kiss-test-fixture-") => {
  const tempDir = createTempDir(prefix)
  const absoluteFixturePath = path.resolve(fixturePath)

  // Recursively copy directory
  const copyDir = (src, dest) => {
    mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src, { withFileTypes: true })

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name)
      const destPath = path.join(dest, entry.name)

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath)
      } else {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }

  copyDir(absoluteFixturePath, tempDir)
  return tempDir
}

// Wait for a condition to be true with timeout
const waitFor = async (
  conditionFn,
  timeoutMs = 5000,
  checkIntervalMs = 100,
) => {
  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    if (await conditionFn()) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, checkIntervalMs))
  }

  throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`)
}

// Wait for subprocess to exit with timeout
const waitForProcessExit = (childProcess, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      childProcess.kill("SIGKILL")
      reject(new Error(`Process did not exit within ${timeoutMs}ms`))
    }, timeoutMs)

    childProcess.on("exit", (code) => {
      clearTimeout(timeout)
      resolve(code)
    })
  })
}

module.exports = {
  createTempDir,
  cleanupTempDir,
  createMockConfig,
  createMockContext,
  createMockPage,
  assertFileExists,
  assertFileContent,
  createTestFile,
  createTestFiles,
  mockGlobalLogger,
  restoreGlobalLogger,
  createCapturingLogger,
  stripAnsi,
  mockProcessExit,
  clearRequireCache,
  mockProcessArgv,
  copyFixtureToTemp,
  waitFor,
  waitForProcessExit,
}

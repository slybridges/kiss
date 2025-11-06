const { describe, it } = require("node:test")
const { spawn } = require("child_process")
const path = require("path")

/**
 * Incremental Build Integration Tests - Wrapper
 *
 * This is a thin wrapper that calls our custom test runner (incremental-runner.js)
 * from within the node:test framework. We use this unconventional approach because:
 *
 * WHY NOT USE node:test DIRECTLY?
 * --------------------------------
 * The incremental build tests need to:
 * 1. Run multiple builds in sequence with shared state (lastBuild context)
 * 2. Modify fixture files on disk and restore them
 * 3. Clear require cache between builds (to mimic dev server behavior)
 * 4. Create and cleanup temporary output directories
 *
 * When these operations run inside node:test's lifecycle hooks (before/after),
 * the test runner hangs because:
 * - The build process creates async operations that don't properly signal completion to node:test
 * - Global state modifications (require cache, global.logger) interfere with test isolation
 * - Pending timers or event listeners prevent the test runner from exiting
 *
 * SOLUTION:
 * ---------
 * Run tests as a standalone Node.js script that:
 * - Has full control over the process lifecycle
 * - Can explicitly call process.exit() when done
 * - Doesn't rely on node:test's async coordination
 * - Runs much faster (no test framework overhead)
 *
 * This wrapper allows `npm test` to still discover and run incremental tests,
 * while keeping them isolated from the problematic node:test lifecycle.
 *
 * See test-utils/incremental-runner.js for the actual test implementations.
 */

describe("Incremental Build Tests", () => {
  it("should run all incremental build tests via custom runner", async () => {
    return new Promise((resolve, reject) => {
      const runnerPath = path.join(
        __dirname,
        "../../test-utils/incremental-runner.js",
      )

      let stdout = ""

      const testProcess = spawn("node", [runnerPath], {
        cwd: path.resolve(__dirname, "../.."),
        stdio: ["pipe", "pipe", "pipe"],
      })

      // Capture output for error reporting (don't display during run)
      testProcess.stdout.on("data", (data) => {
        stdout += data.toString()
      })

      // Consume stderr to prevent backpressure, but don't store it
      testProcess.stderr.on("data", () => {})

      testProcess.on("exit", (code) => {
        if (code === 0) {
          resolve()
        } else {
          // Extract failing tests from output to include in error message
          const failingSection = stdout.match(/# failing tests:([\s\S]*)$/)
          let errorMessage = `Incremental tests failed with exit code ${code}`

          if (failingSection && failingSection[1]) {
            // Include the failure details in the error message
            errorMessage += "\n\n" + failingSection[1].trim()
          }

          reject(new Error(errorMessage))
        }
      })

      testProcess.on("error", (error) => {
        reject(error)
      })
    })
  })
})

#!/usr/bin/env node
const yargs = require("yargs")
const { hideBin } = require("yargs/helpers")

const { build, serve, start, watch } = require("./index.js")

yargs(hideBin(process.argv))
  .usage("Usage: $0 <command> [options]")
  .command("build", "build static website", () => {}, build)
  .command(
    "start",
    "start server and rebuilds on changes (serve + watch)",
    () => {},
    start,
  )
  .command("serve", "start development server", () => {}, serve)
  .command("watch", "watch files and rebuild site on changes", () => {}, watch)
  .option("v", {
    alias: "verbosity",
    default: "info",
    describe: "Verbosity level",
    choices: ["log", "info", "success", "warn", "error"],
  })
  .option("u", {
    alias: "unsafe-build",
    boolean: true,
    default: false,
    describe: "Won't exit(1) on build errors",
  })
  .option("incremental", {
    boolean: true,
    default: false,
    describe: "Performs incremental builds on watch (experimental)",
  })
  .demandCommand(1, "Enter a command").argv

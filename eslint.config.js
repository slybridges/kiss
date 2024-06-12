const js = require("@eslint/js")
const eslintConfigPrettier = require("eslint-config-prettier")
const globals = require("globals")

module.exports = [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.node,
      },
    },
    rules: {},
  },
]

const { defineConfig, globalIgnores } = require("eslint/config");
const globals = require("globals");
const { fixupConfigRules, fixupPluginRules } = require("@eslint/compat");
const tsParser = require("@typescript-eslint/parser");
const typescriptEslint = require("@typescript-eslint/eslint-plugin");
const _import = require("eslint-plugin-import");
const js = require("@eslint/js");
const { FlatCompat } = require("@eslint/eslintrc");
const path = require("node:path");

const prettierConfig = require("eslint-config-prettier/flat");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  ...fixupConfigRules(
    compat.config({
      extends: [
        "eslint:recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
        "google",
        "plugin:@typescript-eslint/recommended",
      ],
    })
  ),

  {
    languageOptions: {
      globals: {
        ...globals.node,
      },

      parser: tsParser,
      sourceType: "module",

      parserOptions: {
        project: [
          path.join(__dirname, "tsconfig.json"),
          path.join(__dirname, "tsconfig.dev.json"),
        ],
        tsconfigRootDir: __dirname,
      },
    },

    plugins: {
      "@typescript-eslint": fixupPluginRules(typescriptEslint),
      import: fixupPluginRules(_import),
    },

    rules: {
      "import/no-unresolved": 0,
      "max-len": "off",
      "valid-jsdoc": "off",
      "require-jsdoc": "off", // 既存の設定を維持
    },
  },

  // --- Prettier との連携 ---
  // 🚨 最も最後に配置し、他の設定を上書きして競合を無効化します
  prettierConfig,

  globalIgnores(["lib/**/*", "generated/**/*", "eslint.config.js"]),
]);

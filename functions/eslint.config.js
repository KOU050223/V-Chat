const { defineConfig, globalIgnores } = require('eslint/config');

const globals = require('globals');

const { fixupConfigRules, fixupPluginRules } = require('@eslint/compat');

const tsParser = require('@typescript-eslint/parser');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');
const _import = require('eslint-plugin-import');
const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const path = require('node:path');

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
});

module.exports = defineConfig([
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },

            parser: tsParser,
            sourceType: 'module',

            parserOptions: {
                project: [
                    path.join(__dirname, 'tsconfig.json'),
                    path.join(__dirname, 'tsconfig.dev.json'),
                ],
                tsconfigRootDir: __dirname,
            },
        },

        extends: fixupConfigRules(
            compat.config({
                extends: [
                    'eslint:recommended',
                    'plugin:import/errors',
                    'plugin:import/warnings',
                    'plugin:import/typescript',
                    'google',
                    'plugin:@typescript-eslint/recommended',
                ],
            })
        ),

        plugins: {
            '@typescript-eslint': fixupPluginRules(typescriptEslint),
            import: fixupPluginRules(_import),
        },

        rules: {
            quotes: ['error', 'double'],
            'import/no-unresolved': 0,
            indent: ['error', 2],
            'max-len': 'off',
            // ESLint 9.x で削除されたルールを無効化
            'valid-jsdoc': 'off',
            'require-jsdoc': 'off',
        },
    },
    globalIgnores(['lib/**/*', 'generated/**/*', 'eslint.config.js']),
]);

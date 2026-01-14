import js from "@eslint/js";
import nextConfig from "eslint-config-next";
import globals from "globals";

export default [
    js.configs.recommended,
    ...nextConfig,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest, // テスト用
            },
        },
        rules: {
            "prefer-const": "error",
            "no-var": "error",
            "react/react-in-jsx-scope": "off", // React 17+ 用
            "no-undef": "off", // TypeScriptがチェックするのでESLintでは不要
            "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
            "no-unused-vars": "off", // TS版を使うためオフ
        },
    },
];
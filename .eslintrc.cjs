module.exports = {
  env: {
    es2023: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "airbnb-base",
    "airbnb-typescript/base",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:jest/recommended",
    "plugin:eslint-comments/recommended",
    "plugin:import/recommended",
    "plugin:prettier/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.test.json",
  },
  plugins: [
    "@typescript-eslint",
    "jest",
    "eslint-comments",
    "import",
    "prettier",
  ],
  root: true,
  rules: {
    // turn on errors for missing imports
    "import/no-unresolved": "error",
    // Removed in @typescript-eslint v8; base ESLint rule still applies via airbnb-base
    "@typescript-eslint/lines-between-class-members": "off",
    // Renamed to only-throw-error in @typescript-eslint v8
    "@typescript-eslint/no-throw-literal": "off",
    "@typescript-eslint/only-throw-error": "error",
    // @typescript-eslint v8 removed allowNumber from strict-type-checked default;
    // restore it to match v7 behaviour and avoid noisy .toString() calls.
    "@typescript-eslint/restrict-template-expressions": [
      "error",
      { allowNumber: true },
    ],
  },
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts", ".tsx"],
    },
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true, // always try to resolve types under `<root>@types` directory even it doesn't contain any source code, like `@types/unist`
      },
    },
  },
};

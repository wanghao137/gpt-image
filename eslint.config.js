// Flat ESLint config (ESLint 9). Scoped to the app source + build scripts.
//
// The codebase already carried `eslint-disable` directives (e.g.
// react-hooks/exhaustive-deps in App/CasesPage) but had no ESLint installed,
// so those directives were dead and the hazards they suppressed went
// unchecked. This config makes them meaningful again and lets `npm run lint`
// surface real issues (hook deps, unused vars, etc.).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  {
    // Generated output, deps, and data — never linted.
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
      "docs/**",
      ".vercel/**",
      ".qa-report/**",
      "Include/**",
      "Lib/**",
      "output/**",
      "test-shots/**",
      "work/**",
      "**/*.d.mts",
    ],
  },

  // App source: React + TypeScript + browser globals.
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Allow intentional `_`-prefixed unused args/vars.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Build + test scripts: Node globals, plain JS, looser rules.
  {
    files: ["scripts/**/*.mjs", "**/*.test.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);

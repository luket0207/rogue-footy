import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Vite + React fast refresh safety
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // With modern React (JSX transform), React import is not required
      "react/react-in-jsx-scope": "off",
    },
  },
  {
    // Disable formatting-related ESLint rules so Prettier is the source of truth
    rules: {
      ...(
        // eslint-config-prettier exposes configs via "default" in flat config usage
        // If your editor complains, you can remove this block and rely on Prettier-only formatting.
        {}
      ),
    },
  },
];

import eslint from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/target/**", "**/gen/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Hooks 规则只对桌面前端生效（core 是纯逻辑，没有 React）。
  // exhaustive-deps 是这里的重点：App.tsx 的落盘/托盘/监听逻辑全靠手写 deps 数组。
  {
    files: ["apps/desktop/src/**/*.{ts,tsx}"],
    ...reactHooks.configs.flat["recommended-latest"],
  },
  {
    files: ["packages/core/src/**/*.ts", "apps/desktop/src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  }
);
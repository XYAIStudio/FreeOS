/**
 * 最小 ESLint 配置。
 *
 * 使用 typescript-eslint 提供基础 TS 语法支持；细粒度规则收敛与
 * Prettier 集成留给后续社区维护。
 */
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "backend/node_modules/**",
      "dist/**",
      "backups/**",
      "V0.5/**",
      "frontend/frontend/**",
      "oh_modules/**",
      "build/**",
      "entry/**",
      "AppScope/**",
      "hvigor/**",
      "backend/data/**",
      "**/node_modules/**",
      "*.config.*",
      "vite.config.*",
      "eslint.config.*",
      "_*",
      "tmp-archive/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
      "*.py",
      "*.txt",
      "*.log",
      "*.tgz",
      "*.tar.gz",
      "*.png",
      "*.ico",
      "*.ps1",
      "*.bat",
      "*.sh",
      "*.yaml",
      "*.yml",
      "*.json5",
      "*.csv",
      "*.lock",
      "*.sum",
      "*.pem",
    ],
  },
  ...tseslint.configs.recommended,
  {
    files: ["backend/**/*.ts", "scripts/**/*.ts"],
    languageOptions: { globals: { ...globals.node, ...globals.es2022 } },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "prefer-const": "off",
      "no-console": "off",
    },
  },
  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.es2022 } },
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "prefer-const": "off",
      "no-console": "off",
    },
  },
);

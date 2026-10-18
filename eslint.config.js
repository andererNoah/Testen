import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**", ".data/**", "apps/web/test-results/**", "apps/web/playwright-report/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      // Modulgrenzen (ADR-0001): nur über den öffentlichen Einstiegspunkt importieren.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@hv/*/src", "@hv/*/src/*"], message: "Nur über den öffentlichen Einstiegspunkt @hv/<paket> importieren." },
            { group: ["../../packages/*", "../../modules/*", "../../../packages/*", "../../../modules/*"], message: "Pakete über @hv/<paket> importieren, nicht über relative Pfade." },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      // Die Oberfläche spricht nur mit der API (Architektur), nie direkt mit Fachmodulen.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["@hv/*", "!@hv/web"], message: "Die Web-App spricht nur über die HTTP-API mit dem Backend." },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/web/e2e/**/*.ts", "apps/web/playwright.config.ts"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.mjs", "scripts/**"],
    languageOptions: { globals: { ...globals.node } },
  },
);

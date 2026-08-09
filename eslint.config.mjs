import js from "@eslint/js"
import prettier from "eslint-config-prettier"
import * as jsonc from "jsonc-eslint-parser"
import tseslint from "typescript-eslint"

export default tseslint.config(
  {
    ignores: [
      "**/dist",
      "**/build",
      "**/node_modules",
      "**/.venv",
      "**/package-lock.json",
      "**/*.timestamp*",
    ],
  },

  // Plain JS and config files live outside the TS program, so type-aware rules can't run here.
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: { console: "readonly", process: "readonly" },
    },
  },

  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        // `allowDefaultProject` covers root-level config files that no tsconfig includes.
        projectService: { allowDefaultProject: ["*.ts", "*.mts"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "TSEnumDeclaration", message: "Use an `as const` object and a derived union." },
      ],
      eqeqeq: ["error", "always"],
      "no-console": "warn",
      "no-unexpected-multiline": "error",
    },
  },

  // A global .d.ts has no top-level imports by definition, so `import()` types are
  // the only way it can reference a module's types.
  {
    files: ["tools/doc-examples/*.d.ts"],
    rules: { "@typescript-eslint/consistent-type-imports": "off" },
  },

  {
    files: ["**/*.json"],
    languageOptions: { parser: jsonc },
    rules: {},
  },

  prettier,
)

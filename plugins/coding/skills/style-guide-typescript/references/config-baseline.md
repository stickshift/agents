# Config baseline

Reference configs for the mechanical layers — Prettier (formatting), ESLint (lint), `tsc` (soundness). Each setting is listed with what it buys, so a deviation can be explained rather than just flagged.

These are defaults for new projects. Report differences with their practical consequence; don't rewrite a project's config unasked.

**Contents**

- [Prettier](#prettier)
- [tsconfig.json](#tsconfigjson)
- [ESLint](#eslint)
- [Auditing an existing project](#auditing-an-existing-project)

## Prettier

```json
{
  "semi": false,
  "singleQuote": false,
  "quoteProps": "as-needed",
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "bracketSpacing": true,
  "endOfLine": "lf"
}
```

Three of these are worth an opinion:

- **`semi: false`** rather than Prettier's default. Automatic semicolon insertion is well specified, and Prettier is already the thing deciding where statements end. The genuinely ambiguous cases are lines beginning with `(`, `[`, `` ` ``, `+`, `-` or `/`, and Prettier prefixes exactly those with a leading semicolon on its own — so the hazard the rule guards against never reaches the file. What's left is one less character of line noise. Pair it with ESLint's `no-unexpected-multiline`, which is the check that catches a continuation you didn't mean.
- **`printWidth: 100`** rather than Prettier's default 80. Type annotations, generics and import lists consume horizontal space that plain JavaScript doesn't, and 80 forces wrapping that hurts more than it helps. If a project uses 80 or 120, leave it — consistency matters more than the number.
- **`trailingComma: "all"`** keeps diffs to one line when appending to a list or parameter set.

The rest are Prettier's defaults or near enough, `singleQuote: false` included — double quotes need no escaping in the apostrophe-bearing English that fills error messages and user-facing strings. `endOfLine: "lf"` avoids CRLF churn on mixed-OS teams; pair it with `* text=auto eol=lf` in `.gitattributes`.

Note that `semi` and `singleQuote` are the two settings a project is most likely to have set the other way. Both are pure preference, so a project that has consistently chosen the opposite has chosen fine — match it rather than reformatting.

Formatting is not a lint concern. If the project has ESLint rules for indentation, quotes, semicolons or line length, they're redundant at best and fighting Prettier at worst — `eslint-config-prettier` exists to turn them off and should be last in the config array.

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    "erasableSyntaxOnly": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,

    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Adjust `target`/`lib`/`module` to the runtime: a browser or bundler project wants `"module": "ESNext"`, `"moduleResolution": "Bundler"`, and `"lib": ["ES2023", "DOM", "DOM.Iterable"]`. `target: "ES2023"` matters beyond output syntax — it's what makes `toSorted`, `toReversed` and `with` visible to the type checker.

### What `strict` already covers

Don't flag these as missing; `strict: true` turns on all of them. Flag them only if one is individually disabled underneath a `strict: true`, which is a deliberate hole worth asking about.

`strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `useUnknownInCatchVariables`, `noImplicitThis`, `alwaysStrict`.

### The additions, and what each buys

| Setting | Effect |
| --- | --- |
| `noUncheckedIndexedAccess` | `arr[0]` and `record[key]` are typed `T \| undefined`. Closes the largest remaining hole in `strictNullChecks` — indexing is not a guarantee of presence. |
| `exactOptionalPropertyTypes` | `x?: T` stops accepting an explicit `undefined`, so "absent" and "present but empty" become distinguishable. Required for the optional-vs-`\| undefined` distinction in the style guide to mean anything. |
| `erasableSyntaxOnly` | Errors on TypeScript syntax that emits runtime code — enums, value-bearing namespaces, parameter properties, `import =`. Mechanically enforces the no-enum rule and keeps files runnable by type-stripping runtimes (Node's `--experimental-strip-types`, Deno, Bun). Requires TS 5.8+. |
| `verbatimModuleSyntax` | Imports used only as types must say `import type`, so emitted imports exactly match what was written. Removes a class of side-effect and cycle surprises. |
| `noPropertyAccessFromIndexSignature` | Forces `obj['key']` for index-signature access, keeping dot access as a signal of a known declared property. |
| `noImplicitOverride` | An override of a base method must say `override`, so a renamed base method breaks loudly instead of silently orphaning the subclass version. |
| `noImplicitReturns` | Every code path in a value-returning function returns. Catches the branch you forgot. |
| `noFallthroughCasesInSwitch` | Catches missing `break`. Rarely intended, always confusing when it is. |
| `noUnusedLocals` / `noUnusedParameters` | Dead bindings fail the build. Prefix with `_` when a parameter must exist for arity. |
| `isolatedModules` | Ensures each file can be transpiled independently, which is what every modern bundler and transpiler actually does. |
| `skipLibCheck` | Skips checking `.d.ts` files in dependencies. Large speedup, and their errors aren't yours to fix. |

### Friction worth accepting

`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are the two that generate real day-to-day friction — the first adds narrowing at every array index, the second surfaces disagreements about what optional means. Both are cheap in greenfield and expensive to adopt later, since retrofitting means auditing every index and every optional property in an existing codebase. That asymmetry is the entire argument for turning them on now.

If a project has them off, it's a reasonable choice for a legacy codebase and a missed opportunity in a new one. Say which, and don't push twice.

## ESLint

Flat config, type-aware. `strictTypeChecked` is the setting that matters — the untyped presets can't see promises, nullability or impossible conditions, which is most of what's worth catching.

```js
// eslint.config.js
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import prettier from "eslint-config-prettier"

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
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
  prettier,
)
```

`prettier` must come last — it disables formatting rules the presets enable, and anything after it can turn them back on.

### Rules the presets already give you

Carried by `strictTypeChecked`, so their absence from the `rules` block isn't a gap:

`no-explicit-any`, `no-floating-promises`, `no-misused-promises`, `no-unnecessary-condition`, `no-unsafe-assignment` / `-call` / `-member-access` / `-return` / `-argument`, `require-await`, `await-thenable`, `no-non-null-assertion`, `no-unnecessary-type-assertion`, `restrict-template-expressions`, `use-unknown-in-catch-callback-variable`.

### Rules added above the presets

- **`consistent-type-definitions: ['error', 'type']`** — enforces `type` over `interface`.
- **`consistent-type-imports`** — pairs with `verbatimModuleSyntax`, which errors without it. Inline style (`import { type Foo, bar }`) avoids a second import line per module.
- **`switch-exhaustiveness-check`** — the payoff for discriminated unions. Adding a variant becomes a compile error at every switch that handles it.
- **`prefer-readonly`** — flags private class fields never reassigned after construction.
- **`explicit-module-boundary-types`** — return types on exported functions. Noisy enough on arrow-heavy React components that `'warn'` is a defensible downgrade there.
- **`no-restricted-syntax` on `TSEnumDeclaration`** — belt-and-braces with `erasableSyntaxOnly`, and gives a message pointing at the replacement. Drop it if the tsconfig flag is on and TS 5.8+ is guaranteed.
- **`eqeqeq: 'always'`** — the `== null` idiom exists to catch both null and undefined, and the style guide uses only `undefined`, so there's nothing left for loose equality to do.
- **`no-unexpected-multiline`** — the counterpart to `semi: false`. `eslint-config-prettier` classifies it as a special rule because it's redundant under `semi: true`; with semicolons off it's the one check standing between you and a line starting with `(` or `[` being swallowed as a continuation of the line above.

### Deliberately off

- **`@typescript-eslint/prefer-readonly-parameter-types`** — right in principle, unusable in practice: it flags any parameter whose type isn't deeply readonly, including most third-party types. Get immutability from `readonly` in the type declarations instead.
- **Any formatting rule** — `indent`, `quotes`, `semi`, `max-len`, `comma-dangle`. Prettier's job.

### Optional plugins

Add when the project shape calls for it:

- **`eslint-plugin-import-x`** — `no-default-export` and `no-cycle` enforce two rules the style guide states but `typescript-eslint` doesn't cover. Note that `no-cycle` is slow on large codebases; CI-only is a reasonable compromise.
- **`eslint-plugin-unicorn`** — useful selectively; its full recommended set is more opinionated than this guide.
- **`eslint-plugin-react-hooks`** — non-negotiable in any React project. The dependency-array rule catches real bugs nothing else sees.

## Auditing an existing project

Config defects come in three kinds, and only the first is a list you can check off:

**A setting is wrong or missing.** Start here, because it's mechanical:

1. Read `tsconfig.json` following `extends` chains — a base config may already supply what looks missing, and a local override may quietly cancel something the base turned on. `npx tsc --showConfig` prints the fully resolved result and is the only reliable answer.
2. Check that ESLint is actually type-aware: `projectService: true` (or `project`) in `parserOptions`, and a `*TypeChecked` preset. Without both, the rules worth having are silently inert — present in the config, never running.
3. Confirm `eslint-config-prettier` is present and last.
4. Look for suppressions hiding the settings above: `// @ts-nocheck`, `// @ts-ignore` (prefer `@ts-expect-error`, which fails once the error is gone), file-scope `eslint-disable`, and individually disabled `strict` sub-flags.

**Two settings are each defensible but contradict each other.** No checklist finds these; they only appear when you read the configs against one another and ask what happens when both apply to the same line of code. A hard `max-len` against Prettier's soft `printWidth` is the classic case — Prettier will knowingly exceed its width on an unbreakable string, and the lint error that follows has no edit that satisfies both. The same shape recurs wherever a lint rule and a formatter setting, or two tools' module resolution, or a build target and a lib version, are set independently to values that only agree by luck.

**Something isn't there at all.** Absences are invisible to a checklist of settings, so ask what a new contributor would hit on day one: no `engines` or `packageManager` pinning the toolchain, no `.editorconfig` when the indent width is non-default, no `.gitignore` for `outDir`, no CI running `tsc --noEmit`, no lint or format step wired to anything that blocks a merge.

Treat the checklist as a floor, not a ceiling. Exhausting it is the start of the review, not the end — the findings that matter most to a team are usually in the second and third categories, because the first kind gets caught eventually and the other two don't.

Report by consequence, not by rule name: "`noUncheckedIndexedAccess` is off, so `users[0].name` type-checks and throws at runtime on an empty array" is actionable in a way that "missing recommended compiler option" is not. Where a config defect already has a matching bug in the source, point at it — a real line of code makes the case that an abstract flag recommendation cannot.

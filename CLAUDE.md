# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

`stickshift/agents` is a **Claude Code plugin marketplace**. The deliverable is markdown — skills and
agent definitions — not an application. Everything else (TypeScript, Python, linters, test runners)
exists to keep that markdown honest.

## Setup

```shell
source environment.sh
```

Required before anything else, and after pulling changes. It bootstraps `mise` (pinned node/uv/gh),
runs `npm ci` when the lockfile moved, runs `uv sync`, activates `.venv`, and puts
`node_modules/.bin` on `PATH` so `tsc`/`vitest`/`pyright` work bare. Without it `pyright` and `tsc`
fail with `env: node: No such file or directory`.

## Commands

```shell
npm run check          # typecheck + lint + format:check + check:docs + test — run before committing
npm run typecheck      # tsc -b across the project references
npm run lint           # eslint .
npm run format         # prettier --write . (markdown is excluded on purpose)
npm run check:docs     # type-check the TypeScript blocks embedded in plugins/**/*.md
npm test               # vitest run
npm run test:watch     # vitest watch
npm run coverage       # vitest run --coverage

pytest                                  # whole Python suite
pytest path/to/test_x.py::test_name     # single test
pytest -m wip                           # only work-in-progress tests
ruff check . && ruff format .
pyright
```

`npm run check` covers the JS/TS side only — run `ruff` and `pyright` yourself when Python changed.

`PYTEST_ADDOPTS` defaults to `-s -n auto -m 'not wip'` (set in `environment.sh`), so tests marked
`@pytest.mark.wip` are skipped by default and the suite runs under xdist.

## Architecture

### Marketplace layout

`.claude-plugin/marketplace.json` at the root lists the plugins; each plugin carries its own
`.claude-plugin/plugin.json`, `README.md`, and `skills/<name>/SKILL.md`. Adding a plugin means adding
both manifests — the root one is what consumers install from.

- `plugins/coding` — skills only: `style-guide-typescript`, `writing-tests-pytest`,
  `writing-tests-vitest`.
- `plugins/dual-track` — the `dual-track` skill plus agents at the plugin root under `agents/`
  (`tech-lead`, `designer`, `coder`). Agents must live at `<plugin>/agents/` to be discovered;
  that is what makes `--agent dual-track:tech-lead` resolve. Nesting them inside a skill directory
  bundles inert files instead of registering agents.
  Agent frontmatter pulls skills across plugin boundaries with qualified names
  (`skills: dual-track:dual-track, coding:style-guide-typescript, figma:figma-use`), so renaming a
  skill breaks agents in the other plugin — and the `figma` plugin is a hard runtime dependency of
  `designer` and `coder`. Every dual-track agent loads `dual-track:dual-track` for shared protocol;
  role-specific guidance goes in the agent file, shared assumptions go in the skill.

### How the docs are kept from drifting

Two independent mechanisms, both wired into the root configs:

**1. Runnable worked examples.** Each testing skill points at a `references/example/` directory that
is a real, executing project, not a snippet:

- `plugins/coding/skills/writing-tests-pytest/references/example/` — collected by the root
  `pytest.ini` and type-checked by `pyrightconfig.json` (`include: plugins/**/references/example`).
- `plugins/coding/skills/writing-tests-vitest/references/example/` — run by `vitest.config.ts` and
  built via a project reference in the root `tsconfig.json`.

A new TypeScript example needs its own entry in `tsconfig.json` `references` or `tsc -b` won't see
it. `tsc -b` emits compiled copies into `dist/`, which is why `vitest.config.ts` excludes `**/dist/**`
— otherwise every test runs twice.

**2. Extracted prose examples.** `tools/check-doc-examples.mjs` (`npm run check:docs`) walks every
`.md` under `plugins/`, writes each ``` ```ts ``` fence out as its own module in `build/doc-examples/`,
and compiles them against `tools/doc-examples/ambient.d.ts` — a declarations file for the fictional
APIs (`User`, `Db`, `Secret`, …) the prose invents. `tsc` errors are remapped back to
`file.md:line:col`.

- A block that can't compile by design (anti-pattern, fragment, deliberately wrong) opts out with
  ``` ```ts no-check ```.
- When an example references an API that doesn't exist yet, **add it to `ambient.d.ts`** rather than
  bending the example to fit.
- Blocks are compiled in isolation with `export {}` appended, so declarations in different blocks
  never collide.

### Formatting policy for markdown

`*.md` is in both `.prettierignore` and ruff's `extend-exclude`. Skill docs are hand-formatted —
tables are aligned and code samples laid out deliberately, and both formatters destroy that. Don't
"fix" the formatting of a SKILL.md, and don't remove those exclusions.

### Skill evals

`plugins/coding/skills/style-guide-typescript/evals/evals.json` holds prompt/assertion pairs for the
`skill-creator` eval harness. When a skill's guidance changes materially, update its assertions.

## Conventions

The TypeScript in this repo follows `plugins/coding/skills/style-guide-typescript/SKILL.md` and its
tests follow `writing-tests-vitest` — the skills are dogfooded. Config is deliberately maximal:
`strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and
`noPropertyAccessFromIndexSignature` in `tsconfig.base.json`; `strictTypeChecked` +
`stylisticTypeChecked` in ESLint, with `enum` banned via `no-restricted-syntax`. Pyright runs in
`strict` mode. Prettier is configured inline in `package.json` (no semicolons, 100 cols, sorted
imports).

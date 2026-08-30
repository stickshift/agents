---
name: style-guide-typescript
description: House TypeScript style for new code — modern idiomatic, immutable by default, minimal type cleverness, parse at the boundary. Use this skill whenever writing new TypeScript or TSX, designing a module/function/type signature, choosing between enums, unions and const objects, deciding how to represent absence or failure, or setting up and reviewing tsconfig.json / ESLint / Prettier config for a TypeScript project. Reach for it even when the request is just "write a function" or "add a type" — the defaults here are what make separate pieces of code fit together. Scoped to greenfield code; inside an existing codebase, match the surrounding conventions instead.
---

# TypeScript style guide

Guidance for writing **new** TypeScript. In an existing codebase, the local convention wins — consistency beats correctness at the margin, and this guide has nothing to say about code you didn't start.

Most style questions are already answered by tooling: Prettier decides layout, ESLint decides lint, `tsc` decides soundness. This document is about the decisions those tools can't make for you. For the config that pins down the mechanical layers — and how to audit a project against it — read `references/config-baseline.md`.

## The stance

Six choices produce nearly everything below. Knowing them lets you extrapolate to cases this guide doesn't cover.

1. **Functions over plain data, not classes.** Classes earn their place when an object has identity and lifecycle, or a framework demands one.
2. **Immutable by default.** Data structures are `readonly`; transformations return new values.
3. **Inference first.** Annotate what forms a contract; let `tsc` derive the rest.
4. **Minimal type-level cleverness.** Application types should be readable at a glance. Conditional and mapped types belong in libraries, not features.
5. **Parse at the boundary.** External data becomes a validated domain type at the edge; the interior trusts its types completely.
6. **Strict compiler, no escape hatches.** Greenfield is the only time strictness is free — you never pay a retrofit cost.

## Types

**Model with unions, not flags.** A discriminated union makes illegal states unrepresentable; a bag of optional fields makes them merely undocumented.

```ts no-check
// Every combination is possible, most are nonsense.
type Request = { loading: boolean; data?: User; error?: Error }

// Three states, exhaustively checkable.
type Request =
  | { readonly status: "loading" }
  | { readonly status: "success"; readonly data: User }
  | { readonly status: "failure"; readonly error: Error }
```

Switch on the discriminant and let `switch-exhaustiveness-check` catch the case you forget when a variant is added.

**Prefer `type` to `interface`.** `type` covers unions, intersections and mapped types with one keyword, so a codebase that defaults to it stays uniform. Use `interface` where you need declaration merging or you're publishing an extension point consumers are meant to augment — both rare, and both deliberate when they happen.

**Never `enum`.** They emit runtime code, so they can't be erased by type-stripping runtimes; numeric enums accept any number, which is unsound. Use a frozen object plus a derived union:

```ts
const Role = { admin: "admin", editor: "editor", viewer: "viewer" } as const
type Role = (typeof Role)[keyof typeof Role]
```

The value and the type share a name, `Role.admin` still autocompletes, and the type is a plain string union that works everywhere. `erasableSyntaxOnly` enforces this mechanically.

**`unknown` at the edges, never `any`.** `any` disables checking silently and infects everything it touches. `unknown` forces a narrowing step, which is exactly the step you skipped. If `any` is genuinely unavoidable, isolate it in one line with a comment explaining why.

**Don't launder types with `as`.** A type assertion is a claim the compiler can't verify, so it's only as good as the reasoning next to it. Reach instead for a type predicate, a schema parse, or `satisfies`. `as const` is a different thing and is always fine.

**`satisfies` for literals that must conform.** It checks the value against a type without widening it, so you keep the precise inferred type and still catch mistakes.

**Annotate contracts, infer the rest.** Parameters always. Return types on exported functions — they pin the public shape so an unrelated edit can't silently change your API, and they keep type-checking fast. Local variables and internal helpers: let inference work, it's more accurate than what you'd write.

**Keep types readable.** If understanding a type requires mentally evaluating it, replace it with something explicit. Reach for a generic only when a function is genuinely parametric and is called at more than one type; a generic with a single call site is an indirection with no payoff. Branded types are the one piece of type-level machinery worth the cost, and only when mixing up two same-shaped values is plausible:

```ts
type UserId = string & { readonly __brand: "UserId" }
```

## Immutability

Mutation is fine where it can't be observed and harmful where it can. The line is the function boundary.

- Properties are `readonly`; array parameters and returns are `readonly T[]`.
- Never mutate a parameter. A function that changes its arguments has a second, invisible return value.
- Update by producing new values: spread for objects, `toSorted` / `toReversed` / `with` / `toSpliced` for arrays. The in-place versions (`sort`, `reverse`, `splice`) mutate a caller's data, often surprisingly.
- `const` everywhere. A `let` is usually a loop accumulator wanting to be a `map`/`reduce`, or a branch wanting to be a function.
- Building a local array with `push` and returning it is fine — nothing outside observes the mutation. Don't contort into a `reduce` to avoid a keystroke; the goal is safe interfaces, not zero assignment statements.
- Skip `Object.freeze` in normal code. Readonly types are compile-time and free; freezing costs at runtime and only helps when untrusted code holds a reference.

## Functions and modules

**Functions and plain data over classes.** Closures capture state without `this`, are trivial to test, and tree-shake. Use a class when instances have identity and a lifecycle, or when a framework's API is class-shaped — not merely to group related functions, which is what a module already does.

**Named exports only.** Default exports get renamed at each import site, so they're invisible to grep and unreliable under rename-refactors. The exception is a framework requiring one, such as a Next.js route.

**One concept per file, named after it.** Files kebab-case, matching their main export.

**No barrel files.** An `index.ts` that re-exports a directory defeats tree-shaking, invites import cycles, and makes the compiler read the whole subtree to resolve one symbol. The one legitimate barrel is a published package's entrypoint.

**Function declarations at module scope, arrows inline.** Declarations hoist and produce better stack traces; arrows are right for callbacks and short expressions.

**Take an options object at three or more parameters,** or at two if they share a type — positional arguments of the same type are an ordering bug waiting to happen.

**Return early.** Guard clauses at the top beat an arrow of nested conditionals.

## Absence and failure

**Use `undefined`, not `null`.** JavaScript already means "absent" with `undefined`: missing properties, omitted arguments, functions without a return. Having two absence values means every check has to consider both. When an external API or driver hands you `null`, convert it at the boundary along with everything else.

**Optional versus explicit `| undefined`.** `x?: T` means the key may be missing. `x: T | undefined` means the key must be present and may hold nothing. With `exactOptionalPropertyTypes` this distinction is real and worth using precisely — it's what lets a partial-update type say "not provided" and "clear this field" separately.

**Throw for bugs; return for expected failures.** A violated invariant should crash loudly and fast. A failure the caller is supposed to handle — validation, parsing, a network call — belongs in the return type, because a signature that admits failure can't be ignored by accident.

```ts
type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }
```

That's the whole abstraction. Don't reach for an Effect-style library or build combinators on top of it; the value is the honest signature, not the algebra.

**Errors are `Error` subclasses.** Set `name`, pass `cause` when rethrowing, keep the original stack. Never throw a string or object literal — `instanceof` checks and logging both depend on the real thing.

**Narrow in `catch`.** The binding is `unknown`, and that's correct: anything can be thrown. Check before you access `.message`.

**Never swallow.** Catching to log and continue leaves the program in a state nobody designed. Either handle it meaningfully, or let it propagate.

## Boundaries

Every value entering the program from outside — HTTP body, query params, env vars, JSON file, database row, queue message — passes through a schema validator (Zod, Valibot, ArkType) at the edge. Past that point, types are trustworthy and code can stop defensively checking.

Derive the TypeScript type from the schema rather than declaring both:

```ts
const UserSchema = z.object({ id: z.string(), email: z.string().email() })
type User = z.infer<typeof UserSchema>
```

Two hand-maintained definitions of the same shape drift; a derived one can't.

Validate environment variables once at startup and export the typed result. A misconfigured deploy should fail immediately, not at 3am on the first request that reads the missing key.

## Async

- `async`/`await` throughout; `.then` chains only when a promise is genuinely being passed around rather than awaited.
- Independent work goes in `Promise.all`. An `await` inside a loop serializes it — sometimes that's intended, usually it's an accident, so make the intent visible.
- Long-running and I/O functions accept an `AbortSignal` and honor it. Retrofitting cancellation later means touching every layer.
- No floating promises. An unawaited promise loses its rejection, and the failure surfaces as an unhandled rejection far from the cause.

## Naming

| Kind | Convention |
| --- | --- |
| Types, classes, type parameters | `PascalCase` |
| Values, functions, methods, properties | `camelCase` |
| Files and directories | `kebab-case` |
| Booleans and predicates | `is` / `has` / `can` / `should` prefix |
| Type parameters (multiple) | `TKey`, `TValue` — bare `T` only when there's one and it's obvious |
| Unused bindings | `_`-prefixed |

Acronyms are words: `parseUrl`, `HttpClient`, `userId`. Avoid abbreviating unless the short form is what people actually say. Module constants use `camelCase` like any other value; `SCREAMING_SNAKE` is acceptable for primitive module-level constants if applied consistently.

## Comments

Comment the *why* — the constraint, the tradeoff, the bug this works around. The *what* is already in the code, and a comment restating it is one edit away from lying.

TSDoc on exported API, describing behavior and contract rather than restating parameter types. Delete commented-out code; version control already has it.

## Tooling config

Headline positions, with the full files and per-setting rationale in `references/config-baseline.md`:

- **Prettier** owns all formatting. Don't argue with it, don't add ESLint rules that overlap with it, and make sure `eslint-config-prettier` is disabling the ones that would.
- **ESLint** runs `typescript-eslint`'s type-aware `strictTypeChecked` preset. Type-aware linting is what catches floating promises and impossible conditions; the non-type-aware presets can't.
- **tsc** runs `strict` plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly` and `verbatimModuleSyntax`. Those four are what make the rules above enforceable rather than aspirational.

Read the reference file when setting up a project, when asked to review config, or when a rule here needs to be traced back to the setting that enforces it.

## When config or code deviates

Deviations are worth surfacing, not worth fighting over. Say which setting or rule differs, what it allows through in practice, and offer the change — then move on if the answer is no. A project that has deliberately and consistently chosen otherwise is fine; the failure mode this guide exists to prevent is drift nobody decided on.

Stay inside the task you were given. Noticing that `tsconfig.json` is missing `noUncheckedIndexedAccess` while adding a feature is worth a sentence at the end, not an unrequested config rewrite.

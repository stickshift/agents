---
name: writing-tests-vitest
description: House testing style for Vitest — test-first, Given-When-Then narrative structure, typed `test.extend` fixtures, real infrastructure over mocks. Use this skill any time you're writing, reviewing, or restructuring tests with Vitest — unit, integration, end-to-end, or component tests in Browser Mode — and when setting up `vitest.config.ts`, organizing fixtures, or deciding what to mock. Reach for it even when the request is just "add a test for this."
---

# Writing High-Quality Tests

Our tests follow strict patterns for consistency, readability, and maintainability.
This skill teaches you how to write tests that read like specifications and verify real
behavior against real infrastructure.

This is the Vitest counterpart to `writing-tests-pytest`; the philosophy is identical and
only the mechanics differ. For the surrounding code style — `readonly` by default, `type`
over `interface`, `undefined` over `null`, throw for bugs and return for expected failures —
see `style-guide-typescript`. Test code is production code and follows the same rules.

**A complete worked example lives in `references/example/`** — a real key/value store on a
real temp directory, a fixture ladder, and tests covering the CRUD lifecycle, both failure
styles, and parameterization. It runs under `vitest run` and type-checks under `tsc -b`, so
unlike the snippets below it cannot quietly drift from the APIs it demonstrates. Read it when
you want the whole shape at once; read the sections below for the reasoning behind each part.

## Test-Driven Development

Write the test before the code it verifies. The test is a specification of the behavior you
want — writing it first forces you to define "done" before you build, and it guarantees the
test can actually fail, so a passing test means something.

The loop is **Red → Green → Refactor**:

1. **Red** — Write a failing test for the next small piece of behavior. Run it and confirm
   it fails for the right reason. A test that has never failed proves nothing.
2. **Green** — Write the minimum code to make it pass. Resist the urge to build ahead of the
   test; unneeded code is untested code.
3. **Refactor** — With the test green as a safety net, clean up both the implementation and
   the test. Keep everything green as you go.

Take small steps. Each cycle should add one observable behavior, so when a test fails you
know it was the last thing you changed.

Run the loop with `vitest --watch` on a narrowed path (`vitest src/secrets --watch`), not the
whole suite. Watch mode re-runs only the affected files, so the Red step stays under a second.

### Principles

- **One reason to fail** — Each test pins down a single behavior. When it breaks, the cause
  is obvious. Narrow tests localize failures; broad ones obscure them.
- **Triangulate toward generality** — Don't guess at abstractions up front. Write the simplest
  code that passes, and generalize only when a second test forces you to.
- **Test behavior, not implementation** — Drive the public API the caller actually uses.
  Tests coupled to internals break on every refactor and lose their value (see
  _Testing private implementation details_ under Anti-Patterns).
- **Let tests pressure the design** — Code that is hard to test is usually badly coupled.
  When a test is painful to write, treat it as a signal to fix the design, not the test.
- **The test is production code** — It earns the same care: clear names, narrative intent,
  no duplication that obscures meaning.

## Given-When-Then Structure

Every test uses comment blocks to separate phases. The `// Whens` and `// Thens` blocks are
always required. Include `// Givens` only when the test has preconditions to set up.

```ts no-check
test("describes the scenario and expected outcome", async ({ someFixture }) => {
  //
  // Givens
  //

  // Plain English comment explaining the precondition
  const variable = setupValue

  //
  // Whens
  //

  // Plain English comment explaining the action
  const result = await functionUnderTest(variable)

  //
  // Thens
  //

  // Plain English comment explaining the expectation
  expect(result).toEqual(expectedValue)
})
```

Each comment block starts and ends with a bare `//` on its own line. This visual separation
makes tests scannable — you can skim the comments alone and understand the test's intent
without reading any code.

### Narrative Comments

Comments describe WHAT is happening and WHY, using natural English that reads like a spec.
The tense convention makes each phase immediately recognizable:

- **Givens**: Past tense — "I created...", "Random document was generated"
- **Whens**: Present tense — "I cancel...", "I look up..."
- **Thens**: Present tense with "should" — "Task should be cancelled", "name should be benoit"

**Good:**

```ts
//
// Givens
//

// Random document content
const doc = { id: randomUUID(), value: randomString() }

// I uploaded all files to server
await sftpClient.put(paths, { recurse: true })

//
// Whens
//

// I look up organization name
const name = await getOrganizationName(client, { organizationId })

//
// Thens
//

// name should be benoit
expect(name).toBe("benoit")
```

**Bad — these miss the point:**

```ts
// Create a document             (too terse, no context)
// Call the function             (describes code, not intent)
// Check the result              (vague, doesn't state expectation)
// Assert result equals expected (just restating the code)
```

The goal is that someone unfamiliar with the codebase can read only the comments and
understand the entire test scenario.

## Fixture-Based Test Data

Use Vitest fixtures for anything that requires setup or teardown — databases, servers,
clients, temporary resources. Fixtures should return real, working resources.

A fixture is a function taking `(context, use)`. Setup runs before `use`, the test runs
while `use` is awaited, and teardown runs after — the same shape as a pytest `yield`
fixture:

```ts
import { test as base } from "vitest"

export const test = base.extend<{ sftpClient: SftpClient }>({
  // eslint-disable-next-line no-empty-pattern -- destructuring declares fixture deps
  sftpClient: async ({}, use) => {
    const connection = await connect(options)
    const client = await connection.startSftpClient()

    await use(client)

    await client.end()
    await connection.close()
  },
})
```

Three mechanics that have no pytest equivalent and will bite you otherwise:

**You must destructure the context.** Vitest builds the dependency graph by reading the
destructuring pattern in the parameter list. `async ({ db }, use)` declares a dependency on
`db`; `async (ctx, use)` declares nothing and leaves `ctx.db` undefined. A fixture with no
dependencies takes the empty pattern `{}`, which trips ESLint's `no-empty-pattern` — disable
it on that line, as above.

**Every fixture must appear in the type parameter.** `base.extend<{ db: Db; user: User }>`
lists the full set. This is the payoff over pytest: a typo in a fixture name is a compile
error, and your editor autocompletes what's available.

**Scope is opt-in and there is no session scope.** Fixtures default to `scope: "test"`
(fresh per test). Use `scope: "file"` for expensive setup shared within a file, and
`scope: "worker"` for per-worker-process resources — with four workers you pay setup four
times, so `worker` is not `session`. Add `{ auto: true }` for pytest's `autouse`. Note that
`beforeAll`/`beforeEach` can only see `file`- and `worker`-scoped fixtures, never
`test`-scoped ones.

```ts no-check
metrics: [async ({}, use) => { /* ... */ }, { auto: true, scope: "file" }],
```

### The Fixture Ladder

Vitest has no `conftest.py` — no implicit, directory-scoped discovery. Instead, build a
ladder of exported `test` objects, each extending the last, and import the one you need.
This is more explicit than pytest and easier to trace: the import line tells you exactly
which fixtures are in play.

```ts
// tests/fixtures/platform.ts
import { test as base } from "vitest"

export const test = base.extend<{ client: PlatformClient }>({
  // eslint-disable-next-line no-empty-pattern -- destructuring declares fixture deps
  client: async ({}, use) => {
    await use(await createPlatformClient())
  },
})
```

```ts
// tests/fixtures/secrets.ts
import { test as base } from "./platform.ts"

export const test = base.extend<{ secretName: string }>({
  secretName: async ({}, use) => {
    await use(`benoit/tests/${today()}/${randomString()}`)
  },
})
```

```ts no-check
// packages/platform/tests/secrets.test.ts
import { expect } from "vitest"
import { test } from "../../../tests/fixtures/secrets.ts"
```

Organize the ladder by scope:

- **Shared fixtures** go in `tests/fixtures/` for cross-cutting concerns
- **Domain-specific test data** uses the custom Faker provider in `tests/fixtures/fake.ts`
- **Package-specific fixtures** go in `packages/<package>/tests/fixtures/`

To vary a fixture for one suite, use `test.override` inside a `describe` rather than
redefining it — overrides are inherited by nested suites and can be overridden again:

```ts
describe("with a read-only client", () => {
  test.override({
    client: async ({}, use) => {
      await use(await readOnlyClient())
    },
  })

  test("rejects writes", async ({ client }) => {
    /* ... */
  })
})
```

## Real Integration Testing Over Mocking

The default is to test against real infrastructure. Mocking internal services hides real
bugs — if a test passes against mocks but fails against the actual database, the test was
worse than useless because it gave false confidence.

**Use real infrastructure for:**

- Databases (Postgres, MongoDB, LocalStack S3) — via Testcontainers in a fixture
- Servers spun up in containers
- HTTP clients and servers
- Message queues

**Mock only when you must:**

- External third-party APIs (Stripe, external webhooks)
- Services genuinely outside your control
- Expensive external calls with no test equivalent

When you do mock an external HTTP dependency, intercept at the network boundary with **MSW**,
not by replacing the module. A handler survives swapping the HTTP client; `vi.mock("axios")`
does not, and it asserts against your own call syntax rather than the request that would
actually go out.

```ts
// Good — tests real behavior
test("uploads the file to the server", async ({ sftpClient }) => {
  //
  // Whens
  //

  // I upload file
  await sftpClient.put(localPath, remotePath)

  //
  // Thens
  //

  // File should exist on server
  await expect(sftpClient.exists(remotePath)).resolves.toBe(true)
})
```

```ts
// Acceptable — external API we don't control
server.use(
  http.post("https://api.stripe.com/v1/charges", () => HttpResponse.json({ id: "ch_test" })),
)
```

Reach for `vi.spyOn` over `vi.mock` when you only need to observe or stub a single export;
`vi.mock` is hoisted above imports and replaces a whole module, which is almost always more
than you meant. If a factory needs a variable, define it in `vi.hoisted()`. Set
`restoreMocks: true` in config so spies never leak between tests.

## Test Isolation and Cleanup

Each test must be completely independent — safe to run in parallel, in any order. Files run
in parallel by default. Put teardown after `use` in the fixture, and create unique resource
names with dates and random strings to avoid collisions.

```ts
import { test as base } from "./platform.ts"

export const test = base.extend<{ tempQueue: Queue }>({
  tempQueue: async ({ client }, use) => {
    const name = `benoit/tests/${today()}/${randomString()}`
    const queue = await messages.createQueue(client, { name })

    await use(queue)

    await messages.deleteQueue(client, { queue })
  },
})
```

Teardown after `use` runs whether the test passed or failed, and fixtures tear down in
reverse setup order — so a fixture that depends on `db` is always cleaned up before `db`
itself closes. Forgetting to `await use(...)` fires teardown immediately and hands the test
a closed resource; that's the first thing to check when a fixture behaves impossibly.

For cleanup owned by the test body rather than a fixture, use `onTestFinished` from the
context instead of a trailing statement that a failed assertion would skip.

## Waiting Without Sleeping

Never `await sleep(...)`. A fixed delay is either flaky or slow, and usually both. Poll for
the condition you actually care about:

```ts
// I wait for collector to process files
await expect.poll(() => processedCount(collectorClient), { timeout: 30_000 }).toBe(n)
```

Use `expect.poll` when you are waiting on a value to satisfy a matcher, and `vi.waitFor`
when you are waiting on an operation to stop throwing. For time-dependent logic, control the
clock directly with `vi.useFakeTimers()` and `vi.setSystemTime()` rather than waiting on it —
and always restore with `vi.useRealTimers()`.

## Test Both Happy and Sad Paths

Always pair success tests with error-case tests. For error cases, `// Whens / Thens` can
be combined when the action and assertion are a single expression.

For failures that throw — violated invariants and genuine bugs — assert on the rejection:

```ts
test("fails to look up an organization that does not exist", async ({ client }) => {
  //
  // Givens
  //

  // Random organization id (doesn't exist)
  const organizationId = randomUUID()

  //
  // Whens / Thens
  //

  // I look up organization name, it should fail
  await expect(getOrganizationName(client, { organizationId })).rejects.toThrow(NotFoundError)
})
```

For failures the caller is expected to handle, `style-guide-typescript` says the signature
returns a `Result` rather than throwing — so assert on the discriminant instead. Reaching for
`.rejects` against a function that returns `Result` is a sign one of the two is wrong:

```ts
//
// Whens
//

// I parse the malformed payload
const result = parseWebhook(body)

//
// Thens
//

// Parse should fail with a validation error
expect(result.ok).toBe(false)
expect(result).toMatchObject({ error: { name: "ValidationError" } })
```

Always assert the specific error type or message. A bare `.rejects.toThrow()` passes on a
typo in the function name just as happily as on the failure you meant to test.

## CRUD Pattern Testing

When testing data operations, verify the complete lifecycle in a single test. This catches
subtle issues like create succeeding but read returning stale data, or delete not actually
removing the resource. Alternate `// Whens` and `// Thens` blocks through the lifecycle.

```ts
test("creates, reads, updates, and deletes a secret", async ({ client, secretName }) => {
  //
  // Givens
  //

  // Random value
  const value0 = { x: randomString() }

  //
  // Whens
  //

  // I create a secret
  const secret = await secrets.create(client, { name: secretName, value: value0 })

  //
  // Thens
  //

  // Secret should be populated
  expect(secret.id).toBeDefined()
  expect(secret.name).toBe(secretName)

  // Secret should exist by id
  await expect(secrets.exists(client, { identifier: secret.id })).resolves.toBe(true)

  //
  // Whens
  //

  // I read secret value
  const value1 = await secrets.json(client, { secret })

  //
  // Thens
  //

  // value1 should equal value0
  expect(value1).toEqual(value0)

  //
  // Whens
  //

  // I update secret value
  const value2 = { x: randomString() }
  await secrets.put(client, { secret, value: value2 })

  // I read updated value
  const value3 = await secrets.json(client, { secret })

  //
  // Thens
  //

  // value3 should equal value2
  expect(value3).toEqual(value2)

  //
  // Whens
  //

  // I delete secret
  await secrets.delete(client, { secret })

  //
  // Thens
  //

  // Secret should not exist
  await expect(secrets.exists(client, { identifier: secret.id })).resolves.toBe(false)
})
```

## End-to-End Flows

Integration tests should verify the complete workflow — from input through processing to
all observable side effects. Check every external system the code touches.

```ts
test("collects PDFs from SFTP into storage and the OCR queue", async ({
  sftpClient,
  collectorClient,
  client,
  storageBucket,
  ocrQueue,
}) => {
  //
  // Givens
  //

  // I uploaded files to SFTP server
  await sftpClient.put(paths, { recurse: true })

  //
  // Whens
  //

  // I wait for collector to process files
  await expect.poll(() => processedCount(collectorClient), { timeout: 30_000 }).toBe(n)

  //
  // Thens
  //

  // Collector should have saved metadata to MongoDB
  await expect(findDocument(client, { organizationId, documentId })).resolves.toBeDefined()

  // Collector should have saved content to S3
  await expect(objects.exists(client, { bucket: storageBucket, key: contentKey })).resolves.toBe(
    true,
  )

  // Collector should have sent messages to queue
  const received = await messages.receive(client, { queue: ocrQueue })
  expect(received).toHaveLength(n)

  // Collector should have cleaned up files
  await expect(sftp.listPdfs({ sftp: sftpClient })).resolves.toHaveLength(0)
})
```

## Parameterized Testing

Use `test.for` when multiple scenarios share the same test logic but differ in inputs or
expected outputs. Prefer it over `test.each`: `test.for` passes the case as the first
argument and the **test context as the second**, so fixtures still work.

```ts
test.for(filenameGenerators)(
  "parses the timestamp encoded by $name",
  async ({ generate }, { fake }) => {
    //
    // Givens
    //

    // Random date time
    const dt0 = fake.date.anytime()

    // path encodes dt using filename generator
    const path = generate(fake, dt0)

    //
    // Whens
    //

    // I parse timestamp from path
    const dt1 = parseTimestamp(path)

    //
    // Thens
    //

    // dt1 should equal dt0 down to minute
    expect(toMinute(dt1)).toBe(toMinute(dt0))
  },
)
```

Vitest has no equivalent of pytest's parameterized fixtures, so an axis that pytest would
multiply transitively has to be made explicit. When a whole suite must run against several
backends, loop a `describe` and re-extend inside it:

```ts
for (const backend of ["sqlite", "postgres"] as const) {
  describe(backend, () => {
    const test = base.extend<{ db: Db }>({
      db: async ({}, use) => {
        const db = await makeDb(backend)
        await use(db)
        await db.close()
      },
    })

    test("stores and retrieves a record", async ({ db }) => {
      /* ... */
    })
  })
}
```

## Component Testing

The "real infrastructure over mocks" rule applies to the DOM too. jsdom and happy-dom are
simulations, and they get focus, layout, pointer events, and clipboard wrong in exactly the
ways that produce bugs users hit. Use **Browser Mode**, stable since Vitest 4, for anything
that renders.

- Install a provider explicitly: `@vitest/browser-playwright` (or `-webdriverio`, `-preview`),
  and import the provider function in config rather than naming it as a string.
- Import browser context from `vitest/browser`.
- Query by accessible role and name — `page.getByRole("button", { name: "Save" })` — never by
  class name or test id. Locators auto-retry, so this also removes most explicit waiting.
- Assert on what the user can observe. `toBeInViewport` and `toMatchScreenshot` cover the
  cases that plain DOM assertions can't.
- Enable Playwright's `trace` option in CI. A trace of the failing run is worth more than any
  amount of log archaeology on a flaky test.

Keep pure logic in a fast Node project and put anything that renders in a browser project.

## Test Naming

**File naming:** `<module>.test.ts`, placed in `packages/<package>/tests/` alongside the
package's fixtures. Files are kebab-case like all others.

**Test naming:** Describe the scenario and expected outcome, not just the function being
called. The name is a sentence completing "it..." — write it as one.

```ts no-check
// Good — describes the scenario
test("fails to look up an organization that does not exist", ...)
test("collects PDFs from SFTP into storage and the OCR queue", ...)
test("merges overlapping nested objects right-to-left", ...)

// Bad — too vague
test("organization", ...)
test("collector", ...)
test("works", ...)
```

## Flat Tests, Minimal Nesting

Use top-level `test` functions. Don't wrap tests in a `describe` just to group them — the
file name and the test names already say what they cover, and nesting adds indentation
without information. If you need visual grouping, use a comment header.

`describe` earns its place in exactly two cases: scoping a `test.override`, and the
parameterized-suite loop above. Both are structural, not decorative.

```ts
// Good — standalone tests
test("rate limiter allows requests within budget", async ({ limiter }) => {
  /* ... */
})

test("rate limiter rejects requests over budget", async ({ limiter }) => {
  /* ... */
})

// Bad — unnecessary describe wrapper
describe("RateLimiter", () => {
  test("allows within budget", async ({ limiter }) => {
    /* ... */
  })
})
```

## Configuration

Defaults that make the rules above enforceable rather than aspirational:

```ts
export default defineConfig({
  test: {
    restoreMocks: true, // spies never leak between tests
    unstubEnvs: true,
    unstubGlobals: true,
    projects: [
      { test: { name: "unit", environment: "node", include: ["packages/*/tests/**/*.test.ts"] } },
      {
        test: { name: "browser", browser: { enabled: true, instances: [{ browser: "chromium" }] } },
      },
    ],
    coverage: {
      include: ["packages/*/src/**"], // required in v4; without it untested files are invisible
    },
  },
})
```

**Never set `globals: true`.** Import `test` from your fixture ladder and `expect` from
`vitest` explicitly. The import line is what tells a reader which fixtures a file has, and
globals throw that away along with the type safety.

Two more, for suites that grow: `sequence.shuffle` with a recorded `sequence.seed` flushes
out order dependence, and `isolate: false` is the single biggest speedup available — safe
for pure-logic projects with no global state, dangerous anywhere else, and configurable per
project.

## Anti-Patterns

Avoid these common mistakes:

**Skipping the structure** — bare tests without Given-When-Then are hard to maintain:

```ts
// Bad
test("something", async () => {
  const result = await fn()
  expect(result).toBe(expected)
})
```

**Comments that restate the code** — add no value:

```ts
// Bad
// Call getOrganizationName
const name = await getOrganizationName(client, { organizationId })
```

**Mocking internal infrastructure** — tests mocks instead of real behavior:

```ts
// Bad
vi.mock("../src/platform/documents/mongodb")
```

**Sleeping instead of polling** — flaky on a slow CI runner, slow everywhere else:

```ts
// Bad
await new Promise((resolve) => setTimeout(resolve, 2_000))

// Good
await expect.poll(() => processedCount(client)).toBe(n)
```

**Snapshots as a substitute for assertions** — a snapshot records what the code does, not
what it should do, so it agrees with whatever bug you just introduced and gets regenerated
without review. Assert on the specific fields the behavior is about. Where a snapshot is
genuinely the right tool, prefer `toMatchInlineSnapshot` so the expected value sits in the
diff a reviewer reads.

**Non-destructured fixture context** — silently yields `undefined`:

```ts no-check
// Bad — db is never initialized
test("...", async (ctx) => { await ctx.db.query(...) })

// Good
test("...", async ({ db }) => { await db.query(...) })
```

**Vague variable names** — domain concepts make tests self-documenting:

```ts
// Bad
const x = await getData()

// Good
const organizationName = await getOrganizationName(client, { organizationId })
```

**Testing private implementation details** — test the public API instead:

```ts
// Bad
const result = internalHelper()

// Good
await saveDocument(client, { doc, content })
```

## Quick Checklist

Before submitting a test, verify:

- Written test-first and confirmed to fail before the code made it pass (Red → Green → Refactor)
- Top-level `test` functions, no decorative `describe` wrappers
- Uses Whens/Thens structure (Givens when there are preconditions)
- Includes narrative comments explaining what and why
- Uses fixtures for complex setup, imported from the fixture ladder
- Fixture context is destructured, and every fixture is in the type parameter
- Tests real infrastructure (not over-mocked); MSW at the network boundary where mocking is warranted
- Tests both success and error cases, asserting the specific error
- Cleans up resources after `use` in the fixture
- Waits by polling, never by sleeping
- Has a descriptive test name that reads as a sentence
- Variable names reflect domain concepts
- Verifies observable behavior, not implementation
- Can run in parallel with other tests (isolated)
- Uses async/await correctly throughout

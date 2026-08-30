import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test as base } from "vitest"

import { type Store, createStore, destroyStore } from "../../src/store.ts"

/**
 * The bottom rung of the ladder: a real store on a real temp directory.
 *
 * Setup runs before `use`, the test runs while `use` is awaited, and teardown
 * runs after — including when the test fails.
 */
export const test = base.extend<{ store: Store; key: string }>({
  // eslint-disable-next-line no-empty-pattern -- destructuring declares fixture deps
  store: async ({}, use) => {
    const store = await createStore(join(tmpdir(), `store-tests-${today()}-${randomUUID()}`))

    await use(store)

    await destroyStore(store)
  },

  // Unique per test, so tests sharing a store would still not collide.
  // eslint-disable-next-line no-empty-pattern -- destructuring declares fixture deps
  key: async ({}, use) => {
    await use(`key-${randomUUID()}`)
  },
})

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Stand-in for the `tests/fixtures/platform.ts` rung that the fixture-ladder
 * examples import from. Only exists so those blocks resolve.
 */
import { test as base } from "vitest"

export const test = base.extend<{ client: PlatformClient }>({
  // eslint-disable-next-line no-empty-pattern -- destructuring declares fixture deps
  client: async ({}, use) => {
    await use(await createPlatformClient())
  },
})

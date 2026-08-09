import { expect } from "vitest"

import { KeyNotFoundError, exists, get, list, parseKey, put, remove } from "../src/store.ts"
import { test } from "./fixtures/store.ts"

test("creates, reads, updates, and deletes a record", async ({ store, key }) => {
  //
  // Givens
  //

  // Random value
  const value0 = `value-${Math.random().toString(36).slice(2)}`

  //
  // Whens
  //

  // I put a record
  await put(store, { key, value: value0 })

  //
  // Thens
  //

  // Record should exist
  await expect(exists(store, { key })).resolves.toBe(true)

  //
  // Whens
  //

  // I read the value back
  const value1 = await get(store, { key })

  //
  // Thens
  //

  // value1 should equal value0
  expect(value1).toBe(value0)

  //
  // Whens
  //

  // I overwrite the value
  const value2 = `value-${Math.random().toString(36).slice(2)}`
  await put(store, { key, value: value2 })

  // I read the updated value
  const value3 = await get(store, { key })

  //
  // Thens
  //

  // value3 should equal value2
  expect(value3).toBe(value2)

  //
  // Whens
  //

  // I remove the record
  await remove(store, { key })

  //
  // Thens
  //

  // Record should not exist
  await expect(exists(store, { key })).resolves.toBe(false)
})

test("fails to read a key that was never written", async ({ store, key }) => {
  //
  // Whens / Thens
  //

  // I read a missing key, it should fail
  await expect(get(store, { key })).rejects.toThrow(KeyNotFoundError)
})

test("starts empty, because each test gets its own store", async ({ store }) => {
  //
  // Whens
  //

  // I list the keys in a freshly created store
  const keys = await list(store)

  //
  // Thens
  //

  // Store should be empty
  expect(keys).toHaveLength(0)
})

const invalidKeys = [
  { name: "an empty string", raw: "", reason: "must not be empty" },
  { name: "an uppercase key", raw: "Key", reason: "must be lowercase alphanumeric or dashes" },
  { name: "a path traversal", raw: "../etc", reason: "must be lowercase alphanumeric or dashes" },
  { name: "a leading dash", raw: "-key", reason: "must be lowercase alphanumeric or dashes" },
]

test.for(invalidKeys)("rejects $name", ({ raw, reason }) => {
  //
  // Whens
  //

  // I parse an invalid key
  const result = parseKey(raw)

  //
  // Thens
  //

  // Parse should fail, and say why
  expect(result.ok).toBe(false)
  expect(result).toMatchObject({ error: { name: "InvalidKeyError" } })
  if (!result.ok) {
    expect(result.error.message).toContain(reason)
  }
})

test("accepts a well-formed key", () => {
  //
  // Whens
  //

  // I parse a valid key
  const result = parseKey("orders-2026-01")

  //
  // Thens
  //

  // Parse should succeed with the key unchanged
  expect(result).toEqual({ ok: true, value: "orders-2026-01" })
})

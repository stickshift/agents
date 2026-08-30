import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

/** A key/value store backed by a real directory on disk. */
export type Store = {
  readonly root: string
}

export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

export class KeyNotFoundError extends Error {
  constructor(key: string) {
    super(`No record for key: ${key}`)
    this.name = "KeyNotFoundError"
  }
}

export class InvalidKeyError extends Error {
  constructor(key: string, reason: string) {
    super(`Invalid key ${JSON.stringify(key)}: ${reason}`)
    this.name = "InvalidKeyError"
  }
}

const keyPattern = /^[a-z0-9][a-z0-9-]*$/

/**
 * Validate an untrusted key.
 *
 * A bad key is something a caller is expected to handle, so it comes back in the
 * return type rather than as an exception.
 */
export function parseKey(raw: string): Result<string, InvalidKeyError> {
  if (raw.length === 0) {
    return { ok: false, error: new InvalidKeyError(raw, "must not be empty") }
  }

  if (raw.length > 64) {
    return { ok: false, error: new InvalidKeyError(raw, "must be at most 64 characters") }
  }

  if (!keyPattern.test(raw)) {
    return {
      ok: false,
      error: new InvalidKeyError(raw, "must be lowercase alphanumeric or dashes"),
    }
  }

  return { ok: true, value: raw }
}

export async function createStore(root: string): Promise<Store> {
  await mkdir(root, { recursive: true })
  return { root }
}

export async function destroyStore(store: Store): Promise<void> {
  await rm(store.root, { recursive: true, force: true })
}

export async function put(store: Store, options: { key: string; value: string }): Promise<void> {
  const key = unwrapKey(options.key)
  await writeFile(join(store.root, key), options.value, "utf8")
}

/** Read a value. A missing key is a caller bug here, so it throws. */
export async function get(store: Store, options: { key: string }): Promise<string> {
  const key = unwrapKey(options.key)

  try {
    return await readFile(join(store.root, key), "utf8")
  } catch (error) {
    if (isNotFound(error)) {
      throw new KeyNotFoundError(key)
    }
    throw error
  }
}

export async function exists(store: Store, options: { key: string }): Promise<boolean> {
  const keys = await list(store)
  return keys.includes(unwrapKey(options.key))
}

export async function list(store: Store): Promise<readonly string[]> {
  const entries = await readdir(store.root)
  return entries.toSorted()
}

export async function remove(store: Store, options: { key: string }): Promise<void> {
  const key = unwrapKey(options.key)

  try {
    await rm(join(store.root, key))
  } catch (error) {
    if (isNotFound(error)) {
      throw new KeyNotFoundError(key)
    }
    throw error
  }
}

function unwrapKey(raw: string): string {
  const parsed = parseKey(raw)
  if (!parsed.ok) {
    throw parsed.error
  }
  return parsed.value
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

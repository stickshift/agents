/**
 * Declarations for the fictional APIs the skill docs use in examples.
 *
 * The examples are written for readability, not for this file — when a new one
 * refers to something that isn't here, add it here rather than bending the
 * example. Nothing in this file ships; it exists only so `npm run check:docs`
 * can type-check the examples.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

type User = { readonly id: string; readonly name: string; readonly email: string }
type Db = { query(sql: string): Promise<readonly unknown[]>; close(): Promise<void> }
type Secret = { readonly id: string; readonly name: string }
type Queue = { readonly name: string }
type Bucket = { readonly name: string }
type Document = { readonly id: string; readonly value: string }
type Metrics = { record(name: string): void }
type Config = { readonly port: number; readonly host: string }

type PlatformClient = { readonly endpoint: string }
type HttpClient = { get(path: string): Promise<unknown> }

type SftpClient = {
  put(source: readonly string[] | string, target?: string | { recurse?: boolean }): Promise<void>
  exists(path: string): Promise<boolean>
  end(): Promise<void>
}

type SftpConnection = {
  startSftpClient(): Promise<SftpClient>
  close(): Promise<void>
}

// ---------------------------------------------------------------------------
// Fictional SDK
// ---------------------------------------------------------------------------

declare const secrets: {
  create(c: PlatformClient, o: { name: string; value: unknown }): Promise<Secret>
  json(c: PlatformClient, o: { secret: Secret }): Promise<Record<string, unknown>>
  put(c: PlatformClient, o: { secret: Secret; value: unknown }): Promise<void>
  delete(c: PlatformClient, o: { secret: Secret }): Promise<void>
  exists(c: PlatformClient, o: { identifier: string }): Promise<boolean>
}

declare const messages: {
  createQueue(c: PlatformClient, o: { name: string }): Promise<Queue>
  deleteQueue(c: PlatformClient, o: { queue: Queue }): Promise<void>
  receive(c: PlatformClient, o: { queue: Queue }): Promise<readonly unknown[]>
}

declare const objects: {
  exists(c: PlatformClient, o: { bucket: Bucket; key: string }): Promise<boolean>
}

declare const sftp: {
  listPdfs(o: { sftp: SftpClient }): Promise<readonly string[]>
}

declare function getOrganizationName(
  c: PlatformClient,
  o: { organizationId: string },
): Promise<string>
declare function findDocument(
  c: PlatformClient,
  o: { organizationId: string; documentId: string },
): Promise<Document | undefined>
declare function processedCount(c: unknown): Promise<number>
declare function saveDocument(
  c: PlatformClient,
  o: { doc: Document; content: string },
): Promise<void>
declare function connect(options: unknown): Promise<SftpConnection>
declare function createPlatformClient(): Promise<PlatformClient>
declare function makeDb(backend?: string): Promise<Db>
declare function readOnlyClient(): Promise<PlatformClient>
declare function internalHelper(): unknown
declare function getData(): Promise<unknown>

declare class NotFoundError extends Error {}
declare class ValidationError extends Error {}

// Expected-failure return shape used by the style guide.
type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E }

declare function parseWebhook(body: unknown): Result<Document, ValidationError>

// ---------------------------------------------------------------------------
// Test helpers and loose bindings the prose examples assume are in scope
// ---------------------------------------------------------------------------

declare function randomString(): string
declare function randomUUID(): string
declare function today(): string
declare function toMinute(d: Date): string
declare function parseTimestamp(path: string): Date

type Faker = { date: { anytime(): Date } }
type FilenameCase = { readonly name: string; readonly generate: (f: Faker, d: Date) => string }
declare const filenameGenerators: readonly FilenameCase[]

declare const client: PlatformClient
declare const collectorClient: HttpClient
declare const sftpClient: SftpClient
declare const storageBucket: Bucket
declare const ocrQueue: Queue
declare const organizationId: string
declare const documentId: string
declare const contentKey: string
declare const secretName: string
declare const localPath: string
declare const remotePath: string
declare const paths: readonly string[]
declare const n: number
declare const body: unknown
declare const limiter: unknown
declare const options: unknown
declare const doc: Document
declare const content: string
declare const expected: unknown
declare function fn(): Promise<unknown>

// ---------------------------------------------------------------------------
// Test API
//
// The examples destructure fixtures without showing the `test.extend` that
// defines them, so the ambient `test` is pre-extended with every fixture the
// docs use. `base` is the un-extended one, for examples that build a ladder.
// ---------------------------------------------------------------------------

type DocFixtures = {
  client: PlatformClient
  collectorClient: HttpClient
  config: Config
  db: Db
  fake: Faker
  key: string
  limiter: unknown
  metrics: Metrics
  ocrQueue: Queue
  secretName: string
  sftpClient: SftpClient
  storageBucket: Bucket
  store: unknown
  tempQueue: Queue
  user: User
}

declare const test: import("vitest").TestAPI<DocFixtures>
declare const base: import("vitest").TestAPI<object>
declare const describe: typeof import("vitest").describe
declare const expect: typeof import("vitest").expect
declare const vi: typeof import("vitest").vi
declare const beforeAll: typeof import("vitest").beforeAll
declare const beforeEach: typeof import("vitest").beforeEach
declare const onTestFinished: typeof import("vitest").onTestFinished
declare const defineConfig: typeof import("vitest/config").defineConfig

// ---------------------------------------------------------------------------
// Third-party stand-ins
// ---------------------------------------------------------------------------

declare namespace z {
  type Schema<T> = { readonly _output: T }
  // Indexed access rather than a conditional type: `infer` is a keyword, so an
  // alias by that name can't also use it.
  type infer<S extends Schema<unknown>> = S["_output"]
  function object<S extends Record<string, Schema<unknown>>>(
    shape: S,
  ): Schema<{ [K in keyof S]: S[K]["_output"] }>
  function string(): Schema<string> & { email(): Schema<string> }
}

declare const server: { use(...handlers: readonly unknown[]): void }
declare const http: { post(url: string, resolver: () => unknown): unknown }
declare const HttpResponse: { json(body: unknown): unknown }

declare const page: {
  getByRole(role: string, options?: { name?: string }): { click(): Promise<void> }
}

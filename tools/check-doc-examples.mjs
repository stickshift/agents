/**
 * Type-check the TypeScript examples embedded in skill docs.
 *
 * Every ```ts block is extracted into its own module and compiled against
 * `tools/doc-examples/ambient.d.ts`, which declares the fictional APIs the
 * examples refer to. Blocks that can't compile by design — anti-patterns,
 * fragments, snippets that are deliberately wrong — opt out by tagging the
 * fence:
 *
 *     ```ts no-check
 *
 * Run with `npm run check:docs`.
 */
import { execFileSync } from "node:child_process"
import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const supportDir = join(root, "tools", "doc-examples")
const outDir = join(root, "build", "doc-examples")

function markdownFiles(dir) {
  const found = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) found.push(...markdownFiles(path))
    else if (entry.endsWith(".md")) found.push(path)
  }
  return found
}

/** @returns {{ code: string, file: string, startLine: number }[]} */
function extractBlocks(file) {
  const lines = readFileSync(file, "utf8").split("\n")
  const blocks = []

  for (let i = 0; i < lines.length; i += 1) {
    const open = /^```ts(?<flags>[^\n]*)$/.exec(lines[i])
    if (!open) continue

    let j = i + 1
    while (j < lines.length && lines[j] !== "```") j += 1

    if (!open.groups.flags.includes("no-check")) {
      blocks.push({ code: lines.slice(i + 1, j).join("\n"), file, startLine: i + 2 })
    }
    i = j
  }

  return blocks
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
cpSync(join(supportDir, "ambient.d.ts"), join(outDir, "ambient.d.ts"))
cpSync(join(supportDir, "tsconfig.json"), join(outDir, "tsconfig.json"))
cpSync(join(supportDir, "platform.ts"), join(outDir, "platform.ts"))

const sources = new Map()
let total = 0

for (const file of markdownFiles(join(root, "plugins"))) {
  for (const block of extractBlocks(file)) {
    const name = `block-${String(total).padStart(3, "0")}.ts`
    // `export {}` forces module scope so declarations in separate blocks can't collide.
    writeFileSync(join(outDir, name), `${block.code}\nexport {}\n`)
    sources.set(name, block)
    total += 1
  }
}

let output = ""
try {
  execFileSync(
    join(root, "node_modules", ".bin", "tsc"),
    ["--noEmit", "-p", join(outDir, "tsconfig.json")],
    {
      encoding: "utf8",
    },
  )
} catch (error) {
  output = error.stdout ?? ""
}

if (output.trim() === "") {
  console.log(`doc examples: ${String(total)} blocks type-checked, no errors`)
  process.exit(0)
}

// Rewrite "block-007.ts(3,10): error ..." into a clickable source location.
const remapped = output
  .trimEnd()
  .split("\n")
  .map((line) => {
    const match = /(?<name>block-\d+\.ts)\((?<line>\d+),(?<col>\d+)\)(?<rest>.*)$/.exec(line)
    if (!match) return `  ${line}`
    const block = sources.get(match.groups.name)
    const sourceLine = block.startLine + Number(match.groups.line) - 1
    return `${relative(root, block.file)}:${String(sourceLine)}:${match.groups.col}${match.groups.rest}`
  })

console.error(`doc examples: ${String(total)} blocks checked, errors below\n`)
console.error(remapped.join("\n"))
process.exit(1)

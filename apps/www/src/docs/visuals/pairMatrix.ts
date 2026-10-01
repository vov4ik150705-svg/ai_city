import { plainText } from "../md/slug"
import type { Block } from "../md/types"
import { unsourcedLines } from "./stateLayout"

/**
 * Every pair of a fixed set, read from the section itself: named pairs from a table (such as synergy buildings),
 * the rest from the pairs its paragraphs write as `A + B`. Each pair must be covered exactly once.
 */
export type PairMatrix = {
  /** The set, in the order the handbook lists it. */
  readonly items: readonly string[]
  /** The table that names some pairs: its name column and its `A + B` column. */
  readonly table: { readonly name: string; readonly pair: string }
  /** What every pair the paragraphs list is called. */
  readonly other: string
  /** Placed after the `nth` block of this kind in the section, counting from 1. */
  readonly after: { readonly kind: Block["kind"]; readonly nth: number }
}

export type PairCell = { readonly label: string; readonly named: boolean }

export type PairResult = {
  /** `cells[i][j]` for `j > i`, empty elsewhere. */
  readonly cells: ReadonlyMap<string, PairCell>
  readonly problems: readonly string[]
}

export function pairKey(a: string, b: string): string {
  return `${a} + ${b}`
}

export function pairMatrix(blocks: readonly Block[], sectionText: string, spec: PairMatrix): PairResult {
  const problems: string[] = unsourcedLines([...spec.items, spec.other], sectionText).map((w) => `"${w}" is not in the section`)
  const order = (a: string, b: string): string | null => {
    const i = spec.items.indexOf(a)
    const j = spec.items.indexOf(b)
    if (i < 0 || j < 0 || i === j) return null
    return i < j ? pairKey(a, b) : pairKey(b, a)
  }
  const cells = new Map<string, PairCell>()

  const table = blocks.find(
    (block): block is Extract<Block, { kind: "table" }> =>
      block.kind === "table" && [spec.table.name, spec.table.pair].every((h) => block.head.some((cell) => plainText(cell).trim() === h)),
  )
  if (table === undefined) problems.push(`no table with columns "${spec.table.name}" and "${spec.table.pair}"`)
  else {
    const nameAt = table.head.findIndex((cell) => plainText(cell).trim() === spec.table.name)
    const pairAt = table.head.findIndex((cell) => plainText(cell).trim() === spec.table.pair)
    for (const row of table.rows) {
      const name = plainText(row[nameAt] ?? []).trim()
      const [a = "", b = "", ...more] = plainText(row[pairAt] ?? []).split("+").map((part) => part.trim())
      const key = more.length === 0 ? order(a, b) : null
      if (key === null) problems.push(`row ${name} doesn't name a pair of the set`)
      else if (cells.has(key)) problems.push(`pair ${key} is named twice`)
      else cells.set(key, { label: name, named: true })
    }
  }

  const alternatives = spec.items.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  const written = new RegExp(`\\b(${alternatives})\\s*\\+\\s*(${alternatives})\\b`, "g")
  const others = new Set<string>()
  for (const block of blocks) {
    if (block.kind !== "paragraph") continue
    for (const match of plainText(block.children).matchAll(written)) {
      const key = order(match[1] ?? "", match[2] ?? "")
      if (key !== null) others.add(key)
    }
  }
  for (const key of others) {
    if (cells.get(key)?.named === true) problems.push(`pair ${key} is both "${cells.get(key)?.label}" and ${spec.other}`)
    else cells.set(key, { label: spec.other, named: false })
  }

  spec.items.forEach((a, i) =>
    spec.items.slice(i + 1).forEach((b) => {
      if (!cells.has(pairKey(a, b))) problems.push(`pair ${pairKey(a, b)} is neither named nor ${spec.other}`)
    }),
  )
  return problems.length === 0 ? { cells, problems } : { cells: new Map(), problems }
}

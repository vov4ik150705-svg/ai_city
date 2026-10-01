import { plainText } from "./slug"
import type { Block } from "./types"

function blockText(block: Block): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
      return plainText(block.children)
    case "list":
      return block.items.map(plainText).join("\n")
    case "table":
      return [block.head, ...block.rows].map((row) => row.map(plainText).join(" | ")).join("\n")
    case "quote":
      return block.children.map(blockText).join("\n")
    case "math":
    case "code":
      return ""
    default: {
      const never: never = block
      throw new Error(`unknown block ${String(never)}`)
    }
  }
}

/** The blocks of each section, keyed by the id of its nearest heading, the heading itself included. */
export function sectionBlocksOf(blocks: readonly Block[]): ReadonlyMap<string, readonly Block[]> {
  const out = new Map<string, Block[]>()
  let section = ""
  for (const block of blocks) {
    if (block.kind === "heading") section = block.id
    const list = out.get(section) ?? []
    list.push(block)
    out.set(section, list)
  }
  return out
}

/** The prose of each section, keyed by the id of its nearest heading. Mermaid and TeX are not prose. */
export function sectionTexts(blocks: readonly Block[]): ReadonlyMap<string, string> {
  const texts = new Map<string, string>()
  let section = ""
  for (const block of blocks) {
    if (block.kind === "heading") section = block.id
    texts.set(section, `${texts.get(section) ?? ""}\n${blockText(block)}`)
  }
  return texts
}

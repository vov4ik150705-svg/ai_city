import type { Inline } from "./types"

export function plainText(nodes: readonly Inline[]): string {
  let out = ""
  for (const node of nodes) {
    switch (node.kind) {
      case "text":
      case "code":
      case "flag":
        out += node.value
        break
      case "math":
        out += node.tex
        break
      case "strong":
      case "link":
        out += plainText(node.children)
        break
      default: {
        const never: never = node
        throw new Error(`unknown inline ${String(never)}`)
      }
    }
  }
  return out
}

/** GitHub-style anchor: lower case, punctuation dropped, each space becomes a dash. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-")
}

export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>()
  return (text) => {
    const base = slugify(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    return count === 0 ? base : `${base}-${count}`
  }
}

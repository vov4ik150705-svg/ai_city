import type { Inline } from "./types"

const TERM_SEPARATOR = ": "
/** A variable name outside math is one short token, like `9,800`; anything longer is prose, not a term. */
const TERM_MAX = 12

export type Definition = { readonly term: readonly Inline[]; readonly meaning: readonly Inline[] }

/** Reads `$c$: meaning` or `9,800: meaning`. Returns null for an item that is prose. */
function definitionOf(item: readonly Inline[]): Definition | null {
  const at = item.findIndex((node) => node.kind === "text" && node.value.includes(TERM_SEPARATOR))
  const splitter = item[at]
  if (at < 0 || splitter?.kind !== "text") return null
  const cut = splitter.value.indexOf(TERM_SEPARATOR)
  const head = splitter.value.slice(0, cut)
  const tail = splitter.value.slice(cut + TERM_SEPARATOR.length)
  const term: Inline[] = [...item.slice(0, at), ...(head === "" ? [] : [{ kind: "text" as const, value: head }])]
  if (term.length === 0 || term.some((node) => node.kind !== "math" && node.kind !== "text")) return null
  const words = term.flatMap((node) => (node.kind === "text" ? [node.value] : [])).join("")
  if (/\s/.test(words) || words.length > TERM_MAX) return null
  const meaning: Inline[] = [...(tail === "" ? [] : [{ kind: "text" as const, value: tail }]), ...item.slice(at + 1)]
  return meaning.length === 0 ? null : { term, meaning }
}

/** A list that only defines symbols. One prose item keeps the whole list a list. */
export function definitionsOf(items: readonly (readonly Inline[])[]): readonly Definition[] | null {
  const definitions = items.map(definitionOf)
  return definitions.every((d): d is Definition => d !== null) ? definitions : null
}

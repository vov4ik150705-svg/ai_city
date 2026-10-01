import { plainText } from "./slug"
import type { Block, Inline } from "./types"

const QUESTION_END = "?"

export type Answered = { readonly question: readonly Inline[]; readonly answer: readonly Inline[] }

/** Reads `**Question?** answer`. Null when the bold lead-in doesn't ask, or nothing answers it. */
export function answeredOf(nodes: readonly Inline[]): Answered | null {
  const [first, next, ...tail] = nodes
  if (first?.kind !== "strong" || !plainText(first.children).trim().endsWith(QUESTION_END)) return null
  const lead = next?.kind === "text" ? next.value.trimStart() : null
  const answer: readonly Inline[] =
    next === undefined ? [] : lead === null ? [next, ...tail] : lead === "" ? tail : [{ kind: "text", value: lead }, ...tail]
  return plainText(answer).trim() === "" ? null : { question: first.children, answer }
}

function answeredAt(blocks: readonly Block[], index: number): Answered | null {
  const block = blocks[index]
  return block?.kind === "paragraph" ? answeredOf(block.children) : null
}

/** A question paragraph is a FAQ entry only beside another one; a lone bold question stays prose. */
export function faqEntryAt(blocks: readonly Block[], index: number): Answered | null {
  const own = answeredAt(blocks, index)
  if (own === null) return null
  return answeredAt(blocks, index - 1) !== null || answeredAt(blocks, index + 1) !== null ? own : null
}

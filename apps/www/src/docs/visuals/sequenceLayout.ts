import type { Message, Sequence } from "../mermaid/sequence"
import { ADVANCE, estimateWidth } from "./measure"

export const SEQUENCE = {
  width: 1160,
  side: 90,
  /** Left margin when phases are drawn: the phase names sit in it, left of the first lifeline. */
  gutter: 170,
  headY: 34,
  firstRow: 92,
  row: 44,
  phaseGap: 26,
  lineStep: 18,
  labelLift: 9,
  loop: 36,
  loopHalf: 13,
  loopText: 12,
  lifelineGap: 5,
  labelPad: 14,
} as const

/** Function calls and other exact identifiers stay in the mono face and never wrap. */
const CALL = /^[a-z]\w*\(.*\)$/

/** A named run of messages, from message index `from` to the next phase. */
export interface Phase {
  readonly label: string
  readonly from: number
}

export interface SequenceRow {
  readonly message: Message
  readonly y: number
  readonly from: number
  readonly to: number
  readonly mono: boolean
  readonly lines: readonly string[]
  /** Horizontal room the label was wrapped into. */
  readonly room: number
  readonly labelX: number
  /** Baseline of the label's first line. */
  readonly labelY: number
}

export interface PhaseMark {
  readonly label: string
  readonly number: number
  readonly y: number
}

export interface SequenceLayout {
  readonly width: number
  readonly height: number
  readonly columns: ReadonlyMap<string, number>
  readonly actorX: readonly number[]
  readonly rows: readonly SequenceRow[]
  readonly phases: readonly PhaseMark[]
}

/** Greedy wrap; only a last line of one hanging word is rebalanced, at the narrowest measure that keeps the line count. */
export function wrapLabel(text: string, room: number): string[] {
  const greedy = wrapGreedy(text, room)
  const last = greedy[greedy.length - 1]
  if (greedy.length < 2 || last === undefined || last.includes(" ")) return greedy
  for (let measure = estimateWidth(text, "note") / greedy.length; measure < room; measure += ADVANCE.note) {
    const lines = wrapGreedy(text, measure)
    if (lines.length === greedy.length) return lines
  }
  return greedy
}

function wrapGreedy(text: string, room: number): string[] {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(/\s+/).filter((part) => part !== "")) {
    const next = current === "" ? word : `${current} ${word}`
    if (current !== "" && estimateWidth(next, "note") > room) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current !== "") lines.push(current)
  return lines
}

/** Labels that overrun their room or lost words on the way through the wrap. */
export function unfitLabels(layout: SequenceLayout): string[] {
  const problems: string[] = []
  for (const row of layout.rows) {
    const text = row.message.text
    if (row.lines.join(" ") !== text.split(/\s+/).join(" ")) problems.push(`label "${text}" changed while wrapping`)
    for (const line of row.lines) {
      if (estimateWidth(line, row.mono ? "mono" : "note") > row.room) problems.push(`label "${line}" overruns its ${Math.round(row.room)}px room`)
    }
  }
  return problems
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** Everything that would make a phase name something its own messages don't say. Empty means they may be drawn. */
export function checkPhases(sequence: Sequence, phases: readonly Phase[]): string[] {
  const problems: string[] = []
  const count = sequence.messages.length
  phases.forEach((phase, index) => {
    const next = phases[index + 1]?.from ?? count
    if (index === 0 && phase.from !== 0) problems.push(`phase "${phase.label}" doesn't start at the first message`)
    if (phase.from >= next || phase.from >= count) {
      problems.push(`phase "${phase.label}" holds no messages`)
      return
    }
    const word = new RegExp(`\\b${escapeRegExp(phase.label)}\\b`, "i")
    const said = sequence.messages.slice(phase.from, next).some((message) => word.test(message.text))
    if (!said) problems.push(`phase "${phase.label}" is not said by its messages`)
  })
  return problems
}

export function layoutSequence(sequence: Sequence, phases: readonly Phase[] = []): SequenceLayout {
  const s = SEQUENCE
  const count = sequence.actors.length
  const left = phases.length > 0 ? s.gutter : s.side
  const step = count > 1 ? (s.width - left - s.side) / (count - 1) : 0
  const columns = new Map(sequence.actors.map((actor, index) => [actor.id, index]))
  const actorX = sequence.actors.map((_, index) => left + index * step)
  const xOf = (actorId: string) => actorX[columns.get(actorId) ?? 0] ?? left
  const starts = new Map(phases.map((phase, index) => [phase.from, { label: phase.label, number: index + 1 }]))

  const rows: SequenceRow[] = []
  const marks: PhaseMark[] = []
  let cursor = s.firstRow
  sequence.messages.forEach((message, index) => {
    const start = starts.get(index)
    if (start !== undefined && index > 0) cursor += s.phaseGap
    const from = xOf(message.from)
    const to = xOf(message.to)
    const mono = CALL.test(message.text)
    const self = message.from === message.to
    const dir = to >= from ? 1 : -1
    // A message that crosses other lifelines keeps its label in the sender's own gap, off those lines.
    const room = self ? step - s.loop - s.loopText - s.labelPad : Math.min(Math.abs(to - from), step) - s.labelPad * 2
    const labelX = self ? from : from + (dir * Math.min(Math.abs(to - from), step)) / 2
    const lines = mono ? [message.text] : wrapLabel(message.text, room)
    const lift = (lines.length - 1) * s.lineStep
    // A straight message stacks extra lines above its arrow; a loop centres them on itself.
    const y = self ? cursor + lift / 2 : cursor + lift
    const labelY = self ? y + 5 - lift / 2 : y - s.labelLift - lift
    rows.push({ message, y, from, to, mono, lines, room, labelX, labelY })
    if (start !== undefined) marks.push({ ...start, y: labelY })
    cursor += (self ? s.row + s.loopHalf : s.row) + lift
  })

  return { width: s.width, height: cursor, columns, actorX, rows, phases: marks }
}

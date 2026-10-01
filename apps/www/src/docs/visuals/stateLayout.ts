import type { StateChart } from "../mermaid/state"
import type { Pt } from "../sketch/pen"
import type { Box, LabelSpot } from "./flowLayout"
import { estimateWidth, type TextFace } from "./measure"

/** A state is a word on the sheet, not a box: the title, and an optional line under it. */
export type StateWord = {
  readonly x: number
  readonly y: number
  readonly title: string
  readonly sub?: { readonly text: string; readonly face: Extract<TextFace, "note" | "mono"> }
  /** A state that stops things until you act, drawn in the accent with an underline. */
  readonly hard?: true
}

export type StateTransition = {
  readonly from: string
  readonly to: string
  readonly points: readonly Pt[]
  readonly label: LabelSpot
  readonly lines: readonly string[]
}

export type SheetNote = { readonly spot: LabelSpot; readonly lines: readonly string[] }

/** Geometry plus words. Every word must be found in the section it illustrates. */
export type StateLayout = {
  readonly width: number
  readonly height: number
  readonly states: Readonly<Record<string, StateWord>>
  readonly transitions: readonly StateTransition[]
  readonly notes: readonly SheetNote[]
  /** Where the sheet begins: a dot on the first point, an arrow to the state. */
  readonly start?: { readonly state: string; readonly points: readonly Pt[] }
}

export const STATE_SHEET = {
  subDy: 24,
  lineStep: 18,
  capHeight: 17,
  descent: 6,
  /** An arrow stops short of its word, but close enough to read as touching it. */
  gapMin: 4,
  gapMax: 24,
} as const

export function wordBox(word: StateWord): Box {
  const s = STATE_SHEET
  const widths = [estimateWidth(word.title, "node")]
  if (word.sub !== undefined) widths.push(estimateWidth(word.sub.text, word.sub.face))
  const w = Math.max(...widths)
  const bottom = word.y + (word.sub === undefined ? 0 : s.subDy) + s.descent
  return { x: word.x - w / 2, y: word.y - s.capHeight, w, h: bottom - (word.y - s.capHeight) }
}

function gapTo(p: Pt, box: Box): number {
  const dx = Math.max(box.x - p.x, 0, p.x - (box.x + box.w))
  const dy = Math.max(box.y - p.y, 0, p.y - (box.y + box.h))
  return dx === 0 && dy === 0 ? 0 : Math.hypot(dx, dy)
}

export function checkStateLayout(layout: StateLayout): readonly string[] {
  const problems: string[] = []
  const s = STATE_SHEET
  const used = new Set<string>()
  for (const t of layout.transitions) {
    const key = `${t.from}>${t.to}`
    const from = layout.states[t.from]
    const to = layout.states[t.to]
    const start = t.points[0]
    const end = t.points[t.points.length - 1]
    if (from === undefined) problems.push(`transition ${key} leaves an unknown state`)
    if (to === undefined) problems.push(`transition ${key} enters an unknown state`)
    if (t.lines.length === 0) problems.push(`transition ${key} has no condition`)
    if (start === undefined || end === undefined || t.points.length < 2) {
      problems.push(`transition ${key} needs at least two points`)
      continue
    }
    used.add(t.from)
    used.add(t.to)
    for (const [label, point, word] of [
      ["start", start, from],
      ["end", end, to],
    ] as const) {
      if (word === undefined) continue
      const gap = gapTo(point, wordBox(word))
      if (gap < s.gapMin || gap > s.gapMax) problems.push(`transition ${key} doesn't ${label} beside its word (gap ${Math.round(gap)})`)
    }
  }
  if (layout.start !== undefined) {
    const word = layout.states[layout.start.state]
    const end = layout.start.points[layout.start.points.length - 1]
    if (word === undefined) problems.push(`the start points at an unknown state ${layout.start.state}`)
    else if (end === undefined || layout.start.points.length < 2) problems.push("the start needs at least two points")
    else {
      const gap = gapTo(end, wordBox(word))
      if (gap < s.gapMin || gap > s.gapMax) problems.push(`the start doesn't end beside its word (gap ${Math.round(gap)})`)
    }
  }
  for (const id of Object.keys(layout.states)) if (!used.has(id)) problems.push(`state ${id} has no transition`)
  return problems
}

/**
 * A layout drawn for a Mermaid state chart must say exactly what the chart says: the same states under the same
 * names, one arrow per transition whose lines read back as the chart's label, and the same start.
 */
export function checkStateChart(chart: StateChart, layout: StateLayout): readonly string[] {
  const problems: string[] = [...chart.problems]
  for (const state of chart.states) {
    const word = layout.states[state]
    if (word === undefined) problems.push(`state ${state} is not drawn`)
    else if (word.title !== state) problems.push(`state ${state} is titled "${word.title}"`)
  }
  for (const id of Object.keys(layout.states)) if (!chart.states.includes(id)) problems.push(`state ${id} is not in the source`)
  for (const edge of chart.edges) {
    const key = `${edge.from}>${edge.to}`
    const drawn = layout.transitions.filter((t) => t.from === edge.from && t.to === edge.to)
    if (drawn.length !== 1) problems.push(`transition ${key} is drawn ${drawn.length} times`)
    else if (drawn[0]?.lines.join(" ") !== edge.label) problems.push(`transition ${key} reads "${drawn[0]?.lines.join(" ")}", not "${edge.label}"`)
  }
  for (const t of layout.transitions) {
    if (!chart.edges.some((edge) => edge.from === t.from && edge.to === t.to)) problems.push(`transition ${t.from}>${t.to} is not in the source`)
  }
  if ((layout.start?.state ?? null) !== chart.start) problems.push(`the start is ${layout.start?.state ?? "missing"}, not ${chart.start ?? "missing"}`)
  return [...problems, ...checkStateLayout(layout)]
}

/** Sub lines and notes are not in a Mermaid chart; they are checked against the section's prose instead. */
export function chartExtraWords(layout: StateLayout): string[] {
  return [
    ...Object.values(layout.states).flatMap((state) => (state.sub === undefined ? [] : [state.sub.text])),
    ...layout.notes.flatMap((note) => note.lines),
  ]
}

export function sheetWords(layout: StateLayout): string[] {
  const words: string[] = []
  for (const state of Object.values(layout.states)) {
    words.push(state.title)
    if (state.sub !== undefined) words.push(state.sub.text)
  }
  for (const t of layout.transitions) words.push(...t.lines)
  for (const note of layout.notes) words.push(...note.lines)
  return words
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim()
}

/** Lines that the section's own text doesn't say, compared case- and whitespace-blind. */
export function unsourcedLines(lines: readonly string[], sectionText: string): string[] {
  const source = normalise(sectionText)
  return lines.filter((line) => !source.includes(normalise(line)))
}

/** Words on the sheet that the section's own text doesn't say. */
export function unsourcedWords(layout: StateLayout, sectionText: string): string[] {
  return unsourcedLines(sheetWords(layout), sectionText)
}

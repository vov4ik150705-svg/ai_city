import { parseFlowchart, type Flowchart } from "../mermaid/flowchart"
import { diagramKind, parseSequence, type Sequence } from "../mermaid/sequence"
import { checkLayout, type FlowLayout } from "./flowLayout"
import type { Block } from "../md/types"
import { economyValueFlow } from "./layouts/economyValueFlow"
import { economyVouchers } from "./layouts/economyVouchers"
import { indexCoreLoop } from "./layouts/indexCoreLoop"
import { protocolArchitecture } from "./layouts/protocolArchitecture"
import { checkDayLayout, dayWords, type DayLayout } from "./dayLayout"
import { cityBuildingStates } from "./layouts/cityBuildingStates"
import { cityDay } from "./layouts/cityDay"
import { checkPhases, type Phase } from "./sequenceLayout"
import { parseStateChart, type StateChart } from "../mermaid/state"
import { industriesStaking } from "./layouts/industriesStaking"
import { seasonsRanking } from "./layouts/seasonsRanking"
import { chartExtraWords, checkStateChart, checkStateLayout, sheetWords, unsourcedLines, type StateLayout } from "./stateLayout"
import type { PairMatrix } from "./pairMatrix"
import type { TablePivot } from "./tablePivot"

/** Bespoke layouts, keyed `chapter:section`. A flowchart without an entry here is not drawn yet. */
export const flowLayouts: Readonly<Record<string, FlowLayout>> = {
  "economy:how-value-moves": economyValueFlow,
  "index:the-core-loop": indexCoreLoop,
  "protocol:architecture": protocolArchitecture,
}

/** Phase names for a sequence, keyed `chapter:section`. Each name must be a word its own messages say. */
export const sequencePhases: Readonly<Record<string, readonly Phase[]>> = {
  "economy:depositing": [
    { label: "Review", from: 0 },
    { label: "Prepare", from: 3 },
    { label: "Deposit", from: 5 },
    { label: "Confirm", from: 8 },
  ],
}

/** Sheets drawn from a section's own prose, placed after the `nth` (default first) block of kind `after`. */
export type SectionVisual =
  | { readonly kind: "state"; readonly layout: StateLayout; readonly after: Block["kind"]; readonly nth?: number }
  | { readonly kind: "day"; readonly layout: DayLayout; readonly after: Block["kind"]; readonly nth?: number }

export const sectionVisuals: Readonly<Record<string, SectionVisual>> = {
  "economy:vouchers": { kind: "state", layout: economyVouchers, after: "list" },
  "city:building-states": { kind: "state", layout: cityBuildingStates, after: "list" },
  "city:city-time": { kind: "day", layout: cityDay, after: "list" },
  "seasons:ranking-and-prize-rank": { kind: "state", layout: seasonsRanking, after: "list", nth: 2 },
}

/** Tables that are also printed the other way round, right under themselves. One per section. */
export const tablePivots: Readonly<Record<string, TablePivot>> = {
  "agents:building-links": {
    by: "Raises",
    item: "Emitter",
    value: "Bonus",
    targets: ["Workshop", "Robotics Lab", "Flagship Store", "Retail Complex"],
    aliases: { "All four producers": ["Workshop", "Robotics Lab", "Flagship Store", "Retail Complex"] },
    head: ["Producer", "Emitter"],
  },
}

/** Every pair of a set, read from the section's table and paragraphs. One per section. */
export const pairMatrices: Readonly<Record<string, PairMatrix>> = {
  "industries:synergies-and-merges": {
    items: ["Compute", "Energy", "Logistics", "Consumer", "Automation", "Finance"],
    table: { name: "Synergy", pair: "Districts" },
    other: "merge",
    after: { kind: "paragraph", nth: 2 },
  },
}

/** Every line a section sheet writes. */
export function sectionVisualWords(visual: SectionVisual): string[] {
  switch (visual.kind) {
    case "state":
      return sheetWords(visual.layout)
    case "day":
      return dayWords(visual.layout)
    default: {
      const never: never = visual
      return never
    }
  }
}

/** Everything that would make a section sheet disagree with its section. Empty means it may be drawn. */
export function sectionVisualProblems(visual: SectionVisual, sectionText: string): readonly string[] {
  const shape = visual.kind === "state" ? checkStateLayout(visual.layout) : checkDayLayout(visual.layout)
  return [...shape, ...unsourcedLines(sectionVisualWords(visual), sectionText).map((words) => `"${words}" is not in the section`)]
}

/** Bespoke layouts for Mermaid state charts, keyed `chapter:section`. Without one the chart is not drawn yet. */
export const stateLayouts: Readonly<Record<string, StateLayout>> = {
  "industries:staking": industriesStaking,
}

export type DiagramPlan =
  | { readonly kind: "flow"; readonly chart: Flowchart; readonly layout: FlowLayout }
  | { readonly kind: "state"; readonly chart: StateChart; readonly layout: StateLayout }
  | {
      readonly kind: "sequence"
      readonly sequence: Sequence
      readonly phases: readonly Phase[]
      /** Why the registered phases were left off; the sequence is still drawn. */
      readonly phaseProblems: readonly string[]
    }
  | { readonly kind: "pending"; readonly problems: readonly string[] }

export function diagramKey(chapter: string, section: string): string {
  return `${chapter}:${section}`
}

/** `sectionText` checks the words a layout adds to its chart, such as a code under a state. */
export function planDiagram(key: string, source: string, sectionText = ""): DiagramPlan {
  const kind = diagramKind(source)
  if (kind === "stateDiagram-v2") {
    const layout = stateLayouts[key]
    if (layout === undefined) return { kind: "pending", problems: [] }
    const chart = parseStateChart(source)
    const problems = [
      ...checkStateChart(chart, layout),
      ...unsourcedLines(chartExtraWords(layout), sectionText).map((words) => `"${words}" is not in the section`),
    ]
    return problems.length === 0 ? { kind: "state", chart, layout } : { kind: "pending", problems }
  }
  if (kind === "sequenceDiagram") {
    const sequence = parseSequence(source)
    if (sequence.problems.length > 0) return { kind: "pending", problems: sequence.problems }
    const registered = sequencePhases[key] ?? []
    const phaseProblems = checkPhases(sequence, registered)
    return { kind: "sequence", sequence, phases: phaseProblems.length === 0 ? registered : [], phaseProblems }
  }
  if (kind === "flowchart") {
    const layout = flowLayouts[key]
    if (layout === undefined) return { kind: "pending", problems: [] }
    const chart = parseFlowchart(source)
    const problems = checkLayout(chart, layout)
    return problems.length === 0 ? { kind: "flow", chart, layout } : { kind: "pending", problems }
  }
  return { kind: "pending", problems: [] }
}

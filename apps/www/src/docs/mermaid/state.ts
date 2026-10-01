export type StateEdge = { readonly from: string; readonly to: string; readonly label: string }

export type StateChart = {
  readonly states: readonly string[]
  /** The state `[*]` points at, if the chart has one. */
  readonly start: string | null
  readonly edges: readonly StateEdge[]
  readonly problems: readonly string[]
}

const START = "[*]"

/** Reads the subset of `stateDiagram-v2` the handbook uses: `[*] --> A` and `A --> B: label`. */
export function parseStateChart(source: string): StateChart {
  const lines = source.split("\n").map((line) => line.trim())
  const problems: string[] = []
  if (lines[0] !== "stateDiagram-v2") problems.push("not a stateDiagram-v2")
  const states: string[] = []
  const edges: StateEdge[] = []
  let start: string | null = null
  const see = (id: string) => {
    if (id !== START && !states.includes(id)) states.push(id)
  }

  for (const line of lines.slice(1)) {
    if (line === "") continue
    const edge = /^(\[\*\]|\w+)\s*-->\s*(\w+)\s*(?::\s*(.+))?$/.exec(line)
    if (edge === null) {
      problems.push(`line not understood: ${line}`)
      continue
    }
    const [, from = "", to = "", label] = edge
    see(from)
    see(to)
    if (from === START) {
      if (start !== null) problems.push(`a second start: ${line}`)
      start = to
      continue
    }
    if (label === undefined) problems.push(`transition ${from}>${to} has no label`)
    edges.push({ from, to, label: (label ?? "").trim() })
  }
  return { states, start, edges, problems }
}

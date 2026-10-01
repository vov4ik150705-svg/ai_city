export type FlowNode = {
  readonly id: string
  readonly lines: readonly string[]
  readonly shape: "box" | "circle"
  readonly group: string | null
}

export type FlowEdge = {
  readonly from: string
  readonly to: string
  readonly lines: readonly string[]
  readonly both: boolean
}

export type FlowGroup = { readonly id: string; readonly label: string }

export type Flowchart = {
  readonly direction: string
  readonly groups: readonly FlowGroup[]
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
  readonly problems: readonly string[]
}

const NODE = String.raw`([A-Za-z]\w*)(?:\["([^"]+)"\]|\(\("([^"]+)"\)\))?`
const NODE_LINE = new RegExp(`^${NODE}$`)
const EDGE_LINE = new RegExp(`^${NODE}\\s*(?:--\\s*"([^"]+)"\\s*-->|(<-->)|-->)\\s*${NODE}$`)

export function labelLines(label: string): readonly string[] {
  return label.split(/<br\s*\/?>/).map((line) => line.trim())
}

export function edgeKey(from: string, to: string): string {
  return `${from}>${to}`
}

export function parseFlowchart(source: string): Flowchart {
  const lines = source.split("\n").map((line) => line.trim())
  const header = /^flowchart\s+(TB|TD|BT|LR|RL)$/.exec(lines[0] ?? "")
  const problems: string[] = []
  if (header === null) problems.push("not a flowchart")

  const groups: FlowGroup[] = []
  const nodes = new Map<string, FlowNode>()
  const edges: FlowEdge[] = []
  const stack: string[] = []

  const declare = (id: string, box: string | undefined, circle: string | undefined) => {
    const known = nodes.get(id)
    const label = box ?? circle
    if (known !== undefined && label === undefined) return
    if (known !== undefined) problems.push(`node ${id} declared twice`)
    nodes.set(id, {
      id,
      lines: labelLines(label ?? id),
      shape: circle === undefined ? "box" : "circle",
      group: stack[stack.length - 1] ?? null,
    })
  }

  for (const line of lines.slice(1)) {
    if (line === "") continue
    const group = /^subgraph\s+(\w+)\["([^"]+)"\]$/.exec(line)
    if (group !== null) {
      groups.push({ id: group[1] ?? "", label: group[2] ?? "" })
      stack.push(group[1] ?? "")
      continue
    }
    if (line === "end") {
      if (stack.pop() === undefined) problems.push("end without subgraph")
      continue
    }
    const edge = EDGE_LINE.exec(line)
    if (edge !== null) {
      const [, from = "", fromBox, fromCircle, label, both, to = "", toBox, toCircle] = edge
      declare(from, fromBox, fromCircle)
      declare(to, toBox, toCircle)
      edges.push({ from, to, lines: label === undefined ? [] : labelLines(label), both: both !== undefined })
      continue
    }
    const node = NODE_LINE.exec(line)
    if (node !== null) {
      declare(node[1] ?? "", node[2], node[3])
      continue
    }
    problems.push(`line not understood: ${line}`)
  }
  if (stack.length > 0) problems.push("subgraph not closed")

  return { direction: header?.[1] ?? "", groups, nodes: [...nodes.values()], edges, problems }
}

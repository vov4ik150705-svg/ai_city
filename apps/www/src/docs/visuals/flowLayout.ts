import { edgeKey, type Flowchart } from "../mermaid/flowchart"
import type { Pt } from "../sketch/pen"

export type Box = {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
  /** The node's lines are one phrase broken in two, not a title over a caption. */
  readonly phrase?: true
  /** The label reads `Name: what it does`; the name is the title and the rest its caption. */
  readonly caption?: true
}

export const CAPTION_SPLIT = ": "

/** A caption box's lines: the name, then what follows the colon, then any further lines. */
export function captionLines(lines: readonly string[]): readonly string[] | null {
  const [first = "", ...rest] = lines
  const at = first.indexOf(CAPTION_SPLIT)
  if (at <= 0) return null
  return [first.slice(0, at), first.slice(at + CAPTION_SPLIT.length), ...rest]
}

export type LabelSpot = { readonly x: number; readonly y: number; readonly anchor: "start" | "middle" | "end" }

export type Route = { readonly points: readonly Pt[]; readonly label?: LabelSpot }

export type Lane = { readonly group: string; readonly x: number; readonly y: number }

/** Geometry only. Every word on the drawing comes from the Mermaid source in the chapter. */
export type FlowLayout = {
  readonly width: number
  readonly height: number
  readonly lanes: readonly Lane[]
  readonly dividers: readonly { readonly from: Pt; readonly to: Pt }[]
  readonly nodes: Readonly<Record<string, Box>>
  readonly edges: Readonly<Record<string, Route>>
}

export const ATTACH_TOLERANCE = 3

function distanceToOutline(p: Pt, box: Box, circle: boolean): number {
  if (circle) {
    const rx = box.w / 2
    const ry = box.h / 2
    const dx = (p.x - (box.x + rx)) / rx
    const dy = (p.y - (box.y + ry)) / ry
    return Math.abs(Math.hypot(dx, dy) - 1) * Math.min(rx, ry)
  }
  const outside = Math.hypot(
    Math.max(box.x - p.x, 0, p.x - (box.x + box.w)),
    Math.max(box.y - p.y, 0, p.y - (box.y + box.h)),
  )
  if (outside > 0) return outside
  return Math.min(p.x - box.x, box.x + box.w - p.x, p.y - box.y, box.y + box.h - p.y)
}

/** Everything that would make the drawing disagree with the source. Empty means it may be drawn. */
export function checkLayout(chart: Flowchart, layout: FlowLayout): readonly string[] {
  const problems: string[] = [...chart.problems]
  const nodeIds = new Set(chart.nodes.map((node) => node.id))
  for (const node of chart.nodes) {
    const box = layout.nodes[node.id]
    if (box === undefined) problems.push(`node ${node.id} has no box`)
    else if (box.caption === true && captionLines(node.lines) === null) problems.push(`node ${node.id} has no "name: caption" label`)
  }
  for (const id of Object.keys(layout.nodes)) if (!nodeIds.has(id)) problems.push(`box ${id} is not in the source`)

  const groupIds = new Set(chart.groups.map((group) => group.id))
  for (const group of chart.groups) {
    if (!layout.lanes.some((lane) => lane.group === group.id)) problems.push(`group ${group.id} has no lane`)
  }
  for (const lane of layout.lanes) if (!groupIds.has(lane.group)) problems.push(`lane ${lane.group} is not in the source`)

  const keys = new Set<string>()
  for (const edge of chart.edges) {
    const key = edgeKey(edge.from, edge.to)
    if (keys.has(key)) problems.push(`edge ${key} appears twice`)
    keys.add(key)
    const route = layout.edges[key]
    if (route === undefined) {
      problems.push(`edge ${key} has no route`)
      continue
    }
    if (edge.lines.length > 0 && route.label === undefined) problems.push(`edge ${key} has a label but no spot for it`)
    if (edge.lines.length === 0 && route.label !== undefined) problems.push(`edge ${key} has a label spot but no label`)
    const start = route.points[0]
    const end = route.points[route.points.length - 1]
    const fromBox = layout.nodes[edge.from]
    const toBox = layout.nodes[edge.to]
    if (start === undefined || end === undefined || route.points.length < 2) {
      problems.push(`edge ${key} needs at least two points`)
      continue
    }
    const circle = (id: string) => chart.nodes.find((node) => node.id === id)?.shape === "circle"
    if (fromBox !== undefined && distanceToOutline(start, fromBox, circle(edge.from)) > ATTACH_TOLERANCE) {
      problems.push(`edge ${key} doesn't start on ${edge.from}`)
    }
    if (toBox !== undefined && distanceToOutline(end, toBox, circle(edge.to)) > ATTACH_TOLERANCE) {
      problems.push(`edge ${key} doesn't end on ${edge.to}`)
    }
  }
  for (const key of Object.keys(layout.edges)) if (!keys.has(key)) problems.push(`route ${key} is not in the source`)
  return problems
}

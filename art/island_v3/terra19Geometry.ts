/** Broad Terra-19 XZ AABB proxy. No Y, no center-distance. Hard contact lives in map.ts. */

import { TERRA19_BLOB_REF, TERRA19_LANTERN_REFS, TERRA19_TREE_REFS } from "./terra19Decor.ts"

export type Terra19GeometryRole = "building" | "lamp" | "tree" | "blob" | "other"

export type Terra19GeometryCode = "geometry-building-overlap" | "geometry-decor-overlap"

export type Terra19XzBox = {
  readonly id: string
  readonly ref: string
  readonly role: Terra19GeometryRole
  readonly placementGroup: string
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export type Terra19GeometryIssue = {
  readonly level: "error" | "warning"
  readonly code: Terra19GeometryCode
  readonly message: string
  readonly id: string
  readonly otherId: string
}

export const TERRA19_GROUND_SLICE_Y = 2
export const TERRA19_XZ_GRID = 3

export function isTerra19GroveRole(role: Terra19GeometryRole): boolean {
  return role === "tree" || role === "blob"
}

export function sampleXzGrid3(box: {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}): readonly { readonly x: number; readonly z: number }[] {
  const last = TERRA19_XZ_GRID - 1
  const points: { readonly x: number; readonly z: number }[] = []
  let i = 0
  while (i < TERRA19_XZ_GRID) {
    const tx = last === 0 ? 0 : i / last
    let j = 0
    while (j < TERRA19_XZ_GRID) {
      const tz = last === 0 ? 0 : j / last
      points.push({
        x: box.minX + (box.maxX - box.minX) * tx,
        z: box.minZ + (box.maxZ - box.minZ) * tz,
      })
      j += 1
    }
    i += 1
  }
  return points
}

export function classifyTerra19GeometryRole(kind: string, ref: string): Terra19GeometryRole {
  if (kind === "building") return "building"
  if (TERRA19_LANTERN_REFS.has(ref)) return "lamp"
  if (TERRA19_TREE_REFS.has(ref)) return "tree"
  if (ref === TERRA19_BLOB_REF) return "blob"
  return "other"
}

export function xzRangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin < bMax && aMax > bMin
}

export function xzBoxesOverlap(a: Terra19XzBox, b: Terra19XzBox): boolean {
  return xzRangesOverlap(a.minX, a.maxX, b.minX, b.maxX) && xzRangesOverlap(a.minZ, a.maxZ, b.minZ, b.maxZ)
}

function pairIds(a: Terra19XzBox, b: Terra19XzBox): { id: string; otherId: string } {
  return a.id < b.id ? { id: a.id, otherId: b.id } : { id: b.id, otherId: a.id }
}

function buildingIssue(decor: Terra19XzBox, building: Terra19XzBox): Terra19GeometryIssue {
  return {
    level: "warning",
    code: "geometry-building-overlap",
    message: "geometry-building-overlap " + decor.id + " × " + building.id,
    id: decor.id,
    otherId: building.id,
  }
}

function decorIssue(a: Terra19XzBox, b: Terra19XzBox): Terra19GeometryIssue {
  const ids = pairIds(a, b)
  return {
    level: "warning",
    code: "geometry-decor-overlap",
    message: "geometry-decor-overlap " + ids.id + " × " + ids.otherId,
    id: ids.id,
    otherId: ids.otherId,
  }
}

export function auditTerra19Geometry(boxes: readonly Terra19XzBox[]): readonly Terra19GeometryIssue[] {
  const issues: Terra19GeometryIssue[] = []
  const seen = new Set<string>()
  function push(issue: Terra19GeometryIssue): void {
    const key = issue.code + ":" + issue.id + ":" + issue.otherId
    if (seen.has(key)) return
    seen.add(key)
    issues.push(issue)
  }

  let i = 0
  while (i < boxes.length) {
    const a = boxes[i]
    i += 1
    if (a === undefined) continue
    let j = i
    while (j < boxes.length) {
      const b = boxes[j]
      j += 1
      if (b === undefined) continue
      if (!xzBoxesOverlap(a, b)) continue
      if (isTerra19GroveRole(a.role) && isTerra19GroveRole(b.role) && a.placementGroup === b.placementGroup) continue
      if (a.role === "building" && b.role !== "building") {
        push(buildingIssue(b, a))
        continue
      }
      if (b.role === "building" && a.role !== "building") {
        push(buildingIssue(a, b))
        continue
      }
      const lampVsGrove =
        (a.role === "lamp" && isTerra19GroveRole(b.role)) || (b.role === "lamp" && isTerra19GroveRole(a.role))
      if (lampVsGrove && a.placementGroup !== b.placementGroup) push(decorIssue(a, b))
    }
  }
  return issues
}

function previewIssues(issues: readonly Terra19GeometryIssue[]): string {
  return (
    issues
      .slice(0, 6)
      .map((row) => row.message)
      .join("; ") + (issues.length > 6 ? "…" : "")
  )
}

export function asHardGeometryIssue(issue: Terra19GeometryIssue): Terra19GeometryIssue {
  return {
    level: "error",
    code: issue.code,
    message: issue.message,
    id: issue.id,
    otherId: issue.otherId,
  }
}

export function formatTerra19GeometryStatus(
  hard: readonly Terra19GeometryIssue[],
  proxy: readonly Terra19GeometryIssue[] = [],
): string {
  const hardBit =
    hard.length === 0 ? " · geometry ok" : " · geometry errors " + String(hard.length) + ": " + previewIssues(hard)
  if (proxy.length === 0) return hardBit
  return hardBit + " · proxy warnings " + String(proxy.length) + ": " + previewIssues(proxy)
}

import { tileCenter, type IsoPoint } from "./iso.js"

const CLIP = "rc~bdw"
const KEEP_NB = ".psk"
const KIND_BUILDING = "building"

export type MaskMap = readonly string[]

function cellAt(map: MaskMap, x: bigint, y: bigint): string {
  const yi = Number(y)
  const xi = Number(x)
  if (yi < 0 || yi >= map.length) return ""
  const row = map[yi]
  if (row === undefined || xi < 0 || xi >= row.length) return ""
  return row.charAt(xi)
}

function keyOf(p: IsoPoint): string {
  return `${p.x},${p.y}`
}

function occupiedSet(occupied: readonly IsoPoint[]): Set<string> {
  const out = new Set<string>()
  for (const p of occupied) out.add(keyOf(p))
  return out
}

function footprintTiles(tx: bigint, ty: bigint, cols: bigint, rows: bigint): readonly IsoPoint[] {
  const out: IsoPoint[] = []
  let dy = 0n
  while (dy < rows) {
    let dx = 0n
    while (dx < cols) {
      out.push({ x: tx + dx, y: ty + dy })
      dx += 1n
    }
    dy += 1n
  }
  return out
}

export function keepTiles(
  map: MaskMap,
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  occupied: readonly IsoPoint[] = [],
): readonly IsoPoint[] {
  const foot = footprintTiles(tx, ty, cols, rows)
  const seen = new Set<string>()
  const out: IsoPoint[] = []
  const add = (p: IsoPoint): void => {
    const k = keyOf(p)
    if (seen.has(k)) return
    seen.add(k)
    out.push(p)
  }
  for (const p of foot) add(p)
  const foreign = occupiedSet(occupied)
  for (const p of foot) foreign.delete(keyOf(p))
  const one = 1n
  const ortho: readonly IsoPoint[] = [
    { x: one, y: 0n },
    { x: 0n - one, y: 0n },
    { x: 0n, y: one },
    { x: 0n, y: 0n - one },
  ]
  for (const p of foot) {
    for (const d of ortho) {
      const n = { x: p.x + d.x, y: p.y + d.y }
      if (foreign.has(keyOf(n))) continue
      if (KEEP_NB.includes(cellAt(map, n.x, n.y))) add(n)
    }
  }
  return out
}

function diamondYSpan(
  px: bigint,
  tx: bigint,
  ty: bigint,
  tileW: bigint,
): { readonly y0: bigint; readonly y1: bigint } | undefined {
  const two = 1n + 1n
  const halfW = tileW / two
  const quarterH = halfW / two
  if (halfW === 0n || quarterH === 0n) return undefined
  const c = tileCenter(tx, ty, tileW)
  const dx = px >= c.x ? px - c.x : c.x - px
  if (dx > halfW) return undefined
  const yHalf = (quarterH * (halfW - dx)) / halfW
  return { y0: c.y - yHalf, y1: c.y + yHalf }
}

export function firstHitTile(
  px: bigint,
  py: bigint,
  map: MaskMap,
  tileW: bigint,
  scan: readonly IsoPoint[],
): IsoPoint | undefined {
  let found = false
  let bestY = 0n
  let bestDepth = 0n
  let best: IsoPoint = { x: 0n, y: 0n }
  for (const t of scan) {
    const span = diamondYSpan(px, t.x, t.y, tileW)
    if (span === undefined) continue
    if (py > span.y1) continue
    const hitY = py >= span.y0 ? py : span.y0
    const depth = t.x + t.y
    if (!found || hitY < bestY || (hitY === bestY && depth > bestDepth)) {
      found = true
      bestY = hitY
      bestDepth = depth
      best = t
    }
  }
  return found ? best : undefined
}

export function pixelKept(
  px: bigint,
  py: bigint,
  map: MaskMap,
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  tileW: bigint,
  kind: string = "decor",
  occupied: readonly IsoPoint[] = [],
): boolean {
  if (kind === KIND_BUILDING) return true
  const keep = keepTiles(map, tx, ty, cols, rows, occupied)
  const hit = firstHitTile(px, py, map, tileW, keepScan(map, tx, ty, cols, rows, occupied))
  if (hit === undefined) return true
  for (const p of keep) {
    if (p.x === hit.x && p.y === hit.y) return true
  }
  const foreign = occupiedSet(occupied)
  if (foreign.has(keyOf(hit))) return false
  const ch = cellAt(map, hit.x, hit.y)
  if (ch.length === 1 && CLIP.includes(ch)) return false
  return true
}

export function keepScan(
  map: MaskMap,
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  occupied: readonly IsoPoint[] = [],
): readonly IsoPoint[] {
  const keep = keepTiles(map, tx, ty, cols, rows, occupied)
  const seen = new Set<string>()
  const out: IsoPoint[] = []
  const add = (p: IsoPoint): void => {
    const k = keyOf(p)
    if (seen.has(k)) return
    seen.add(k)
    out.push(p)
  }
  for (const p of keep) add(p)
  const one = 1n
  const ortho: readonly IsoPoint[] = [
    { x: one, y: 0n },
    { x: 0n - one, y: 0n },
    { x: 0n, y: one },
    { x: 0n, y: 0n - one },
  ]
  for (const p of keep) {
    for (const d of ortho) add({ x: p.x + d.x, y: p.y + d.y })
  }
  for (const p of occupied) add(p)
  return out
}

function diamondVerts(tx: bigint, ty: bigint, tileW: bigint): readonly IsoPoint[] {
  const two = 1n + 1n
  const halfW = tileW / two
  const quarterH = halfW / two
  const c = tileCenter(tx, ty, tileW)
  return [
    { x: c.x - halfW, y: c.y },
    { x: c.x, y: c.y - quarterH },
    { x: c.x + halfW, y: c.y },
    { x: c.x, y: c.y + quarterH },
  ]
}

/** Keep diamonds extruded upward by `lift`. Buildings are not masked. */
export function keepMaskGraphics(
  map: MaskMap,
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  tileW: bigint,
  lift: bigint,
  occupied: readonly IsoPoint[] = [],
): readonly (readonly number[])[] {
  const polys: number[][] = []
  const keep = keepTiles(map, tx, ty, cols, rows, occupied)
  for (const t of keep) {
    const v = diamondVerts(t.x, t.y, tileW)
    const i2 = 1 + 1
    const i3 = i2 + 1
    const left = v[0]
    const top = v[1]
    const right = v[i2]
    const bot = v[i3]
    if (left === undefined || top === undefined || right === undefined || bot === undefined) continue
    polys.push([
      Number(bot.x),
      Number(bot.y),
      Number(left.x),
      Number(left.y),
      Number(left.x),
      Number(left.y - lift),
      Number(top.x),
      Number(top.y - lift),
      Number(right.x),
      Number(right.y - lift),
      Number(right.x),
      Number(right.y),
    ])
  }
  return polys
}

export function maskColumn(
  mapped: { readonly kind: string },
  map: MaskMap,
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  occupied: readonly IsoPoint[] = [],
): boolean {
  return mapped.kind !== "building" && needsColumnMask(map, tx, ty, cols, rows, occupied)
}

export function needsColumnMask(
  map: MaskMap,
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  occupied: readonly IsoPoint[] = [],
): boolean {
  const foot = footprintTiles(tx, ty, cols, rows)
  const footKeys = new Set<string>()
  for (const p of foot) footKeys.add(keyOf(p))
  const foreign = occupiedSet(occupied)
  const one = 1n
  const ortho: readonly IsoPoint[] = [
    { x: one, y: 0n },
    { x: 0n - one, y: 0n },
    { x: 0n, y: one },
    { x: 0n, y: 0n - one },
  ]
  for (const p of foot) {
    for (const d of ortho) {
      const nx = p.x + d.x
      const ny = p.y + d.y
      const ch = cellAt(map, nx, ny)
      if (ch.length === 1 && CLIP.includes(ch)) return true
      const k = `${nx},${ny}`
      if (foreign.has(k) && !footKeys.has(k)) return true
    }
  }
  return false
}

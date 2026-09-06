import { frontVertex } from "./iso.js"
import type { SceneObject } from "./ground.js"

export type SpriteFrame = {
  readonly footX: bigint
  readonly footY: bigint
  readonly cols: bigint
  readonly rows: bigint
  readonly kind: string
  readonly w: bigint
  readonly h: bigint
}

export type AtlasFrame = SpriteFrame & {
  readonly x: bigint
  readonly y: bigint
}

export type OverlayRow = {
  readonly pips: bigint
  readonly antenna: bigint
  readonly depends: bigint
}

export type BadgeRow = {
  readonly code: string
  readonly kind: string
  readonly logOnly: bigint
}

export type Ranked = {
  readonly id: string
  readonly tileX: bigint
  readonly tileY: bigint
  readonly cols: bigint
  readonly rows: bigint
  readonly depth: bigint
  readonly tie: bigint
  readonly index: bigint
}

export type LabelBox = {
  readonly id: string
  readonly rank: bigint
  readonly depth: bigint
  readonly x: bigint
  readonly y: bigint
  readonly w: bigint
  readonly h: bigint
  readonly text: string
}

export type SceneMarker = {
  readonly sprite: string
  readonly tileX: bigint
  readonly tileY: bigint
}

export function cloudLift(id: string, tileW: bigint): bigint {
  return id.startsWith("cloud") ? tileW : 0n
}

export function painterDepth(tx: bigint, ty: bigint, cols: bigint, rows: bigint): bigint {
  return tx + cols - 1n + (ty + rows - 1n)
}

export function painterTie(tx: bigint): bigint {
  return tx
}

/** Packed instance size. w_px/h_px 0 keeps the atlas frame (R-V-60). */
export function instanceFoot(
  footX: bigint,
  footY: bigint,
  frameW: bigint,
  frameH: bigint,
  wPx: bigint,
  hPx: bigint,
): { readonly footX: bigint; readonly footY: bigint; readonly w: bigint; readonly h: bigint } {
  const w = wPx > 0n ? wPx : frameW
  const h = hPx > 0n ? hPx : frameH
  if (frameW <= 0n || frameH <= 0n) return { footX, footY, w, h }
  if (w === frameW && h === frameH) return { footX, footY, w, h }
  return {
    footX: (footX * w) / frameW,
    footY: (footY * h) / frameH,
    w,
    h,
  }
}

/** Horizontal mirror: foot X measured from the right edge (R-V-61). */
export function instanceFlip(footX: bigint, w: bigint, flip: bigint): bigint {
  if (flip !== 1n) return footX
  return w - footX
}

/** Sprite top-left. Same as scene.py: front vertex minus foot_anchor minus cube drop minus lift. */
export function spriteScreenPos(
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  tileW: bigint,
  cubeH: bigint,
  footX: bigint,
  footY: bigint,
  lift: bigint,
): { readonly x: bigint; readonly y: bigint } {
  const front = frontVertex(tx, ty, cols, rows, tileW)
  return {
    x: front.x - footX,
    y: front.y - footY - cubeH - lift,
  }
}

export function sortPlaced(
  objects: readonly SceneObject[],
  frames: { readonly [id: string]: SpriteFrame },
): readonly Ranked[] {
  const out: Ranked[] = []
  let index = 0n
  for (const obj of objects) {
    const fr = frames[obj.id]
    if (fr === undefined) continue
    const cols = fr.cols > 0n ? fr.cols : 1n
    const rows = fr.rows > 0n ? fr.rows : 1n
    out.push({
      id: obj.id,
      tileX: obj.tileX,
      tileY: obj.tileY,
      cols,
      rows,
      depth: painterDepth(obj.tileX, obj.tileY, cols, rows),
      tie: painterTie(obj.tileX),
      index,
    })
    index += 1n
  }
  return out.slice().sort((a, b) => {
    if (a.depth < b.depth) return -1
    if (a.depth > b.depth) return 1
    if (a.tie < b.tie) return -1
    if (a.tie > b.tie) return 1
    if (a.index < b.index) return -1
    if (a.index > b.index) return 1
    return 0
  })
}

export function overlayAt(
  level: bigint,
  rows: { readonly [lv: string]: OverlayRow },
): OverlayRow {
  const row = rows[level.toString()]
  if (row === undefined) return { pips: 0n, antenna: 0n, depends: 0n }
  return row
}

export function badgeKind(code: string): string {
  if (code === "IDLE_NO_ENERGY" || code === "IDLE_NO_COMPUTE") return "shortage"
  if (code === "IDLE_NO_AGENT") return "occupancy"
  if (code.startsWith("IDLE_")) return "idle"
  return "state"
}

export function badgeSprite(kind: string): string {
  if (kind === "shortage") return "badge_shortage"
  if (kind === "occupancy") return "badge_occupancy"
  return ""
}

export function badgeOnScene(code: string, badges: readonly BadgeRow[]): boolean {
  for (const row of badges) {
    if (row.code !== code) continue
    return row.logOnly === 0n
  }
  return false
}

export function objectIdle(kind: string, energy: bigint, compute: bigint): string {
  if (kind !== "building") return ""
  if (energy === 0n) return "IDLE_NO_ENERGY"
  if (compute === 0n) return "IDLE_NO_COMPUTE"
  return ""
}

export function labelsVisible(
  zoomNum: bigint,
  zoomDen: bigint,
  minNum: bigint,
  minDen: bigint,
): boolean {
  if (minNum <= 0n || minDen <= 0n) return false
  if (zoomDen <= 0n) return false
  return zoomNum * minDen >= minNum * zoomDen
}

export function labelRank(kind: string): bigint {
  switch (kind) {
    case "beacon":
      return 1n + 1n + 1n
    case "base":
      return 1n + 1n
    case "synergy":
      return 1n
    default:
      return 0n
  }
}

function aabbHits(a: LabelBox, b: LabelBox): boolean {
  if (a.x + a.w <= b.x) return false
  if (b.x + b.w <= a.x) return false
  if (a.y + a.h <= b.y) return false
  if (b.y + b.h <= a.y) return false
  return true
}

export function skipOverlappingLabels(boxes: readonly LabelBox[]): readonly string[] {
  const ranked = boxes.slice().sort((a, b) => {
    if (a.rank > b.rank) return -1
    if (a.rank < b.rank) return 1
    if (a.depth < b.depth) return -1
    if (a.depth > b.depth) return 1
    return 0
  })
  const kept: LabelBox[] = []
  const ids: string[] = []
  for (const box of ranked) {
    let hit = false
    for (const prev of kept) {
      if (aabbHits(box, prev)) {
        hit = true
        break
      }
    }
    if (hit) continue
    kept.push(box)
    ids.push(box.id)
  }
  return ids
}

export function badgePulseOn(cityTime: bigint, period: bigint): boolean {
  if (period <= 0n) return true
  const two = 1n + 1n
  return (cityTime / period) % two === 0n
}

export function pipWorldPos(
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  tileW: bigint,
  cubeH: bigint,
  step: bigint,
  offset: bigint,
  index: bigint,
): { readonly x: bigint; readonly y: bigint } {
  const front = frontVertex(tx, ty, cols, rows, tileW)
  return {
    x: front.x,
    y: front.y - cubeH - offset - index * step,
  }
}

export function sceneMarkers(
  objects: readonly SceneObject[],
  frames: { readonly [id: string]: SpriteFrame },
  energy: bigint,
  compute: bigint,
  badges: readonly BadgeRow[],
): readonly SceneMarker[] {
  const out: SceneMarker[] = []
  for (const obj of objects) {
    const fr = frames[obj.id]
    if (fr === undefined) continue
    const code = objectIdle(fr.kind, energy, compute)
    if (code.length === 0) continue
    if (!badgeOnScene(code, badges)) continue
    const sprite = badgeSprite(badgeKind(code))
    if (sprite.length === 0) continue
    out.push({ sprite, tileX: obj.tileX, tileY: obj.tileY })
  }
  return out
}

export function footprintDiamond(
  tx: bigint,
  ty: bigint,
  cols: bigint,
  rows: bigint,
  tileW: bigint,
  cubeH: bigint,
): readonly { readonly x: bigint; readonly y: bigint }[] {
  const front = frontVertex(tx, ty, cols, rows, tileW)
  const two = 1n + 1n
  const halfW = tileW / two
  const halfH = halfW / two
  const span = cols + rows
  const w = span * halfW
  const h = span * halfH
  const cx = front.x
  const cy = front.y - cubeH
  return [
    { x: cx - w / two, y: cy - h / two },
    { x: cx, y: cy - h },
    { x: cx + w / two, y: cy - h / two },
    { x: cx, y: cy },
  ]
}

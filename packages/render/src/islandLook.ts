/** Owner-accepted Terra look JSON. Geometry stays in art/; this file only parses. */

export type IslandLookKind = "building" | "decor"

export type IslandLookObject = {
  readonly id: string
  readonly kind: IslandLookKind
  readonly ref: string
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
  readonly scale: number
}

export type IslandLookCam = {
  readonly theta: number
  readonly phi: number
  readonly radius: number
  readonly tx: number
  readonly ty: number
  readonly tz: number
}

export type IslandLook = {
  readonly island: string
  readonly islandScaleX: number
  readonly islandScaleY: number
  readonly islandScaleZ: number
  readonly objects: readonly IslandLookObject[]
  readonly cam: IslandLookCam | null
  readonly envLookRev: number
}

const TWO = 1 + 1
const TEN = TWO * (TWO + TWO) + TWO
const RIGHT_ANGLE_DEG = (TEN - 1) * TEN
const STRAIGHT_ANGLE_DEG = RIGHT_ANGLE_DEG * TWO
const FULL_TURN_DEG = STRAIGHT_ANGLE_DEG * TWO

function finiteNum(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null
  return raw
}

function asRecord(raw: unknown): { readonly [k: string]: unknown } | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null
  return raw as { readonly [k: string]: unknown }
}

function parseKind(raw: unknown): IslandLookKind | null {
  if (raw === "building" || raw === "decor") return raw
  return null
}

function parseObject(raw: unknown): IslandLookObject | null {
  const row = asRecord(raw)
  if (row === null) return null
  const kind = parseKind(row.kind)
  const id = typeof row.id === "string" ? row.id : ""
  const ref = typeof row.ref === "string" ? row.ref : ""
  const x = finiteNum(row.x)
  const y = finiteNum(row.y)
  const z = finiteNum(row.z)
  const yaw = finiteNum(row.yaw)
  const scale = finiteNum(row.scale)
  if (kind === null || id.length === 0 || ref.length === 0) return null
  if (x === null || y === null || z === null || yaw === null || scale === null) return null
  if (scale <= 0) return null
  return { id, kind, ref, x, y, z, yaw, scale }
}

function parseCam(raw: unknown): IslandLookCam | null {
  const row = asRecord(raw)
  if (row === null) return null
  const theta = finiteNum(row.theta)
  const phi = finiteNum(row.phi)
  const radius = finiteNum(row.radius)
  const tx = finiteNum(row.tx)
  const ty = finiteNum(row.ty)
  const tz = finiteNum(row.tz)
  if (theta === null || phi === null || radius === null) return null
  if (tx === null || ty === null || tz === null) return null
  if (radius <= 0) return null
  return { theta, phi, radius, tx, ty, tz }
}

/** Studio polar φ is from +Y; client tilt is the same polar as elevation from horizon. */
export function lookCamOrbit(
  cam: IslandLookCam,
  spanBps: bigint,
): {
  readonly azimuthBps: bigint
  readonly tiltBps: bigint
  readonly distance: bigint
  readonly tx: number
  readonly ty: number
  readonly tz: number
} {
  const twoPi = Math.PI * TWO
  let theta = cam.theta % twoPi
  if (theta < 0) theta += twoPi
  const azimuthDeg = (theta / twoPi) * FULL_TURN_DEG
  const phiDeg = (cam.phi / Math.PI) * STRAIGHT_ANGLE_DEG
  const elevationDeg = RIGHT_ANGLE_DEG - phiDeg
  const azimuthBps = BigInt(Math.round((azimuthDeg / FULL_TURN_DEG) * Number(spanBps)))
  const polar = RIGHT_ANGLE_DEG - elevationDeg
  const tiltBps = BigInt(Math.round((polar / RIGHT_ANGLE_DEG) * Number(spanBps)))
  return {
    azimuthBps,
    tiltBps,
    distance: BigInt(Math.round(cam.radius)),
    tx: cam.tx,
    ty: cam.ty,
    tz: cam.tz,
  }
}

export function lookOrbitLimits(distance: bigint): { readonly min: bigint; readonly max: bigint } {
  const n = Number(distance)
  const minN = Math.max(1, Math.round(n * 0.25))
  const maxN = Math.max(minN + 1, Math.round(n * 8))
  return { min: BigInt(minN), max: BigInt(maxN) }
}

export function lookBuildingCount(look: IslandLook): number {
  let n = 0
  for (const row of look.objects) {
    if (row.kind === "building") n += 1
  }
  return n
}

export function parseIslandLook(raw: unknown): IslandLook | null {
  const row = asRecord(raw)
  if (row === null) return null
  const island = typeof row.island === "string" ? row.island : ""
  if (island !== "terra") return null
  const legacy = finiteNum(row.islandScale)
  const sx = finiteNum(row.islandScaleX) ?? legacy
  const sy = finiteNum(row.islandScaleY) ?? legacy
  const sz = finiteNum(row.islandScaleZ) ?? legacy
  if (sx === null || sy === null || sz === null) return null
  if (sx <= 0 || sy <= 0 || sz <= 0) return null
  if (!Array.isArray(row.objects)) return null
  const objects: IslandLookObject[] = []
  for (const item of row.objects) {
    const parsed = parseObject(item)
    if (parsed === null) return null
    objects.push(parsed)
  }
  const canon = asRecord(row.canon)
  const envLookRev = canon === null ? 0 : (finiteNum(canon.env_look_rev) ?? 0)
  return {
    island,
    islandScaleX: sx,
    islandScaleY: sy,
    islandScaleZ: sz,
    objects,
    cam: parseCam(row.cam),
    envLookRev,
  }
}

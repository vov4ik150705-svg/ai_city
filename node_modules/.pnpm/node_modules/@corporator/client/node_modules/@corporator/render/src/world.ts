import { loadScene } from "./ground.js"
import {
  dronePose,
  vehiclePose,
  type BlockRect,
  type DronePose,
  type DroneStart,
  type VehiclePose,
  type VehicleStart,
} from "./motion.js"

export type DecorKind = "lantern" | "furniture" | "plant" | "hull"

export type DecorRow = {
  readonly id: string
  readonly tileX: bigint
  readonly tileY: bigint
  readonly kind: DecorKind
}

export type WorldPos = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly yaw: number
}

/** Packed street props. Fillers and heroes are not decor. */
export function decorKind(id: string): DecorKind | "" {
  if (id.startsWith("lantern")) return "lantern"
  if (
    id.startsWith("bench") ||
    id.startsWith("trash") ||
    id.startsWith("planter") ||
    id.startsWith("phone") ||
    id.startsWith("traffic")
  ) {
    return "furniture"
  }
  if (id.startsWith("flower") || id.startsWith("bush") || id.startsWith("tree")) return "plant"
  if (id.startsWith("boat") || id.startsWith("buoy")) return "hull"
  return ""
}

export function isPackedDecor(id: string): boolean {
  return decorKind(id).length > 0
}

export function isPackedVehicle(id: string): boolean {
  return id === "vehicle" || id.startsWith("vehicle_")
}

export function isPackedDrone(id: string): boolean {
  return id === "drone" || id.startsWith("drone_")
}

/** Decor from generated.placement.scene. Instanced in the live frame, not leftover 1x1. */
export function plantDecor(root: unknown): readonly DecorRow[] {
  const scene = loadScene(root)
  const out: DecorRow[] = []
  for (const row of scene.objects) {
    const kind = decorKind(row.id)
    if (kind === "") continue
    out.push({ id: row.id, tileX: row.tileX, tileY: row.tileY, kind })
  }
  return out
}

export function decorOfKind(rows: readonly DecorRow[], kind: DecorKind): readonly DecorRow[] {
  const out: DecorRow[] = []
  for (const row of rows) {
    if (row.kind === kind) out.push(row)
  }
  return out
}

function lerpAxis(a: bigint, b: bigint, num: bigint, den: bigint): number {
  const d = den <= 0n ? 1n : den
  return Number(a) + (Number(b) - Number(a)) * (Number(num) / Number(d))
}

function heightY(landY: bigint, heightBps: bigint, gradeBps: bigint): number {
  const grade = gradeBps <= 0n ? 1n : gradeBps
  const h = Number(heightBps) / Number(grade)
  const two = 1 + 1
  return Number(landY) + h / two
}

export function vehicleWorldXZ(
  pose: VehiclePose,
  landY: bigint,
  heightBps: bigint,
  gradeBps: bigint,
): WorldPos {
  return {
    x: lerpAxis(pose.tileX, pose.nextX, pose.fracNum, pose.fracDen),
    y: heightY(landY, heightBps, gradeBps),
    z: lerpAxis(pose.tileY, pose.nextY, pose.fracNum, pose.fracDen),
    yaw: Math.atan2(Number(pose.dx), Number(pose.dy)),
  }
}

export function droneWorldXZ(
  pose: DronePose,
  landY: bigint,
  hoverBps: bigint,
  gradeBps: bigint,
  altPx: bigint,
): WorldPos {
  const grade = gradeBps <= 0n ? 1n : gradeBps
  const hover = Number(hoverBps) / Number(grade)
  const base = altPx <= 0n ? 1n : altPx
  return {
    x: lerpAxis(pose.tileX, pose.nextX, pose.fracNum, pose.fracDen),
    y: Number(landY) + (hover * Number(pose.altitude)) / Number(base),
    z: lerpAxis(pose.tileY, pose.nextY, pose.fracNum, pose.fracDen),
    yaw: 0,
  }
}

export function poseVehicle(
  map: readonly string[],
  start: VehicleStart,
  index: bigint,
  cityTime: bigint,
  minutesPerHour: bigint,
  speed: bigint,
  stride: bigint,
  byteCount: bigint,
  layoutSeed: string,
  landY: bigint,
  heightBps: bigint,
  gradeBps: bigint,
): WorldPos {
  const pose = vehiclePose(
    map,
    start,
    index,
    cityTime,
    minutesPerHour,
    speed,
    stride,
    byteCount,
    layoutSeed,
  )
  return vehicleWorldXZ(pose, landY, heightBps, gradeBps)
}

export function poseDrone(
  start: DroneStart,
  block: BlockRect | undefined,
  cityTime: bigint,
  minutesPerHour: bigint,
  speed: bigint,
  altPx: bigint,
  bobPx: bigint,
  bobPeriod: bigint,
  landY: bigint,
  hoverBps: bigint,
  gradeBps: bigint,
): WorldPos {
  const pose = dronePose(
    start,
    block,
    cityTime,
    minutesPerHour,
    speed,
    altPx,
    bobPx,
    bobPeriod,
  )
  return droneWorldXZ(pose, landY, hoverBps, gradeBps, altPx)
}

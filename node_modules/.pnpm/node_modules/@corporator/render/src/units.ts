import { loadScene } from "./ground.js"
import { cityMinutes, walkerFacing } from "./motion.js"

export type PackedUnit = {
  readonly id: string
  readonly tileX: bigint
  readonly tileY: bigint
}

export type UnitPos = {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** Walkers and robots from the pack legend. Vehicles and drones are world.ts. Not a hire roster. */
export function isPackedWalker(id: string): boolean {
  return id.startsWith("walker_") || id.startsWith("robot_")
}

/** Units from generated.placement.scene objects. Packed sidewalk crowd, not a hire roster. */
export function plantUnits(root: unknown): readonly PackedUnit[] {
  const scene = loadScene(root)
  const out: PackedUnit[] = []
  for (const row of scene.objects) {
    if (!isPackedWalker(row.id)) continue
    out.push({ id: row.id, tileX: row.tileX, tileY: row.tileY })
  }
  return out
}

/**
 * Triangle along the sidewalk heading, 0..span..0.
 * D-V3-7: pose is f(city_time). Not pathfinding, not a lootable mob.
 */
export function unitShiftBps(
  cityTime: bigint,
  minutesPerHour: bigint,
  periodMinutes: bigint,
  spanBps: bigint,
): bigint {
  const period = periodMinutes <= 0n ? 1n : periodMinutes
  const minutes = cityMinutes(cityTime, minutesPerHour)
  const cycle = period + period
  let t = minutes % cycle
  if (t < 0n) t += cycle
  const along = t < period ? t : cycle - t
  return (along * spanBps) / period
}

export function unitWorldPos(
  unit: PackedUnit,
  map: readonly string[],
  cityTime: bigint,
  landY: bigint,
  minutesPerHour: bigint,
  periodMinutes: bigint,
  spanBps: bigint,
  gradeBps: bigint,
  heightBps: bigint,
): UnitPos {
  const grade = gradeBps <= 0n ? 1n : gradeBps
  const shift = unitShiftBps(cityTime, minutesPerHour, periodMinutes, spanBps)
  const facing = walkerFacing(map, unit.tileX, unit.tileY)
  const step = Number(shift) / Number(grade)
  let dx = 0
  let dz = 0
  if (facing === "e") dx = step
  else if (facing === "w") dx = -step
  else if (facing === "s") dz = step
  else dz = -step
  const h = Number(heightBps) / Number(grade)
  const two = 1 + 1
  return {
    x: Number(unit.tileX) + dx,
    y: Number(landY) + h / two,
    z: Number(unit.tileY) + dz,
  }
}

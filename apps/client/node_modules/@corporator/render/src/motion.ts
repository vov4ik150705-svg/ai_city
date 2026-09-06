import { sha256, utf8 } from "@corporator/contentpack"
import { cellAt, isRoadCell } from "./ground.js"
import { tileCenter, type IsoPoint } from "./iso.js"

export type Dir = { readonly dx: bigint; readonly dy: bigint }

export type VehicleStart = {
  readonly x: bigint
  readonly y: bigint
}

export type DroneStart = {
  readonly x: bigint
  readonly y: bigint
  readonly blockId: bigint
}

export type BlockRect = {
  readonly west: bigint
  readonly north: bigint
  readonly east: bigint
  readonly south: bigint
}

export type VehiclePose = {
  readonly tileX: bigint
  readonly tileY: bigint
  readonly nextX: bigint
  readonly nextY: bigint
  readonly fracNum: bigint
  readonly fracDen: bigint
  readonly onRoad: boolean
  readonly dx: bigint
  readonly dy: bigint
}

export type DronePose = {
  readonly tileX: bigint
  readonly tileY: bigint
  readonly nextX: bigint
  readonly nextY: bigint
  readonly fracNum: bigint
  readonly fracDen: bigint
  readonly altitude: bigint
}

/**
 * Same eight-byte sha256 as content/world.py world_prng (TZ_RENDER §8, D-V-8).
 * byteCount is packed world_prng_bytes and is also the per-byte shift.
 */
export function worldPrng(
  cityId: string,
  stream: string,
  index: bigint,
  byteCount: bigint,
): bigint {
  const digest = sha256(utf8(`${cityId}:layout:${stream}:${index.toString()}`))
  let n = 0n
  let i = 0n
  while (i < byteCount) {
    const b = digest[Number(i)] ?? 0
    n = (n << byteCount) | BigInt(b)
    i += 1n
  }
  return n
}

export function isMotionUnit(id: string): boolean {
  return id === "vehicle" || id === "drone"
}

export function isBackgroundUnit(id: string): boolean {
  return isMotionUnit(id) || id.startsWith("walker_")
}

/** Heading from sidewalk/road neighbours. East/south keep the skin; west/north use `_w`. */
export function walkerFacing(map: readonly string[], tx: bigint, ty: bigint): string {
  const n = isWalkCell(map, tx, ty - 1n)
  const s = isWalkCell(map, tx, ty + 1n)
  const e = isWalkCell(map, tx + 1n, ty)
  const w = isWalkCell(map, tx - 1n, ty)
  const ns = n || s
  const ew = e || w
  const odd = (tx + ty) % (1n + 1n) === 1n
  if (ew && !ns) return odd ? "w" : "e"
  if (ns && !ew) return odd ? "n" : "s"
  if (ew) return odd ? "w" : "e"
  return "e"
}

export function walkerSpriteId(base: string, facing: string): string {
  if (facing === "w" || facing === "n") return `${base}_w`
  return base
}

function isWalkCell(map: readonly string[], x: bigint, y: bigint): boolean {
  const ch = cellAt(map, x, y)
  return ch === "s" || ch === "r" || ch === "c"
}

export function cityMinutes(cityTime: bigint, minutesPerHour: bigint): bigint {
  return cityTime * minutesPerHour
}

export function atlasFrame(cityTime: bigint, period: bigint, frames: bigint): bigint {
  if (frames <= 0n) return 0n
  const step = period <= 0n ? cityTime : cityTime / period
  const mod = step % frames
  if (mod < 0n) return mod + frames
  return mod
}

function pickId(ids: readonly string[], frame: bigint): string {
  if (ids.length === 0) return ""
  const n = BigInt(ids.length)
  let i = frame % n
  if (i < 0n) i += n
  return ids[Number(i)] ?? ""
}

export function smokeSpriteId(frame: bigint): string {
  return pickId(
    ["smoke", "smoke_02", "smoke_03", "smoke_04", "smoke_05", "smoke_06"],
    frame,
  )
}

export function turbineSpriteId(frame: bigint): string {
  return pickId(
    [
      "turbine_blade_0",
      "turbine_blade_1",
      "turbine_blade_2",
      "turbine_blade_3",
      "turbine_blade_4",
      "turbine_blade_5",
      "turbine_blade_6",
      "turbine_blade_7",
    ],
    frame,
  )
}

export function flagSpriteId(frame: bigint): string {
  return pickId(["flag_0", "flag_1", "flag_2", "flag_3"], frame)
}

export function billboardSpriteId(frame: bigint): string {
  return pickId(["billboard_0", "billboard_1", "billboard_2", "billboard_3"], frame)
}

export function waterfallSpriteId(frame: bigint): string {
  return pickId(["waterfall_0", "waterfall_1", "waterfall_2", "waterfall_3"], frame)
}

export function shoreWaveSpriteId(frame: bigint): string {
  return pickId(["shore_wave_0", "shore_wave_1", "shore_wave_2", "shore_wave_3"], frame)
}

export function droneBobSpriteId(frame: bigint): string {
  return pickId(["drone_bob_0", "drone_bob_1", "drone_bob_2", "drone_bob_3"], frame)
}

/** Heading from the last road step (TZ_ART §4.5). +x east, +y south. */
export function vehicleDirSprite(dx: bigint, dy: bigint): string {
  if (dx > 0n) return "vehicle_dir_e"
  if (dx < 0n) return "vehicle_dir_w"
  if (dy > 0n) return "vehicle_dir_s"
  if (dy < 0n) return "vehicle_dir_n"
  return "vehicle"
}

function cardinals(): readonly Dir[] {
  const one = 1n
  return [
    { dx: one, dy: 0n },
    { dx: -one, dy: 0n },
    { dx: 0n, dy: one },
    { dx: 0n, dy: -one },
  ]
}

export function roadDirs(
  map: readonly string[],
  x: bigint,
  y: bigint,
  prev: Dir,
): readonly Dir[] {
  const all: Dir[] = []
  for (const d of cardinals()) {
    if (isRoadCell(map, x + d.dx, y + d.dy)) all.push(d)
  }
  if (all.length === 0) return all
  const reverse: Dir[] = []
  const forward: Dir[] = []
  for (const d of all) {
    if (d.dx === -prev.dx && d.dy === -prev.dy) reverse.push(d)
    else forward.push(d)
  }
  if (forward.length > 0) return forward
  return reverse
}

function pickDir(
  cityId: string,
  index: bigint,
  step: bigint,
  stride: bigint,
  byteCount: bigint,
  dirs: readonly Dir[],
): Dir | undefined {
  if (dirs.length === 0) return undefined
  const n = BigInt(dirs.length)
  const slot = worldPrng(cityId, "vehicle", index * stride + step, byteCount) % n
  return dirs[Number(slot)]
}

function stepOnce(
  map: readonly string[],
  x: bigint,
  y: bigint,
  prev: Dir,
  cityId: string,
  index: bigint,
  step: bigint,
  stride: bigint,
  byteCount: bigint,
): { readonly x: bigint; readonly y: bigint; readonly prev: Dir } {
  const dirs = roadDirs(map, x, y, prev)
  const d = pickDir(cityId, index, step, stride, byteCount, dirs)
  if (d === undefined) return { x, y, prev }
  const nx = x + d.dx
  const ny = y + d.dy
  if (!isRoadCell(map, nx, ny)) return { x, y, prev }
  return { x: nx, y: ny, prev: d }
}

/**
 * Vehicle tile from city_time. Speed is tiles per city minute (TZ_RENDER §8.1).
 * frac is the leftover city minutes in the current tile.
 */
export function vehiclePose(
  map: readonly string[],
  start: VehicleStart,
  index: bigint,
  cityTime: bigint,
  minutesPerHour: bigint,
  speed: bigint,
  stride: bigint,
  byteCount: bigint,
  cityId: string,
): VehiclePose {
  const onRoad = isRoadCell(map, start.x, start.y)
  if (!onRoad || speed < 0n) {
    return {
      tileX: start.x,
      tileY: start.y,
      nextX: start.x,
      nextY: start.y,
      fracNum: 0n,
      fracDen: 1n,
      onRoad,
      dx: 0n,
      dy: 0n,
    }
  }
  const den = minutesPerHour <= 0n ? 1n : minutesPerHour
  const raw = cityMinutes(cityTime, den) * speed
  const tiles = raw / den
  const fracNum = raw % den
  let x = start.x
  let y = start.y
  let prev: Dir = { dx: 0n, dy: 0n }
  let step = 0n
  while (step < tiles) {
    const nxt = stepOnce(map, x, y, prev, cityId, index, step, stride, byteCount)
    x = nxt.x
    y = nxt.y
    prev = nxt.prev
    step += 1n
  }
  const look = stepOnce(map, x, y, prev, cityId, index, step, stride, byteCount)
  const moving = prev.dx !== 0n || prev.dy !== 0n
  return {
    tileX: x,
    tileY: y,
    nextX: look.x,
    nextY: look.y,
    fracNum,
    fracDen: den,
    onRoad: isRoadCell(map, x, y),
    dx: moving ? prev.dx : look.prev.dx,
    dy: moving ? prev.dy : look.prev.dy,
  }
}

export function lerpIso(a: IsoPoint, b: IsoPoint, num: bigint, den: bigint): IsoPoint {
  if (den <= 0n) return a
  return {
    x: a.x + ((b.x - a.x) * num) / den,
    y: a.y + ((b.y - a.y) * num) / den,
  }
}

export function vehicleWorldPos(pose: VehiclePose, tileW: bigint): IsoPoint {
  const a = tileCenter(pose.tileX, pose.tileY, tileW)
  const b = tileCenter(pose.nextX, pose.nextY, tileW)
  return lerpIso(a, b, pose.fracNum, pose.fracDen)
}

function perimeterLen(block: BlockRect): bigint {
  const w = block.east - block.west
  const h = block.south - block.north
  if (w < 0n || h < 0n) return 0n
  const two = 1n + 1n
  return (w + h) * two
}

function perimeterAt(block: BlockRect, dist: bigint): { readonly x: bigint; readonly y: bigint } {
  const w = block.east - block.west
  const h = block.south - block.north
  const two = 1n + 1n
  const len = (w + h) * two
  if (len <= 0n) return { x: block.west, y: block.north }
  let t = dist % len
  if (t < 0n) t += len
  if (t <= w) return { x: block.west + t, y: block.north }
  t -= w
  if (t <= h) return { x: block.east, y: block.north + t }
  t -= h
  if (t <= w) return { x: block.east - t, y: block.south }
  t -= w
  return { x: block.west, y: block.south - t }
}

function triangleBob(minutes: bigint, period: bigint, amp: bigint): bigint {
  if (period <= 0n) return 0n
  const cycle = period + period
  let phase = minutes % cycle
  if (phase < 0n) phase += cycle
  const two = 1n + 1n
  if (phase < period) return (phase * amp) / period - amp / two
  return ((cycle - phase) * amp) / period - amp / two
}

export function dronePose(
  start: DroneStart,
  block: BlockRect | undefined,
  cityTime: bigint,
  minutesPerHour: bigint,
  speed: bigint,
  altPx: bigint,
  bobPx: bigint,
  bobPeriod: bigint,
): DronePose {
  const den = minutesPerHour <= 0n ? 1n : minutesPerHour
  const minutes = cityMinutes(cityTime, den)
  const bob = triangleBob(minutes, bobPeriod, bobPx)
  const altitude = altPx + bob
  if (block === undefined || speed < 0n) {
    return {
      tileX: start.x,
      tileY: start.y,
      nextX: start.x,
      nextY: start.y,
      fracNum: 0n,
      fracDen: 1n,
      altitude,
    }
  }
  const len = perimeterLen(block)
  if (len <= 0n) {
    return {
      tileX: start.x,
      tileY: start.y,
      nextX: start.x,
      nextY: start.y,
      fracNum: 0n,
      fracDen: 1n,
      altitude,
    }
  }
  const raw = minutes * speed
  const dist = raw / den
  const fracNum = raw % den
  const cur = perimeterAt(block, dist)
  const nxt = perimeterAt(block, dist + 1n)
  return {
    tileX: cur.x,
    tileY: cur.y,
    nextX: nxt.x,
    nextY: nxt.y,
    fracNum,
    fracDen: den,
    altitude,
  }
}

export function droneWorldPos(pose: DronePose, tileW: bigint): IsoPoint {
  const a = tileCenter(pose.tileX, pose.tileY, tileW)
  const b = tileCenter(pose.nextX, pose.nextY, tileW)
  const p = lerpIso(a, b, pose.fracNum, pose.fracDen)
  return { x: p.x, y: p.y - pose.altitude }
}

export function droneShadowPos(pose: DronePose, tileW: bigint): IsoPoint {
  const a = tileCenter(pose.tileX, pose.tileY, tileW)
  const b = tileCenter(pose.nextX, pose.nextY, tileW)
  return lerpIso(a, b, pose.fracNum, pose.fracDen)
}

export function shadowAlphaBps(
  altitude: bigint,
  baseAlt: bigint,
  gradeBps: bigint,
): bigint {
  if (baseAlt <= 0n || gradeBps <= 0n) return 0n
  if (altitude <= 0n) return gradeBps
  const num = baseAlt * gradeBps
  const den = altitude
  const out = num / den
  if (out > gradeBps) return gradeBps
  return out
}

export function birdVisible(cityTime: bigint, ticksDay: bigint, birdsPerDay: bigint): boolean {
  if (birdsPerDay <= 0n || ticksDay <= 0n) return false
  const hour = cityTime % ticksDay
  return hour * birdsPerDay < ticksDay
}

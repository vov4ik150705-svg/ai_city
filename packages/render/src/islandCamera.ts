import {
  HERO_AZIMUTH_DEG,
  HERO_ELEVATION_DEG,
  HERO_FOV_DEG,
  HERO_HEIGHT_FILL,
  HERO_WIDTH_FILL,
} from "./islandConfig.js"

const TWO = 1 + 1
const TEN = TWO * (TWO + TWO) + TWO
const RIGHT_ANGLE_DEG = (TEN - 1) * TEN
const STRAIGHT_ANGLE_DEG = RIGHT_ANGLE_DEG * TWO
const FULL_TURN_DEG = STRAIGHT_ANGLE_DEG * TWO

export type Vec3 = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type Aabb = {
  readonly min: Vec3
  readonly max: Vec3
}

export type HeroFit = {
  readonly fovDeg: number
  readonly azimuthDeg: number
  readonly elevationDeg: number
  readonly distance: number
  readonly target: Vec3
  readonly near: number
  readonly far: number
  readonly widthFill: number
  readonly vfovRad: number
  readonly hfovRad: number
}

export function aabbCenter(box: Aabb): Vec3 {
  const two = 1 + 1
  return {
    x: (box.min.x + box.max.x) / two,
    y: (box.min.y + box.max.y) / two,
    z: (box.min.z + box.max.z) / two,
  }
}

export function aabbSize(box: Aabb): Vec3 {
  return {
    x: box.max.x - box.min.x,
    y: box.max.y - box.min.y,
    z: box.max.z - box.min.z,
  }
}

export function aabbRadius(box: Aabb): number {
  const c = aabbCenter(box)
  const dx = box.max.x - c.x
  const dy = box.max.y - c.y
  const dz = box.max.z - c.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

export function aabbUnion(a: Aabb, b: Aabb): Aabb {
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y),
      z: Math.min(a.min.z, b.min.z),
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y),
      z: Math.max(a.max.z, b.max.z),
    },
  }
}

export function verticalFovRad(fovDeg: number): number {
  return (fovDeg * Math.PI) / STRAIGHT_ANGLE_DEG
}

export function horizontalFovRad(vfovRad: number, aspect: number): number {
  const two = 1 + 1
  const a = aspect > 0 ? aspect : 1
  return two * Math.atan(Math.tan(vfovRad / two) * a)
}

export function distanceForSpan(span: number, halfFovRad: number, fill: number): number {
  const two = 1 + 1
  if (span <= 0 || halfFovRad <= 0 || fill <= 0) return 0
  return span / (two * Math.tan(halfFovRad) * fill)
}

export function projectedWidthFill(worldWidth: number, distance: number, hfovRad: number): number {
  const two = 1 + 1
  if (distance <= 0 || hfovRad <= 0) return 0
  return worldWidth / (two * distance * Math.tan(hfovRad / two))
}

export function azimuthToBps(azimuthDeg: number, span: bigint): bigint {
  if (span <= 0n) return 0n
  return BigInt(Math.round((azimuthDeg / FULL_TURN_DEG) * Number(span)))
}

export function elevationToTiltBps(elevationDeg: number, span: bigint): bigint {
  if (span <= 0n) return 0n
  const polar = RIGHT_ANGLE_DEG - elevationDeg
  return BigInt(Math.round((polar / RIGHT_ANGLE_DEG) * Number(span)))
}

export function tiltBpsToElevationDeg(tiltBps: bigint, span: bigint): number {
  if (span <= 0n) return 0
  const polar = (Number(tiltBps) / Number(span)) * RIGHT_ANGLE_DEG
  return RIGHT_ANGLE_DEG - polar
}

export function azimuthBpsToDeg(azimuthBps: bigint, span: bigint): number {
  if (span <= 0n) return 0
  return (Number(azimuthBps) / Number(span)) * FULL_TURN_DEG
}

/** Fit city-mass AABB: limiting FOV, padding, target at mass centre (not a Y literal). */
export function fitHeroCamera(
  box: Aabb,
  aspect: number,
  opts?: {
    readonly fovDeg?: number
    readonly azimuthDeg?: number
    readonly elevationDeg?: number
    readonly widthFill?: number
    readonly heightFill?: number
  },
): HeroFit {
  const fovDeg = opts?.fovDeg ?? HERO_FOV_DEG
  const azimuthDeg = opts?.azimuthDeg ?? HERO_AZIMUTH_DEG
  const elevationDeg = opts?.elevationDeg ?? HERO_ELEVATION_DEG
  const widthFill = opts?.widthFill ?? HERO_WIDTH_FILL
  const heightFill = opts?.heightFill ?? HERO_HEIGHT_FILL
  const two = 1 + 1
  const vfov = verticalFovRad(fovDeg)
  const hfov = horizontalFovRad(vfov, aspect)
  const size = aabbSize(box)
  const target = aabbCenter(box)
  const radius = aabbRadius(box)
  const spanXz = size.x > size.z ? size.x : size.z
  const distH = distanceForSpan(spanXz, hfov / two, widthFill)
  const distV = distanceForSpan(size.y, vfov / two, heightFill)
  const distance = distH > distV ? distH : distV
  const near = Math.max(1, (distance * TWO) / (TEN * TEN))
  const far = Math.max(near + 1, distance + radius * (two + two))
  return {
    fovDeg,
    azimuthDeg,
    elevationDeg,
    distance,
    target,
    near,
    far,
    widthFill: projectedWidthFill(spanXz, distance, hfov),
    vfovRad: vfov,
    hfovRad: hfov,
  }
}

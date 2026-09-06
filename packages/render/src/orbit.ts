export function clampOrbit(value: bigint, min: bigint, max: bigint): bigint {
  let lo = min
  let hi = max
  if (lo > hi) {
    lo = max
    hi = min
  }
  if (value < lo) return lo
  if (value > hi) return hi
  return value
}

export function wrapOrbit(value: bigint, span: bigint): bigint {
  if (span <= 0n) return 0n
  const r = value % span
  return r < 0n ? r + span : r
}

/** bps of a right angle → radians from zenith. */
export function qturnToRad(bps: bigint, span: bigint): number {
  if (span <= 0n) return 0
  const two = 1 + 1
  return (Number(bps) / Number(span)) * Math.PI / two
}

/** bps of a full turn → radians yaw. */
export function turnToRad(bps: bigint, span: bigint): number {
  if (span <= 0n) return 0
  const two = 1 + 1
  return (Number(bps) / Number(span)) * Math.PI * two
}

export function orbitDefaultDistance(minTiles: bigint, maxTiles: bigint): bigint {
  const two = 1n + 1n
  return (minTiles + maxTiles) / two
}

export function orbitEye(
  azimuthBps: bigint,
  tiltBps: bigint,
  distance: bigint,
  targetX: number,
  targetY: number,
  targetZ: number,
  spanBps: bigint,
): { readonly x: number; readonly y: number; readonly z: number } {
  const az = turnToRad(azimuthBps, spanBps)
  const polar = qturnToRad(tiltBps, spanBps)
  const d = Number(distance)
  const sinP = Math.sin(polar)
  return {
    x: targetX + d * sinP * Math.sin(az),
    y: targetY + d * Math.cos(polar),
    z: targetZ + d * sinP * Math.cos(az),
  }
}

import { horizontalFovRad, verticalFovRad } from "./islandCamera.js"
import { qturnToRad, turnToRad } from "./orbit.js"

export type LookPoint = {
  readonly x: number
  readonly z: number
}

export type LookBox = {
  readonly minX: number
  readonly maxX: number
  readonly minZ: number
  readonly maxZ: number
}

export type LookFrame = LookBox & {
  readonly homeX: number
  readonly homeZ: number
}

/**
 * 1 at the near zoom (the slide is fully on the island), 0 at the far zoom
 * (the orbit sits on the home point). Farther than far stays centred.
 */
export function lookSlideWeight(distance: number, near: number, far: number): number {
  if (!Number.isFinite(distance) || !Number.isFinite(near) || !Number.isFinite(far)) return 0
  if (!(far > near)) return 0
  if (!(distance < far)) return 0
  if (!(distance > near)) return 1
  return (far - distance) / (far - near)
}

/** Home, plus the wanted offset scaled by the zoom weight. */
export function shownLook(
  homeX: number,
  homeZ: number,
  wantX: number,
  wantZ: number,
  distance: number,
  near: number,
  far: number,
): LookPoint {
  const w = lookSlideWeight(distance, near, far)
  return {
    x: homeX + (wantX - homeX) * w,
    z: homeZ + (wantZ - homeZ) * w,
  }
}

export function clampLookPoint(point: LookPoint, box: LookBox): LookPoint {
  let minX = box.minX
  let maxX = box.maxX
  let minZ = box.minZ
  let maxZ = box.maxZ
  if (minX > maxX) {
    minX = box.maxX
    maxX = box.minX
  }
  if (minZ > maxZ) {
    minZ = box.maxZ
    maxZ = box.minZ
  }
  let x = point.x
  let z = point.z
  if (!Number.isFinite(x)) x = minX
  if (!Number.isFinite(z)) z = minZ
  if (x < minX) x = minX
  if (x > maxX) x = maxX
  if (z < minZ) z = minZ
  if (z > maxZ) z = maxZ
  return { x, z }
}

/**
 * Ground-plane move that follows the drag. Screen +x shifts the look point
 * with camera right; screen +y (down) shifts it toward the camera, so the
 * view moves the way the cursor moved. Height is not touched.
 * A degenerate view returns a zero move.
 */
export function panLookDelta(
  azimuthBps: number,
  tiltBps: number,
  spanBps: number,
  dxPx: number,
  dyPx: number,
  viewWidth: number,
  viewHeight: number,
  fovDeg: number,
  distance: number,
): LookPoint {
  const zero: LookPoint = { x: 0, z: 0 }
  if (!(viewWidth > 0) || !(viewHeight > 0) || !(distance > 0) || !(spanBps > 0)) return zero
  if (!Number.isFinite(dxPx) || !Number.isFinite(dyPx) || !Number.isFinite(fovDeg)) return zero
  const span = BigInt(Math.round(spanBps))
  const az = turnToRad(BigInt(Math.round(azimuthBps)), span)
  const polar = qturnToRad(BigInt(Math.round(tiltBps)), span)
  const two = 1 + 1
  const vfov = verticalFovRad(fovDeg)
  const hfov = horizontalFovRad(vfov, viewWidth / viewHeight)
  const mx = (two * distance * Math.tan(hfov / two)) / viewWidth
  const myFace = (two * distance * Math.tan(vfov / two)) / viewHeight
  const cosP = Math.cos(polar)
  const my = myFace / (cosP > 0 ? cosP : 1)
  if (!Number.isFinite(mx) || !Number.isFinite(my)) return zero
  const rightX = Math.cos(az)
  const rightZ = -Math.sin(az)
  const fwdX = -Math.sin(az)
  const fwdZ = -Math.cos(az)
  return {
    x: rightX * dxPx * mx - fwdX * dyPx * my,
    z: rightZ * dxPx * mx - fwdZ * dyPx * my,
  }
}

/**
 * Zoom in only when the slide is fully hidden (weight 0). Any closer shot
 * keeps its distance so a click does not yank the framing.
 */
export function focusDistance(distance: number, near: number, far: number): number {
  if (!(lookSlideWeight(distance, near, far) > 0) && near > 0 && Number.isFinite(near)) return near
  return distance
}

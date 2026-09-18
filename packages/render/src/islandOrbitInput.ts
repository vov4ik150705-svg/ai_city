import type { IslandHandle } from "./frame.js"
import { ORBIT_DEADZONE_PX, ORBIT_DRAG_BPS_PER_PX } from "./islandConfig.js"
import { clampOrbit, wrapOrbit } from "./orbit.js"
import { zoomOrbitDistance } from "./islandZoom.js"

export type IslandOrbitState = {
  azimuthBps: bigint
  tiltBps: bigint
  distance: bigint
}

export type IslandOrbitBind = {
  readonly host: HTMLElement
  readonly handle: IslandHandle
  readonly state: IslandOrbitState
  readonly spanBps: bigint
  readonly tiltMinBps: bigint
  readonly tiltMaxBps: bigint
  readonly distanceMin: bigint
  readonly distanceMax: bigint
  readonly onChange?: () => void
}

function apply(opts: IslandOrbitBind): void {
  const az = wrapOrbit(opts.state.azimuthBps, opts.spanBps)
  const tilt = clampOrbit(opts.state.tiltBps, opts.tiltMinBps, opts.tiltMaxBps)
  const dist = clampOrbit(opts.state.distance, opts.distanceMin, opts.distanceMax)
  opts.state.azimuthBps = az
  opts.state.tiltBps = tilt
  opts.state.distance = dist
  opts.handle.setOrbit(az, tilt, dist)
  if (opts.onChange !== undefined) opts.onChange()
}

/** HUD-free orbit for shared preview. Not THREE.OrbitControls. */
export function bindIslandPreviewOrbit(opts: IslandOrbitBind): () => void {
  const host = opts.host
  host.style.touchAction = "none"
  host.tabIndex = 0
  let pointerId: number | undefined
  let lastX = 0
  let lastY = 0
  let armed = false

  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return
    pointerId = e.pointerId
    lastX = e.clientX
    lastY = e.clientY
    armed = false
    host.setPointerCapture(e.pointerId)
    host.style.cursor = "grabbing"
    e.preventDefault()
  }

  const onMove = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    const step = Math.abs(dx) + Math.abs(dy)
    if (!armed) {
      if (step <= Number(ORBIT_DEADZONE_PX)) return
      armed = true
    }
    const drag = ORBIT_DRAG_BPS_PER_PX
    opts.state.azimuthBps += BigInt(Math.round(dx)) * drag
    opts.state.tiltBps += BigInt(Math.round(dy)) * drag
    apply(opts)
  }

  const onUp = (e: PointerEvent): void => {
    if (pointerId !== e.pointerId) return
    pointerId = undefined
    armed = false
    host.style.cursor = "grab"
    if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId)
  }

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const dir = e.deltaY < 0 ? 1n : 0n - 1n
    opts.state.distance = zoomOrbitDistance(
      opts.state.distance,
      dir,
      opts.distanceMin,
      opts.distanceMax,
    )
    apply(opts)
  }

  host.addEventListener("pointerdown", onDown)
  host.addEventListener("pointermove", onMove)
  host.addEventListener("pointerup", onUp)
  host.addEventListener("pointercancel", onUp)
  host.addEventListener("wheel", onWheel, { passive: false })
  host.style.cursor = "grab"
  apply(opts)
  return () => {
    host.removeEventListener("pointerdown", onDown)
    host.removeEventListener("pointermove", onMove)
    host.removeEventListener("pointerup", onUp)
    host.removeEventListener("pointercancel", onUp)
    host.removeEventListener("wheel", onWheel)
  }
}

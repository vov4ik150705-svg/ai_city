import {
  clampCamera,
  clampLookPoint,
  clampOrbit,
  focusDistance,
  isDoubleTap,
  isPan,
  isSceneTap,
  keyPanDir,
  keyZoomDir,
  lookAtZone,
  panLookDelta,
  pinchZoomDir,
  routeSceneClick,
  wrapOrbit,
  hudSurfaceBlocksPick,
  zoomOrbitDistance,
  type IslandHandle,
  type TileHit,
} from "@corporator/render"
import type { ClientCamera } from "../packview.js"

export type CamPos = {
  tileX: bigint
  tileY: bigint
  zoomIndex: bigint
  accX: bigint
  accY: bigint
  azimuthBps: bigint
  tiltBps: bigint
  distance: bigint
  lookX: number
  lookZ: number
}

function startTilt(camera: ClientCamera): bigint {
  const two = 1n + 1n
  return (camera.orbit.tiltMinBps + camera.orbit.tiltMaxBps) / two
}

export function startCam(camera: ClientCamera): CamPos {
  const core = camera.centroids["core"]
  const start =
    core === undefined
      ? clampCamera(0n, 0n, camera.bounds)
      : clampCamera(core.x, core.y, camera.bounds)
  return {
    tileX: start.x,
    tileY: start.y,
    zoomIndex: 0n,
    accX: 0n,
    accY: 0n,
    azimuthBps: camera.orbit.azimuthBps,
    tiltBps: startTilt(camera),
    distance: camera.orbit.distanceDefault,
    lookX: 0,
    lookZ: 0,
  }
}

export function applyCam(handle: IslandHandle, cam: CamPos, camera: ClientCamera): void {
  const orbit = camera.orbit
  const az = wrapOrbit(cam.azimuthBps, orbit.spanBps)
  const tilt = clampOrbit(cam.tiltBps, orbit.tiltMinBps, orbit.tiltMaxBps)
  const dist = clampOrbit(cam.distance, orbit.distanceMin, orbit.distanceMax)
  cam.azimuthBps = az
  cam.tiltBps = tilt
  cam.distance = dist
  handle.setCamera(cam.tileX, cam.tileY, 1n, 1n)
  handle.setLookAt(cam.lookX, cam.lookZ)
  handle.setOrbit(az, tilt, dist)
}

function canvasOf(host: HTMLElement): HTMLCanvasElement | undefined {
  const el = host.querySelector("canvas")
  if (el instanceof HTMLCanvasElement) return el
  return undefined
}

/** Click through HUD chrome is a defect (WORLD.md §8). Canvas on the scene surface is the only pick target. */
export function hudBlocksPick(target: EventTarget | null): boolean {
  if (target === null) return true
  if (!(target instanceof Element)) return true
  if (target instanceof HTMLCanvasElement) return false
  const host = target.closest("[data-surface]")
  const surface = host === null ? "" : (host.getAttribute("data-surface") ?? "")
  return hudSurfaceBlocksPick(surface)
}

function localPx(canvas: HTMLCanvasElement, clientX: number, clientY: number): { x: bigint; y: bigint } {
  const box = canvas.getBoundingClientRect()
  return {
    x: BigInt(Math.floor(clientX - box.left)),
    y: BigInt(Math.floor(clientY - box.top)),
  }
}

function absBig(n: bigint): bigint {
  return n < 0n ? -n : n
}

/** Shortest signed gap on a wrapped axis. span <= 0 means the axis does not wrap. */
export function orbitDelta(shown: number, target: number, span: number): number {
  let delta = target - shown
  if (!(span > 0)) return delta
  const half = span / 2
  if (delta > half) delta -= span
  if (delta < -half) delta += span
  return delta
}

/**
 * One step of the orbit follow. tau is the packed coast: half of pan_inertia_ms
 * for the turn, the full window while dragging the look point, and four windows
 * when a building takes the look. A late frame is capped so it cannot skip the trip.
 * dt <= 0 holds the current pose so the first animation frame does not jump.
 */
export function orbitFollowStep(shown: number, target: number, dtMs: number, tauMs: number, span: number): number {
  if (!(tauMs > 0)) return target
  if (!(dtMs > 0)) return shown
  const alpha = 1 - Math.exp(-dtMs / tauMs)
  return shown + orbitDelta(shown, target, span) * alpha
}

export function bindSceneInput(opts: {
  readonly host: HTMLElement
  readonly handle: IslandHandle
  readonly camera: ClientCamera
  readonly tileW: bigint
  readonly gradeBps: bigint
  readonly opened: { readonly [district: string]: bigint }
  readonly wallNowMs: () => bigint
  readonly onRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void
  readonly onCamChange: () => void
  readonly cam: { current: CamPos }
}): () => void {
  const { host, handle, camera, gradeBps, opened, wallNowMs, onRoute, onCamChange, cam } = opts
  void opts.tileW
  applyCam(handle, cam.current, camera)

  const two = 1 + 1
  const tauMs = Number(camera.panInertiaMs) / two
  const panTauMs = Number(camera.panInertiaMs)
  const focusTauMs = panTauMs * two * two
  const stepCapMs = panTauMs / two
  const span = Number(camera.orbit.spanBps)
  let shownAz = Number(cam.current.azimuthBps)
  let shownTilt = Number(cam.current.tiltBps)
  let shownDist = Number(cam.current.distance)
  let shownLookX = cam.current.lookX
  let shownLookZ = cam.current.lookZ
  let lookTauMs = panTauMs
  let followFrame = 0
  let followTs = 0

  const publishFollow = (): void => {
    const orbit = camera.orbit
    const az = wrapOrbit(BigInt(Math.round(shownAz)), orbit.spanBps)
    const tilt = clampOrbit(BigInt(Math.round(shownTilt)), orbit.tiltMinBps, orbit.tiltMaxBps)
    const dist = clampOrbit(BigInt(Math.round(shownDist)), orbit.distanceMin, orbit.distanceMax)
    handle.setLookAt(shownLookX, shownLookZ)
    handle.setOrbit(az, tilt, dist)
  }

  const followSettled = (): boolean => {
    const one = 1
    const daz = Math.abs(orbitDelta(shownAz, Number(cam.current.azimuthBps), span))
    const dtilt = Math.abs(orbitDelta(shownTilt, Number(cam.current.tiltBps), 0))
    const ddist = Math.abs(orbitDelta(shownDist, Number(cam.current.distance), 0))
    const lookEps = shownDist > 0 && span > 0 ? shownDist / span : one
    const dlook = Math.abs(shownLookX - cam.current.lookX) + Math.abs(shownLookZ - cam.current.lookZ)
    return daz < one && dtilt < one && ddist < one && dlook < lookEps
  }

  const followTick = (ts: number): void => {
    const raw = followTs === 0 ? 0 : ts - followTs
    const dt = stepCapMs > 0 && raw > stepCapMs ? stepCapMs : raw
    followTs = ts
    shownAz = orbitFollowStep(shownAz, Number(cam.current.azimuthBps), dt, tauMs, span)
    shownTilt = orbitFollowStep(shownTilt, Number(cam.current.tiltBps), dt, tauMs, 0)
    shownDist = orbitFollowStep(shownDist, Number(cam.current.distance), dt, tauMs, 0)
    shownLookX = orbitFollowStep(shownLookX, cam.current.lookX, dt, lookTauMs, 0)
    shownLookZ = orbitFollowStep(shownLookZ, cam.current.lookZ, dt, lookTauMs, 0)
    if (followSettled()) {
      shownAz = Number(cam.current.azimuthBps)
      shownTilt = Number(cam.current.tiltBps)
      shownDist = Number(cam.current.distance)
      shownLookX = cam.current.lookX
      shownLookZ = cam.current.lookZ
      publishFollow()
      followFrame = 0
      followTs = 0
      return
    }
    publishFollow()
    followFrame = requestAnimationFrame(followTick)
  }

  const kickFollow = (): void => {
    if (followFrame !== 0) return
    followFrame = requestAnimationFrame(followTick)
  }

  let pointerId: number | undefined
  let drag: "pan" | "orbit" | undefined
  let fromLeft = false
  let startX = 0n
  let startY = 0n
  let lastX = 0n
  let lastY = 0n
  let lastTapMs = 0n - 1n
  const pinch = new Map<number, { x: bigint; y: bigint }>()
  let pinchDist = 0n

  const pushCam = (): void => {
    const clamped = clampCamera(cam.current.tileX, cam.current.tileY, camera.bounds)
    const orbit = camera.orbit
    cam.current.tileX = clamped.x
    cam.current.tileY = clamped.y
    cam.current.azimuthBps = wrapOrbit(cam.current.azimuthBps, orbit.spanBps)
    cam.current.tiltBps = clampOrbit(cam.current.tiltBps, orbit.tiltMinBps, orbit.tiltMaxBps)
    cam.current.distance = clampOrbit(cam.current.distance, orbit.distanceMin, orbit.distanceMax)
    kickFollow()
    onCamChange()
  }

  const placeLook = (x: number, z: number): void => {
    const frame = handle.lookFrame()
    const point = frame === undefined ? { x, z } : clampLookPoint({ x, z }, frame)
    cam.current.lookX = point.x
    cam.current.lookZ = point.z
  }

  const aimLook = (x: number, z: number): void => {
    placeLook(x, z)
    lookTauMs = focusTauMs
    const next = focusDistance(
      Number(cam.current.distance),
      Number(camera.orbit.distanceMin),
      Number(camera.orbit.distanceMax),
    )
    cam.current.distance = BigInt(Math.round(next))
  }

  const slideLook = (dxPx: number, dyPx: number, viewW: number, viewH: number): void => {
    lookTauMs = panTauMs
    const fov = handle.captureMeta().camera.fovDeg
    const delta = panLookDelta(shownAz, shownTilt, span, dxPx, dyPx, viewW, viewH, fov, shownDist)
    placeLook(cam.current.lookX + delta.x, cam.current.lookZ + delta.z)
  }

  const clickAt = (sx: bigint, sy: bigint): void => {
    const hit: TileHit = handle.hitAt(sx, sy)
    if (hit.objectId.length > 0) {
      const ground = handle.objectGround(hit.objectId)
      if (ground !== undefined) {
        aimLook(ground.x, ground.z)
        pushCam()
      }
    }
    const screen = routeSceneClick(hit, camera.beacons, opened)
    onRoute(screen, hit.objectId, hit.cell, hit.tileX, hit.tileY)
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (hudBlocksPick(e.target)) return
    const canvas = canvasOf(host)
    if (canvas === undefined || e.target !== canvas) return
    if (e.button === 2) e.preventDefault()
    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // Capture can fail for a pointer the canvas does not own. The host still hears the move.
    }
    const p = localPx(canvas, e.clientX, e.clientY)
    pinch.set(e.pointerId, p)
    if (pinch.size === 1) {
      pointerId = e.pointerId
      fromLeft = e.button === 0
      drag = e.button === 2 ? "pan" : "orbit"
      startX = p.x
      startY = p.y
      lastX = p.x
      lastY = p.y
    } else if (pinch.size === 1 + 1) {
      pointerId = undefined
      drag = undefined
      fromLeft = false
      const pts = [...pinch.values()]
      const a = pts[0]
      const b = pts[1]
      if (a !== undefined && b !== undefined) {
        pinchDist = absBig(a.x - b.x) + absBig(a.y - b.y)
      }
    }
  }

  const onPointerMove = (e: PointerEvent): void => {
    const canvas = canvasOf(host)
    if (canvas === undefined) return
    if (!pinch.has(e.pointerId)) return
    const p = localPx(canvas, e.clientX, e.clientY)
    pinch.set(e.pointerId, p)
    if (pinch.size === 1 + 1) {
      const pts = [...pinch.values()]
      const a = pts[0]
      const b = pts[1]
      if (a === undefined || b === undefined) return
      const dist = absBig(a.x - b.x) + absBig(a.y - b.y)
      const prev = pinchDist <= 0n ? 1n : pinchDist
      const dir = pinchZoomDir(prev, dist, camera.pinchStepBps, gradeBps)
      if (dir !== 0n) {
        cam.current.distance = zoomOrbitDistance(
          cam.current.distance,
          dir,
          camera.orbit.distanceMin,
          camera.orbit.distanceMax,
        )
        pinchDist = dist
        pushCam()
      }
      return
    }
    if (pointerId !== e.pointerId) return
    const prevX = lastX
    const prevY = lastY
    const movedX = p.x - lastX
    const movedY = p.y - lastY
    lastX = p.x
    lastY = p.y
    const total = absBig(p.x - startX) + absBig(p.y - startY)
    if (!isPan(total, camera.panDeadzonePx)) return
    if (drag === "orbit") {
      const sens = camera.orbit.dragBpsPerPx
      cam.current.azimuthBps += movedX * sens
      cam.current.tiltBps += movedY * sens
      pushCam()
      return
    }
    lookTauMs = panTauMs
    const grabbed = handle.slideGround(Number(prevX), Number(prevY), Number(p.x), Number(p.y))
    if (grabbed !== undefined) {
      placeLook(cam.current.lookX + grabbed.x, cam.current.lookZ + grabbed.z)
    } else {
      slideLook(Number(movedX), Number(movedY), canvas.clientWidth, canvas.clientHeight)
    }
    pushCam()
  }

  const onPointerUp = (e: PointerEvent): void => {
    const canvas = canvasOf(host)
    pinch.delete(e.pointerId)
    if (canvas === undefined) return
    if (fromLeft && e.target === canvas && pointerId === e.pointerId) {
      const p = localPx(canvas, e.clientX, e.clientY)
      const total = absBig(p.x - startX) + absBig(p.y - startY)
      if (isSceneTap(total, camera.tapMaxMovePx, camera.panDeadzonePx)) {
        const now = wallNowMs()
        if (isDoubleTap(now, lastTapMs, camera.doubleTapMs)) {
          const hit = handle.hitAt(p.x, p.y)
          const next = clampCamera(hit.tileX, hit.tileY, camera.bounds)
          cam.current.tileX = next.x
          cam.current.tileY = next.y
          lastTapMs = 0n - 1n
          pushCam()
        } else {
          lastTapMs = now
          clickAt(p.x, p.y)
        }
      }
    }
    pointerId = undefined
    drag = undefined
    fromLeft = false
    pinchDist = 0n
  }

  const onWheel = (e: WheelEvent): void => {
    if (hudBlocksPick(e.target)) return
    const canvas = canvasOf(host)
    if (canvas === undefined || e.target !== canvas) return
    e.preventDefault()
    const dir = e.deltaY < 0 ? 1n : 0n - 1n
    cam.current.distance = zoomOrbitDistance(
      cam.current.distance,
      dir,
      camera.orbit.distanceMin,
      camera.orbit.distanceMax,
    )
    pushCam()
  }

  const onKey = (e: KeyboardEvent): void => {
    const pan = keyPanDir(e.key)
    if (pan.dx !== 0n || pan.dy !== 0n) {
      const canvas = canvasOf(host)
      const next = clampCamera(cam.current.tileX + pan.dx, cam.current.tileY + pan.dy, camera.bounds)
      cam.current.tileX = next.x
      cam.current.tileY = next.y
      if (canvas !== undefined) {
        const two = 1 + 1
        const stepX = canvas.clientWidth / (two * two)
        const stepY = canvas.clientHeight / (two * two)
        slideLook(Number(pan.dx) * stepX, Number(pan.dy) * stepY, canvas.clientWidth, canvas.clientHeight)
      }
      pushCam()
      e.preventDefault()
      return
    }
    const z = keyZoomDir(e.key)
    if (z !== 0n) {
      cam.current.distance = zoomOrbitDistance(
        cam.current.distance,
        z,
        camera.orbit.distanceMin,
        camera.orbit.distanceMax,
      )
      pushCam()
    }
  }

  const onMenu = (e: Event): void => {
    e.preventDefault()
  }

  host.addEventListener("pointerdown", onPointerDown)
  host.addEventListener("pointermove", onPointerMove)
  host.addEventListener("pointerup", onPointerUp)
  host.addEventListener("pointercancel", onPointerUp)
  host.addEventListener("wheel", onWheel, { passive: false })
  host.addEventListener("contextmenu", onMenu)
  host.tabIndex = 0
  host.addEventListener("keydown", onKey)
  return () => {
    if (followFrame !== 0) cancelAnimationFrame(followFrame)
    host.removeEventListener("pointerdown", onPointerDown)
    host.removeEventListener("pointermove", onPointerMove)
    host.removeEventListener("pointerup", onPointerUp)
    host.removeEventListener("pointercancel", onPointerUp)
    host.removeEventListener("wheel", onWheel)
    host.removeEventListener("contextmenu", onMenu)
    host.removeEventListener("keydown", onKey)
  }
}

export function lookCam(camera: ClientCamera, districtId: string, cam: CamPos): CamPos {
  const at = lookAtZone(districtId, camera.centroids, camera.bounds)
  return { ...cam, tileX: at.x, tileY: at.y, accX: 0n, accY: 0n }
}

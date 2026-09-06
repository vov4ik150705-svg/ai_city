import {
  clampCamera,
  clampOrbit,
  isDoubleTap,
  isPan,
  isTap,
  keyPanDir,
  keyZoomDir,
  lookAtZone,
  pinchZoomDir,
  routeSceneClick,
  wrapOrbit,
  hudSurfaceBlocksPick,
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

export function bindSceneInput(opts: {
  readonly host: HTMLElement
  readonly handle: IslandHandle
  readonly camera: ClientCamera
  readonly tileW: bigint
  readonly gradeBps: bigint
  readonly opened: { readonly [district: string]: bigint }
  readonly wallNowMs: () => bigint
  readonly onRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void
  readonly cam: { current: CamPos }
}): () => void {
  const { host, handle, camera, gradeBps, opened, wallNowMs, onRoute, cam } = opts
  void opts.tileW
  applyCam(handle, cam.current, camera)

  let pointerId: number | undefined
  let startX = 0n
  let startY = 0n
  let lastX = 0n
  let lastY = 0n
  let lastTapMs = 0n - 1n
  const pinch = new Map<number, { x: bigint; y: bigint }>()
  let pinchDist = 0n

  const pushCam = (): void => {
    const clamped = clampCamera(cam.current.tileX, cam.current.tileY, camera.bounds)
    cam.current.tileX = clamped.x
    cam.current.tileY = clamped.y
    applyCam(handle, cam.current, camera)
  }

  const clickAt = (sx: bigint, sy: bigint): void => {
    const hit: TileHit = handle.hitAt(sx, sy)
    const screen = routeSceneClick(hit, camera.beacons, opened)
    onRoute(screen, hit.objectId, hit.cell, hit.tileX, hit.tileY)
  }

  const onPointerDown = (e: PointerEvent): void => {
    if (hudBlocksPick(e.target)) return
    const canvas = canvasOf(host)
    if (canvas === undefined || e.target !== canvas) return
    canvas.setPointerCapture(e.pointerId)
    const p = localPx(canvas, e.clientX, e.clientY)
    pinch.set(e.pointerId, p)
    if (pinch.size === 1) {
      pointerId = e.pointerId
      startX = p.x
      startY = p.y
      lastX = p.x
      lastY = p.y
    } else if (pinch.size === 1 + 1) {
      pointerId = undefined
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
        cam.current.distance -= dir
        pinchDist = dist
        pushCam()
      }
      return
    }
    if (pointerId !== e.pointerId) return
    const movedX = p.x - lastX
    const movedY = p.y - lastY
    lastX = p.x
    lastY = p.y
    const total = absBig(p.x - startX) + absBig(p.y - startY)
    if (!isPan(total, camera.panDeadzonePx)) return
    const drag = camera.orbit.dragBpsPerPx
    cam.current.azimuthBps += movedX * drag
    cam.current.tiltBps += movedY * drag
    pushCam()
  }

  const onPointerUp = (e: PointerEvent): void => {
    const canvas = canvasOf(host)
    pinch.delete(e.pointerId)
    if (canvas === undefined) return
    if (e.target === canvas && pointerId === e.pointerId) {
      const p = localPx(canvas, e.clientX, e.clientY)
      const total = absBig(p.x - startX) + absBig(p.y - startY)
      if (isTap(total, camera.tapMaxMovePx)) {
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
    pinchDist = 0n
  }

  const onWheel = (e: WheelEvent): void => {
    if (hudBlocksPick(e.target)) return
    const canvas = canvasOf(host)
    if (canvas === undefined || e.target !== canvas) return
    e.preventDefault()
    const dir = e.deltaY < 0 ? 1n : 0n - 1n
    cam.current.distance -= dir
    pushCam()
  }

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      onRoute("", "", "", 0n, 0n)
      return
    }
    const pan = keyPanDir(e.key)
    if (pan.dx !== 0n || pan.dy !== 0n) {
      const next = clampCamera(cam.current.tileX + pan.dx, cam.current.tileY + pan.dy, camera.bounds)
      cam.current.tileX = next.x
      cam.current.tileY = next.y
      pushCam()
      return
    }
    const z = keyZoomDir(e.key)
    if (z !== 0n) {
      cam.current.distance -= z
      pushCam()
    }
  }

  host.addEventListener("pointerdown", onPointerDown)
  host.addEventListener("pointermove", onPointerMove)
  host.addEventListener("pointerup", onPointerUp)
  host.addEventListener("pointercancel", onPointerUp)
  host.addEventListener("wheel", onWheel, { passive: false })
  host.tabIndex = 0
  host.addEventListener("keydown", onKey)
  return () => {
    host.removeEventListener("pointerdown", onPointerDown)
    host.removeEventListener("pointermove", onPointerMove)
    host.removeEventListener("pointerup", onPointerUp)
    host.removeEventListener("pointercancel", onPointerUp)
    host.removeEventListener("wheel", onWheel)
    host.removeEventListener("keydown", onKey)
  }
}

export function lookCam(camera: ClientCamera, districtId: string, cam: CamPos): CamPos {
  const at = lookAtZone(districtId, camera.centroids, camera.bounds)
  return { ...cam, tileX: at.x, tileY: at.y, accX: 0n, accY: 0n }
}

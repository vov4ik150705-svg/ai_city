import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { advanceOrbitAz, orbitAzFollow, orbitDelta, orbitFollowStep, orbitGlideTauMs, rebaseOrbitAz, lookCam, type CamPos } from "../src/hud/sceneInput.ts"
import type { ClientCamera } from "../src/packview.ts"

describe("orbit follow", () => {
  it("moves part of the gap instead of snapping", () => {
    const next = orbitFollowStep(0, 1000, 16, 120, 0)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1000)
  })

  it("holds on a zero frame so the first tick does not jump", () => {
    expect(orbitFollowStep(40, 1000, 0, 120, 0)).toBe(40)
  })

  it("takes the short way around a wrapped azimuth", () => {
    const span = 10000
    expect(orbitDelta(9800, 200, span)).toBe(400)
    const next = orbitFollowStep(9800, 200, 16, 120, span)
    expect(next).toBeGreaterThan(9800)
    expect(next).toBeLessThan(9800 + 400)
  })

  it("keeps a fast drag that crosses half a turn", () => {
    const span = 10000
    const dragged = advanceOrbitAz(0, 6800)
    expect(dragged).toBe(6800)
    const wrapped = dragged % span
    expect(orbitDelta(0, wrapped, span)).toBeLessThan(0)
    const glideTau = orbitGlideTauMs(240)
    expect(glideTau).toBe(240)
    const coast = orbitAzFollow(0, dragged, 16, glideTau)
    expect(coast).toBeGreaterThan(0)
    expect(coast).toBeLessThan(dragged)
    const quick = orbitFollowStep(0, 1000, 16, 120, 0)
    const glide = orbitFollowStep(0, 1000, 16, glideTau, 0)
    expect(glide).toBeGreaterThan(0)
    expect(glide).toBeLessThan(quick)
    const folded = rebaseOrbitAz(15000, 15600, span)
    expect(folded.shown).toBe(5000)
    expect(folded.target - folded.shown).toBe(600)
  })

  it("snaps when the coast time is zero", () => {
    expect(orbitFollowStep(10, 80, 16, 0, 0)).toBe(80)
  })

  it("district look keeps the planted orbit", () => {
    const cam: CamPos = {
      tileX: 1n,
      tileY: 2n,
      zoomIndex: 0n,
      accX: 3n,
      accY: 4n,
      azimuthBps: 100n,
      tiltBps: 200n,
      distance: 228n,
      lookX: 2.8,
      lookZ: -18.5,
    }
    const camera = {
      centroids: { compute: { x: 40n, y: 50n } },
      bounds: { minX: 0n, minY: 0n, maxX: 100n, maxY: 100n },
    } as ClientCamera
    const next = lookCam(camera, "compute", cam)
    expect(next.distance).toBe(228n)
    expect(next.lookX).toBe(2.8)
    expect(next.lookZ).toBe(-18.5)
    expect(next.azimuthBps).toBe(100n)
    expect(next.tiltBps).toBe(200n)
    expect(next.tileX).toBe(40n)
    expect(next.tileY).toBe(50n)
  })

  it("a building click does not move the camera", () => {
    const src = readFileSync(new URL("../src/hud/sceneInput.ts", import.meta.url), "utf8")
    const start = src.indexOf("const clickAt")
    const end = src.indexOf("const onPointerDown")
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    const body = src.slice(start, end)
    expect(body.includes("onRoute")).toBe(true)
    expect(body.includes("aimLook")).toBe(false)
    expect(body.includes("pushCam")).toBe(false)
    expect(body.includes("focusDistance")).toBe(false)
  })

  it("opening a district does not republish the orbit", () => {
    const src = readFileSync(new URL("../src/hud/SceneHost.tsx", import.meta.url), "utf8")
    const start = src.indexOf("props.lookId.length")
    const end = src.indexOf("props.cityTime")
    expect(start).toBeGreaterThan(0)
    expect(end).toBeGreaterThan(start)
    expect(src.slice(start, end).includes("applyCam")).toBe(false)
  })
})

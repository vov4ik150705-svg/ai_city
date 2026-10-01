import { describe, expect, it } from "vitest"
import {
  clampLookPoint,
  focusDistance,
  lookSlideWeight,
  panLookDelta,
  shownLook,
} from "../src/lookPan.ts"

const near = 500
const far = 16000
const home = 2000

describe("look slide", () => {
  it("hides the offset at the far zoom and shows it at the near zoom", () => {
    expect(lookSlideWeight(far, near, far)).toBe(0)
    expect(lookSlideWeight(near, near, far)).toBe(1)
    expect(shownLook(0, 0, 800, -400, far, near, far)).toEqual({ x: 0, z: 0 })
    expect(shownLook(0, 0, 800, -400, near, near, far)).toEqual({ x: 800, z: -400 })
  })

  it("stays fully on the point at the home distance and fades only while pulling out", () => {
    expect(lookSlideWeight(home, home, far)).toBe(1)
    expect(lookSlideWeight(home / 2, home, far)).toBe(1)
    expect(shownLook(0, 0, 100, 50, home, home, far)).toEqual({ x: 100, z: 50 })
    const pulled = home + (far - home) / 2
    expect(shownLook(0, 0, 100, 0, pulled, home, far).x).toBeCloseTo(50)
  })

  it("keeps a partial offset between the stops", () => {
    const mid = (near + far) / 2
    expect(lookSlideWeight(mid, near, far)).toBeCloseTo(0.5)
    expect(shownLook(0, 0, 200, 0, mid, near, far).x).toBeCloseTo(100)
  })

  it("stays centred past the far stop and fully slid inside the near stop", () => {
    expect(lookSlideWeight(far + home, near, far)).toBe(0)
    expect(lookSlideWeight(near - home, near, far)).toBe(1)
  })

  it("returns 0 instead of NaN when the zoom band is empty or the distance is not finite", () => {
    expect(lookSlideWeight(home, far, near)).toBe(0)
    expect(lookSlideWeight(home, far, far)).toBe(0)
    expect(lookSlideWeight(Number.NaN, near, far)).toBe(0)
    expect(shownLook(10, 10, 90, 90, home, far, far)).toEqual({ x: 10, z: 10 })
  })
})

describe("look clamp", () => {
  const box = { minX: -10, maxX: 10, minZ: -4, maxZ: 4 }

  it("pulls a point outside the island back onto the bound", () => {
    expect(clampLookPoint({ x: 40, z: -20 }, box)).toEqual({ x: 10, z: -4 })
  })

  it("leaves an interior point where it is", () => {
    expect(clampLookPoint({ x: 3, z: 1 }, box)).toEqual({ x: 3, z: 1 })
  })

  it("still clamps when the box corners are swapped", () => {
    const swapped = { minX: 10, maxX: -10, minZ: 4, maxZ: -4 }
    expect(clampLookPoint({ x: 40, z: 40 }, swapped)).toEqual({ x: 10, z: 4 })
  })
})

describe("look pan", () => {
  const span = 10000
  const tilt = span / 4

  it("moves the view with the drag along azimuth 0", () => {
    const right = panLookDelta(0, tilt, span, 100, 0, 1000, 800, 36, 1000)
    expect(right.x).toBeGreaterThan(0)
    expect(right.z).toBeCloseTo(0)
    const down = panLookDelta(0, tilt, span, 0, 80, 1000, 800, 36, 1000)
    expect(down.z).toBeGreaterThan(0)
    const up = panLookDelta(0, tilt, span, 0, -80, 1000, 800, 36, 1000)
    expect(up.z).toBeLessThan(0)
  })

  it("returns a zero move when the view has no size or no distance", () => {
    expect(panLookDelta(0, tilt, span, 40, 40, 0, 800, 36, 1000)).toEqual({ x: 0, z: 0 })
    expect(panLookDelta(0, tilt, span, 40, 40, 1000, 800, 36, 0)).toEqual({ x: 0, z: 0 })
  })
})

describe("focus distance", () => {
  it("dollies in only when the slide is fully hidden", () => {
    expect(focusDistance(far, near, far)).toBe(near)
    expect(focusDistance(home, near, far)).toBe(home)
    expect(focusDistance(near, near, far)).toBe(near)
  })

  it("does not invent a distance when the near stop is missing", () => {
    expect(focusDistance(far, 0, far)).toBe(far)
  })
})

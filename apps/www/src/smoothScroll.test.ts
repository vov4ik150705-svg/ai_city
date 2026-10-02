import { describe, expect, it } from "vitest"
import { easeScroll, followScroll, pageWheel } from "./smoothScroll"

function snap(y: number, dpr: number): number {
  const quantum = 1 / dpr
  return Math.round(y / quantum) * quantum
}

describe("smooth scroll", () => {
  it("does not turn a stalled frame into a leap", () => {
    const stalled = easeScroll(0, 1000, 250)
    const frame = easeScroll(0, 1000, 16)
    expect(stalled).toBeLessThan(250)
    expect(stalled).toBeGreaterThan(150)
    expect(frame).toBeGreaterThan(70)
    expect(frame).toBeLessThan(90)
  })

  it("keeps a sub-pixel lead so device-pixel snapping cannot freeze the ease", () => {
    const dpr = 1.25
    let current = 0
    let target = 0
    let naiveCurrent = 0
    let naiveTarget = 0
    let stuck = 0
    for (let i = 0; i < 40; i += 1) {
      naiveTarget += 0.35
      const naiveApplied = snap(easeScroll(naiveCurrent, naiveTarget, 16), dpr)
      if (naiveApplied === naiveCurrent) stuck += 1
      naiveCurrent = naiveApplied

      target += 0.35
      const animated = easeScroll(current, target, 16)
      const next = followScroll(animated, snap(animated, dpr), target, 8000)
      current = next.current
      target = next.target
    }
    expect(stuck).toBeGreaterThan(5)
    expect(current).toBeGreaterThan(5)
  })

  it("follows a real rejection instead of storing a teleport", () => {
    expect(followScroll(500, 120, 500, 4000)).toEqual({ current: 120, target: 500 })
    expect(followScroll(500, 100, 800, 100)).toEqual({ current: 100, target: 100 })
  })

  it("swallows the damping tail of a fast flick into the page edge", () => {
    const intoBottom = pageWheel(true, 420, 8000, 1000, 160)
    expect(intoBottom.prevent).toBe(true)
    expect(intoBottom.moved).toBe(false)
    expect(intoBottom.target).toBe(8000)

    const intoTop = pageWheel(true, 180, -400, 1000, -90)
    expect(intoTop.prevent).toBe(true)
    expect(intoTop.moved).toBe(false)
    expect(intoTop.target).toBe(-400)

    const reverse = pageWheel(true, 420, 8000, 1000, -90)
    expect(reverse.prevent).toBe(true)
    expect(reverse.moved).toBe(true)
    expect(reverse.target).toBe(910)
  })

  it("still eases a slow wheel that has not reached the edge", () => {
    const slow = pageWheel(true, 400, 430, 5000, 24)
    expect(slow.prevent).toBe(true)
    expect(slow.moved).toBe(true)
    expect(slow.target).toBe(454)
  })

  it("follows a forward snap so the next frame does not pull the page back", () => {
    expect(followScroll(10.2, 10.6, 40, 4000)).toEqual({ current: 10.6, target: 40 })
  })
})

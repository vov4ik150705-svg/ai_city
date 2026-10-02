import { describe, expect, it } from "vitest"
import * as fragments from "../src/fragments.ts"
import { stabilityBps } from "../src/index.ts"
import { bi10000 } from "../src/literals.ts"

describe("ac2_one_stability", () => {
  it("ac2_fragments_does_not_export_stability", () => {
    expect("stabilityBps" in fragments).toBe(false)
  })

  it("ac2_season_stability_is_share_of_the_day", () => {
    const ticksDay = 24n
    expect(stabilityBps(ticksDay, ticksDay, bi10000)).toBe(bi10000)
    expect(stabilityBps(0n, ticksDay, bi10000)).toBe(0n)
    expect(stabilityBps(ticksDay, 0n, bi10000)).toBe(0n)
  })
})

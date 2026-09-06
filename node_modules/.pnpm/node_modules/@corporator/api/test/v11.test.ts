import { describe, expect, it } from "vitest"
import { asBigint, bootHost, makeInputs } from "./harness.ts"

describe.sequential("V11 attest live", () => {
  it("attest_failure_keeps_payout", async () => {
    const host = await bootHost()
    const before = asBigint(host.ctx.cfg["anchor_hour"])
    let called = false
    await host.stepTick(makeInputs(host.ctx.cfg, 0n), {
      async submit(): Promise<undefined> {
        called = true
        throw new Error("ipfs")
      },
    })
    expect(called).toBe(true)
    expect(asBigint(host.state["city_time"])).toBe(before)
    const row = host.attestLog[0]
    expect(row !== undefined).toBe(true)
    if (row === undefined) return
    expect(row.badge).toBe("logged")
    expect(row.root.length === 0).toBe(true)
    expect(row.cid.length === 0).toBe(true)
    await host.stepTick(makeInputs(host.ctx.cfg, 1n), {
      async submit(): Promise<undefined> {
        throw new Error("rpc")
      },
    })
    const length = asBigint(host.ctx.cfg["tick_length_city_hours"])
    expect(asBigint(host.state["city_time"])).toBe(before + length)
  })
})

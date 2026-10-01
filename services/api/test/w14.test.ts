import { fromUtf8, parseJson } from "@corporator/contentpack"
import { describe, expect, it } from "vitest"
import { asBigint, asEngineDict, asObj, asText } from "../src/values.ts"
import type { Store } from "../src/store.ts"
import { bootHost, bootHostOn, makeInputs, openPglite } from "./harness.ts"

function cityIdsOf(payload: Uint8Array): string {
  const parsed = parseJson(fromUtf8(payload))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["city_id"])
}

describe("W14 patches for every city", () => {
  it("publishes each city after commit, and a silent city does not stop the tick", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    cities["b"] = structuredClone(cities["a"])
    const seen: string[] = []
    host.channels.subscribe("tick", (payload) => {
      seen.push(cityIdsOf(payload))
    })
    const ran = await host.stepTick(makeInputs(host.ctx.cfg, 0n))
    expect(ran.state["tick_index"]).toBe(0n)
    expect(seen).toContain("a")
    expect(seen).toContain("b")
    host.channels.subscribe("tick", (payload) => {
      if (cityIdsOf(payload) === "a") throw new Error("no socket")
    })
    const afterThrow: string[] = []
    host.channels.subscribe("tick", (payload) => {
      afterThrow.push(cityIdsOf(payload))
    })
    const again = await host.stepTick(makeInputs(host.ctx.cfg, 1n))
    expect(again.state["tick_index"]).toBe(1n)
    expect(afterThrow).toContain("b")
    expect(asBigint(asEngineDict(asEngineDict(host.state["cities"])["b"])["capital"]) >= 0n).toBe(true)

    const inner = await openPglite()
    const wrapped: Store = {
      async exec(sql: string): Promise<void> {
        if (sql === "COMMIT") throw new Error("commit")
        await inner.exec(sql)
      },
      query: (sql, params) => inner.query(sql, params),
      close: () => inner.close(),
    }
    const blocked = await bootHostOn(wrapped)
    const blockedSeen: string[] = []
    blocked.channels.subscribe("tick", (payload) => {
      blockedSeen.push(cityIdsOf(payload))
    })
    await expect(blocked.stepTick(makeInputs(blocked.ctx.cfg, 0n))).rejects.toThrow("commit")
    expect(blockedSeen.length).toBe(0)
    expect(asBigint(blocked.state["tick_index"])).toBe(0n)
  })
})

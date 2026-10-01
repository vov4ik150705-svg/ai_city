import { describe, expect, it } from "vitest"
import { wsHeartbeatMs } from "@corporator/protocol"
import { emptySnapshot } from "../src/index.ts"
import { applyWsEvent, cityWsUrl, parseWsEvent, sourcesOfChannel, staleWaitMs } from "../src/hud/wsFeed.ts"

describe("H6 city websocket feed", () => {
  it("patches one frequency class and never writes city time from the socket", () => {
    const start = { ...emptySnapshot(), cityTime: 40n, capital: 3n, gdp: 9n, corp: 2n }
    const tick = parseWsEvent({
      channel: "tick",
      city_time: 99n,
      sections: { "tick.capital": 8n, "aggregate.gdp": 1n },
    })
    expect(tick?.kind).toBe("patch")
    if (tick === undefined || tick.kind !== "patch") throw new Error("tick")
    expect(tick.channel).toBe("tick")
    expect(tick.sections["aggregate.gdp"]).toBeUndefined()
    const afterTick = applyWsEvent(start, tick)
    expect(afterTick.cityTime).toBe(40n)
    expect(afterTick.capital).toBe(8n)
    expect(afterTick.gdp).toBe(9n)
    const agg = parseWsEvent({
      channel: "aggregate",
      sections: { "aggregate.gdp": 11n, "tick.capital": 0n },
    })
    if (agg === undefined || agg.kind !== "patch") throw new Error("agg")
    const afterAgg = applyWsEvent(afterTick, agg)
    expect(afterAgg.gdp).toBe(11n)
    expect(afterAgg.capital).toBe(8n)
    expect(afterAgg.cityTime).toBe(40n)
    const pulse = parseWsEvent({ pack_hash: "abc", city_time: 12n })
    expect(pulse).toEqual({ kind: "pulse", packHash: "abc" })
    expect(applyWsEvent(afterAgg, pulse ?? { kind: "pulse", packHash: "abc" }).cityTime).toBe(40n)
    expect(parseWsEvent({ channel: "clock", sections: {} })).toBeUndefined()
    expect(sourcesOfChannel("tick").includes("tick.capital")).toBe(true)
    expect(sourcesOfChannel("tick").includes("aggregate.gdp")).toBe(false)
  })

  it("shows how long until the next pulse and maps the city socket path", () => {
    expect(staleWaitMs(0n)).toBe(wsHeartbeatMs)
    expect(staleWaitMs(wsHeartbeatMs)).toBe(0n)
    expect(staleWaitMs(wsHeartbeatMs + 1n)).toBe(0n)
    expect(staleWaitMs(1n, 4n)).toBe(3n)
    expect(cityWsUrl("http://127.0.0.1:7460", "c1")).toBe("ws://127.0.0.1:7460/city/c1/ws")
    expect(cityWsUrl("https://play.example", "c1")).toBe("wss://play.example/city/c1/ws")
  })
})

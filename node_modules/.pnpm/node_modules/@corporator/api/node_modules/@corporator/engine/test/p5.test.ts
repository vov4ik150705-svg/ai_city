import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { cityClock, loadConfig, newState, tick } from "../src/index.ts"
import { periodSettleDue, seasonSettleDue } from "../src/seasons.ts"
import { asBig, asDict, asList, asStr } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { armFund, liveCity, loadPack, makeInputs, repo } from "./harness.ts"

function tickIndexAt(cfg: Dict, day: bigint, hour: bigint): bigint {
  const ticksDay = asBig(cfg["ticks_day"])
  const absHour = (day - asBig(cfg["anchor_day"])) * ticksDay + hour
  return absHour - asBig(cfg["anchor_hour"])
}

describe.sequential("P5 construction", () => {
  it("rehearsal_pack_hash_equals_prod", () => {
    const pack = loadPack()
    const sections = asDict(pack["sections"])
    const arch = asDict(sections["arch"])
    const rehearsal = asDict(arch["rehearsal"])
    expect(asStr(rehearsal["pack_pin"])).toBe("prod")
    expect(asStr(rehearsal["city_day_src"])).toBe("time.params.city_day_real_hours")
    expect(asStr(asDict(arch["image"])["pin"])).toBe("pack_hash")
    const time = asDict(asDict(sections["time"])["params"])
    expect(asBig(asDict(time["city_day_real_hours"])["v"])).toBe(25n)
    expect(asBig(asDict(time["tick_length_city_hours"])["v"])).toBe(1n)
    const df = readFileSync(join(repo, "deploy/Dockerfile"), "utf8")
    expect(df.includes("ENV PACK_HASH")).toBe(true)
    expect(asStr(pack["hash"]).length).toBe(64)
  })

  it("farm_window_settles_at_fourteen", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const divisor = asBig(cfg["payroll_daily_divisor"])
    expect(divisor).toBe(14n)
    const windowEnd = divisor
    const nextOpen = divisor + 1n
    expect((windowEnd - 1n) / divisor).toBe(0n)
    expect((nextOpen - 1n) / divisor).toBe(1n)
    const city = liveCity(cfg, pack)
    city["fragment_ledger"] = { NVDA: 1n }
    city["fragment_pool"] = 100n
    const state = newState(cfg, { a: city }, {})
    armFund(state, cfg)
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const idx = tickIndexAt(cfg, nextOpen, hour)
    const clock = cityClock(cfg, idx)
    expect(clock[0]).toBe(nextOpen)
    expect(clock[1]).toBe(hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const cities = asDict(out["cities"])
    const row = asDict(cities["a"])
    expect(row["fragment_settlement"]).toBeDefined()
  })

  it("prize_period_settles_at_thirty", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const data = asDict(cfg["data"])
    const season = asBig(cfg["season_city_days"])
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const period = 30n
    expect(season % 3n).toBe(0n)
    expect(season / 3n).toBe(period)
    expect(periodSettleDue(data, period + 1n, hour)).toBe(true)
    expect(periodSettleDue(data, period, hour)).toBe(false)
    expect(seasonSettleDue(data, season + 1n, hour)).toBe(true)
    const city = liveCity(cfg, pack)
    city["influence"] = 1n
    city["positive_days"] = period
    city["live_stake"] = 1n
    city["spend_protocol_period"] = 1n
    const state = newState(cfg, { a: city }, {})
    armFund(state, cfg)
    state["season_prize_pool"] = 0n
    const idx = tickIndexAt(cfg, period + 1n, hour)
    const clock = cityClock(cfg, idx)
    expect(clock[0]).toBe(period + 1n)
    expect(clock[1]).toBe(hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const settle = asDict(out["season_settlement"])
    const codes = asList(settle["codes"]).map((c) => asStr(c))
    expect(codes.includes("PRIZE_PERIOD_SETTLED")).toBe(true)
  })
})

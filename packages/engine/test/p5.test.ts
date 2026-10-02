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
    const window = asBig(
      asDict(asDict(asDict(asDict(pack["sections"])["fragments"])["params"])["fragment_window_city_days"])["v"],
    )
    expect(window).toBe(7n)
    expect(asBig(cfg["payroll_daily_divisor"])).toBe(14n)
    const windowEnd = window
    const nextOpen = window + 1n
    expect((windowEnd - 1n) / window).toBe(0n)
    expect((nextOpen - 1n) / window).toBe(1n)
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

  it("tick_settle_copies_city_wallet_and_merges", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const data = asDict(cfg["data"])
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const period = 30n
    expect(periodSettleDue(data, period + 1n, hour)).toBe(true)
    const addr = "0x" + "cc".repeat(20)
    function walletCity(id: string, influence: bigint, wallet: string): Dict {
      const city = liveCity(cfg, pack, id)
      city["influence"] = influence
      city["positive_days"] = period
      city["live_stake"] = 1n
      city["spend_protocol_period"] = 1n
      city["wallet"] = wallet
      city["demo"] = 0n
      return city
    }
    const b = walletCity("b", 10n, ` ${addr}`)
    const z = walletCity("z", 4n, `${addr.toUpperCase()}\n`)
    const g1 = walletCity("g1", 9n, "")
    const g2 = walletCity("g2", 8n, "   ")
    const state = newState(cfg, { b, z, g1, g2 }, {})
    armFund(state, cfg)
    state["season_prize_pool"] = 0n
    const idx = tickIndexAt(cfg, period + 1n, hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const settle = asDict(out["season_settlement"])
    expect(asBig(settle["n_eligible"])).toBe(3n)
    const codes = asList(settle["codes"]).map((c) => asStr(c))
    expect(codes.includes("PRIZE_WALLET_MERGED")).toBe(true)
    const payouts = asList(settle["payouts"])
    const first = asDict(payouts[0])
    expect(asStr(first["wallet"])).toBe(addr)
    expect(asStr(first["city_id"])).toBe("b")
  })

  it("tick_settle_empty_wallet_does_not_collide_with_address", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const period = 30n
    const addr = "0x" + "dd".repeat(20)
    function cityOf(id: string, influence: bigint, wallet: string): Dict {
      const city = liveCity(cfg, pack, id)
      city["influence"] = influence
      city["positive_days"] = period
      city["live_stake"] = 1n
      city["spend_protocol_period"] = 1n
      city["wallet"] = wallet
      city["demo"] = 0n
      return city
    }
    const player = cityOf("b", 10n, addr)
    const spoof = cityOf(addr, 100n, "")
    const state = newState(cfg, { b: player, [addr]: spoof }, {})
    armFund(state, cfg)
    state["season_prize_pool"] = 0n
    const idx = tickIndexAt(cfg, period + 1n, hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const settle = asDict(out["season_settlement"])
    expect(asBig(settle["n_eligible"])).toBe(2n)
    const codes = asList(settle["codes"]).map((c) => asStr(c))
    expect(codes.includes("PRIZE_WALLET_MERGED")).toBe(false)
    const payouts = asList(settle["payouts"]).map((row) => asDict(row))
    const wallets = payouts.map((row) => asStr(row["wallet"]))
    expect(wallets.includes(addr)).toBe(true)
    expect(wallets.includes("")).toBe(true)
  })

  it("tick_settle_seeded_row_copies_city_wallet", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const period = 30n
    const addr = "0x" + "11".repeat(20)
    const b = liveCity(cfg, pack, "b")
    b["wallet"] = addr
    b["season_row"] = {
      city_id: "b",
      influence: 12n,
      positive_days: period,
      live_stake: 1n,
      demo: 0n,
      spend_protocol: 1n,
    }
    const z = liveCity(cfg, pack, "z")
    z["influence"] = 3n
    z["positive_days"] = period
    z["live_stake"] = 1n
    z["spend_protocol_period"] = 1n
    z["wallet"] = ` ${addr.toUpperCase()}\n`
    z["demo"] = 0n
    const state = newState(cfg, { b, z }, {})
    armFund(state, cfg)
    state["season_prize_pool"] = 0n
    const idx = tickIndexAt(cfg, period + 1n, hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const settle = asDict(out["season_settlement"])
    expect(asBig(settle["n_eligible"])).toBe(1n)
    const codes = asList(settle["codes"]).map((c) => asStr(c))
    expect(codes.includes("PRIZE_WALLET_MERGED")).toBe(true)
    const first = asDict(asList(settle["payouts"])[0])
    expect(asStr(first["wallet"])).toBe(addr)
    expect(asStr(first["city_id"])).toBe("b")
  })

  it("tick_settle_slot_keys_hex_space_prefix_and_stake", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const period = 30n
    const addr = "0x" + "ee".repeat(20)
    let inner = "0x"
    for (let i = 0; i < 20; i++) inner += "ee "
    inner = inner.trim()
    const ff = "0x" + "ff".repeat(20)
    function cityOf(id: string, influence: bigint, wallet: string, stake: unknown): Dict {
      const city = liveCity(cfg, pack, id)
      city["influence"] = influence
      city["positive_days"] = period
      city["live_stake"] = stake
      city["spend_protocol_period"] = 1n
      city["wallet"] = wallet
      city["demo"] = 0n
      return city
    }
    const a = cityOf("a", 10n, inner, 1n)
    const b = cityOf("b", 4n, addr, 1n)
    const g1 = cityOf("g1", 9n, "", 1n)
    const lit = cityOf("lit", 20n, "city:g1", 1n)
    const dead = cityOf("dead", 99n, ff, "0")
    const ok = cityOf("ok", 2n, ff, 1n)
    const state = newState(cfg, { a, b, g1, lit, dead, ok }, {})
    armFund(state, cfg)
    state["season_prize_pool"] = 0n
    const idx = tickIndexAt(cfg, period + 1n, hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const settle = asDict(out["season_settlement"])
    expect(asBig(settle["n_eligible"])).toBe(4n)
    const codes = asList(settle["codes"]).map((c) => asStr(c))
    expect(codes.includes("PRIZE_WALLET_MERGED")).toBe(true)
    expect(codes.includes("PRIZE_STAKE_REQUIRED")).toBe(true)
    const payouts = asList(settle["payouts"]).map((row) => asDict(row))
    const wallets = payouts.map((row) => asStr(row["wallet"]))
    expect(wallets.filter((w) => w === addr).length).toBe(1)
    expect(wallets.includes("city:g1")).toBe(true)
    expect(wallets.includes("")).toBe(true)
    expect(wallets.includes(ff)).toBe(true)
    expect(asStr(asDict(payouts.find((row) => asStr(row["wallet"]) === addr) ?? {})["city_id"])).toBe("a")
  })

  it("tick_settle_demo_account_kind_does_not_take_prize", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const period = 30n
    const addr = "0x" + "ab".repeat(20)
    function cityOf(id: string, influence: bigint, wallet: string): Dict {
      const city = liveCity(cfg, pack, id)
      city["influence"] = influence
      city["positive_days"] = period
      city["live_stake"] = 1n
      city["spend_protocol_period"] = 1n
      city["wallet"] = wallet
      city["demo"] = 0n
      return city
    }
    const ghost = cityOf("demo-city", 100n, "")
    ghost["account_kind"] = "demo"
    const player = cityOf("b", 10n, addr)
    player["account_kind"] = "wallet"
    const state = newState(cfg, { "demo-city": ghost, b: player }, {})
    armFund(state, cfg)
    state["season_prize_pool"] = 0n
    const idx = tickIndexAt(cfg, period + 1n, hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const settle = asDict(out["season_settlement"])
    expect(asBig(settle["n_eligible"])).toBe(1n)
    const codes = asList(settle["codes"]).map((c) => asStr(c))
    expect(codes.includes("DEMO_NO_PRIZE")).toBe(true)
    const first = asDict(asList(settle["payouts"])[0])
    expect(asStr(first["wallet"])).toBe(addr)
    expect(asStr(first["city_id"])).toBe("b")
  })

  it("tick_settle_nbsp_hex_and_padded_stake", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const hour = asBig(cfg["efficiency_recalc_hour"])
    const period = 30n
    const addr = "0x" + "12".repeat(20)
    const nbsp = "0x" + "12".repeat(10) + "\u00a0" + "12".repeat(10)
    function cityOf(id: string, influence: bigint, wallet: string, stake: unknown): Dict {
      const city = liveCity(cfg, pack, id)
      city["influence"] = influence
      city["positive_days"] = period
      city["live_stake"] = stake
      city["spend_protocol_period"] = 1n
      city["wallet"] = wallet
      city["demo"] = 0n
      return city
    }
    const a = cityOf("a", 8n, nbsp, " 1")
    const b = cityOf("b", 3n, addr, 1n)
    const dead = cityOf("dead", 50n, "w-pad", " 0")
    const state = newState(cfg, { a, b, dead }, {})
    armFund(state, cfg)
    state["season_prize_pool"] = 0n
    const idx = tickIndexAt(cfg, period + 1n, hour)
    const [out] = tick(state, makeInputs(cfg, idx))
    const settle = asDict(out["season_settlement"])
    expect(asBig(settle["n_eligible"])).toBe(1n)
    const codes = asList(settle["codes"]).map((c) => asStr(c))
    expect(codes.includes("PRIZE_WALLET_MERGED")).toBe(true)
    expect(codes.includes("PRIZE_STAKE_REQUIRED")).toBe(true)
    const first = asDict(asList(settle["payouts"])[0])
    expect(asStr(first["wallet"])).toBe(addr)
    expect(asStr(first["city_id"])).toBe("a")
  })
})

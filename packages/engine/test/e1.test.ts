import { describe, expect, it } from "vitest"
import { loadConfig, newState, tick, TickError } from "../src/index.ts"
import { asBig, asDict } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { armFund, liveCity, loadPack, makeInputs } from "./harness.ts"

function cashbox(state: Dict): bigint {
  let sum = asBig(state["fund"])
  const cities = asDict(state["cities"])
  for (const id of Object.keys(cities)) {
    sum += asBig(asDict(cities[id])["capital"])
  }
  return sum
}

function twoCities(cfg: Dict, pack: Dict): Dict {
  const a = liveCity(cfg, pack, "a")
  const b = liveCity(cfg, pack, "b")
  a["output_base"] = 300n
  b["output_base"] = 100n
  return newState(cfg, { a, b }, {})
}

describe("e1_payroll_boost", () => {
  it("e1_empty_fund_pays_zero", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const state = twoCities(cfg, pack)
    state["fund"] = 0n
    const ticks = asBig(cfg["ticks_day"])
    const div = asBig(cfg["payroll_daily_divisor"])
    state["tick_budget"] = ticks * div
    state["day_budget"] = asBig(state["tick_budget"])
    state["day_budget_day"] = asBig(cfg["anchor_day"])
    const stepped = tick(state, makeInputs(cfg, 1n))
    const cities = asDict(stepped[0]["cities"])
    expect(asBig(asDict(cities["a"])["payout"])).toBe(0n)
    expect(asBig(asDict(cities["b"])["payout"])).toBe(0n)
  })

  it("e1_unit_fund_two_cities", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const state = twoCities(cfg, pack)
    state["fund"] = 1n
    const ticks = asBig(cfg["ticks_day"])
    const div = asBig(cfg["payroll_daily_divisor"])
    state["tick_budget"] = ticks * div
    state["day_budget"] = asBig(state["tick_budget"])
    state["day_budget_day"] = asBig(cfg["anchor_day"])
    if (asBig(state["capital_outstanding"]) < 1n) state["capital_outstanding"] = 1n
    if (asBig(state["vault_corp"]) < 1n) state["vault_corp"] = 1n
    try {
      const stepped = tick(state, makeInputs(cfg, 1n))
      const cities = asDict(stepped[0]["cities"])
      const paid = asBig(asDict(cities["a"])["payout"]) + asBig(asDict(cities["b"])["payout"])
      expect(paid <= 1n).toBe(true)
    } catch (err) {
      expect(err).toBeInstanceOf(TickError)
      expect((err as TickError).code).toBe("I4_ZERO_PAY")
      expect((err as TickError).code).not.toBe("I4_OVER_BUDGET")
    }
  })

  it("e1_huge_boost_within_budget", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    cfg["payroll_boost_bps"] = 1_000_000n
    cfg["payroll_boost_launch_bps"] = 1_000_000n
    const state = twoCities(cfg, pack)
    armFund(state, cfg, 200n)
    state["day_budget_day"] = null
    const stepped = tick(state, makeInputs(cfg, 0n))
    expect(asBig(asDict(stepped[0]["acc"])["payroll_paid"]) <= asBig(stepped[0]["tick_budget"])).toBe(true)
  })

  it("e1_cashbox_100_ticks", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const state = twoCities(cfg, pack)
    armFund(state, cfg, 200n)
    state["reserve_corp"] = 0n
    state["reserve_cork"] = 0n
    state["day_budget_day"] = null
    const before = cashbox(state)
    let cur = state
    for (let i = 0n; i < 100n; i += 1n) {
      cur = tick(cur, makeInputs(cfg, i))[0]
    }
    expect(cashbox(cur)).toBe(before)
  })

  it("e1_under_budget_publishes_launch_boost", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const city = liveCity(cfg, pack)
    city["functions"] = [{ id: "workshop", level: 1n }]
    city["agents"] = [
      {
        id: "e1",
        role: "engineer",
        building_id: "workshop",
        objective: "produce",
        level: 1n,
        xp: 0n,
        level_mult_bps: asBig(cfg["bps"]),
        traits: [],
      },
    ]
    city["energy_stock"] = 1_000_000n
    const state = newState(cfg, { a: city }, {})
    armFund(state, cfg, 1_000_000n)
    const stepped = tick(state, makeInputs(cfg, 0n, { city_id: "a" }))
    const ratio = asBig(stepped[0]["payroll_ratio_bps"])
    expect(ratio > asBig(cfg["bps"])).toBe(true)
    expect(ratio <= asBig(cfg["payroll_boost_launch_bps"])).toBe(true)
  })
})

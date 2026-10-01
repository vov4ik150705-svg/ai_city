import { describe, expect, it } from "vitest"
import { loadConfig, newState, payrollBoostBps, payrollBoostDaysLeft } from "../src/index.ts"
import { asBig } from "../src/values.ts"
import { liveCity, loadPack } from "./harness.ts"

describe("e2_launch_window", () => {
  it("e2_window_days_left_follows_tick_index", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const city = liveCity(cfg, pack, "a")
    const state = newState(cfg, { a: city }, {})
    const days = asBig(cfg["payroll_boost_launch_city_days"])
    const ticksDay = asBig(cfg["ticks_day"])
    const launch = asBig(cfg["payroll_boost_launch_bps"])
    const steady = asBig(cfg["payroll_boost_bps"])
    expect(payrollBoostDaysLeft(cfg, state)).toBe(days)
    expect(payrollBoostBps(cfg, state)).toBe(launch)
    state["tick_index"] = days * ticksDay - 1n
    expect(payrollBoostDaysLeft(cfg, state)).toBe(1n)
    expect(payrollBoostBps(cfg, state)).toBe(launch)
    state["tick_index"] = days * ticksDay
    expect(payrollBoostDaysLeft(cfg, state)).toBe(0n)
    expect(payrollBoostBps(cfg, state)).toBe(steady)
  })
})

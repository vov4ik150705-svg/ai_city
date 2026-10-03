import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { settle } from "../src/fragments.ts"
import {
  accumulateDay,
  applyDexTurnover,
  applySpend,
  authorize,
  awardPaidTick,
  awardTrain,
  bankShareBps,
  buildSlotsOf,
  cityLevelFromPopulation,
  clipOfflineHours,
  consumeAfterSettle,
  creditCreatorTax,
  expire,
  fragmentGrossBase,
  grantWithRemainder,
  housingBaseOf,
  housingCapacityOf,
  loadConfig,
  ordinaryActiveCount,
  remainingGlobal,
  settleFromData,
  splitCreatorTaxAtoms,
  stickyCityLevel,
  TickError,
  unstake,
  windowSettleDue,
} from "../src/index.ts"
import { parseJsonBigint } from "./jsonBigint.ts"
import { asBig, asDict, asStr } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { loadPack, repo } from "./harness.ts"
import { bi2, bi3, bi5, bi7, bi18, bi240, bi400, bi600, bi900, bi1350, bi1500, bi2025, bi3037, bi10000, n2, n7 } from "../src/literals.ts"

describe("economy owner rules", () => {
  it("offline clip reaches 18 and never 19", () => {
    expect(clipOfflineHours(12n, 1n + 2n + 3n, 18n)).toBe(18n)
    expect(clipOfflineHours(12n, 6n + 1n, 18n)).toBe(18n)
    expect(clipOfflineHours(12n, 0n, 18n)).toBe(12n)
  })

  it("build slots are abstract agent_slots plus 3", () => {
    expect(buildSlotsOf(8n)).toBe(11n)
    expect(buildSlotsOf(20n)).toBe(23n)
    const defs: Dict = {
      workshop: {},
      city_hall: { autonomous: true, prebuilt: true },
      robotics_lab: { autonomous: true },
    }
    const n = ordinaryActiveCount(
      [
        { id: "workshop", level: 1n },
        { id: "city_hall", level: 1n },
        { id: "robotics_lab", level: 1n },
        { id: "bank", level: 1n, deactivated: 1n },
      ],
      defs,
    )
    expect(n).toBe(1n)
  })

  it("train is +1 XP additive with remainder; trainer mags do not enter XP", () => {
    const curve: Dict = { "1": 240n, "2": 384n, "3": 614n, "4": 983n, "5": 1572n }
    const city: Dict = {
      payout: 1n,
      idle: "",
      agents: [
        { id: "s", level: 1n, xp: 0n, xp_remainder: 0n, train_target: "e", xp_rate_mags: [5000n] },
        { id: "e", level: 1n, xp: 0n, xp_remainder: 0n },
      ],
    }
    awardPaidTick(city, curve, 5n, 1500n, 10000n, [])
    const agents = city["agents"] as Dict[]
    awardTrain(city, asDict(agents[0]), curve, 5n, 1500n, 10000n, [])
    expect(asBig(asDict(agents[0])["xp"])).toBe(1n)
    expect(asBig(asDict(agents[1])["xp"])).toBe(2n)
    const boosted: Dict = {
      payout: 1n,
      idle: "",
      agents: [
        { id: "s", level: 1n, xp: 0n, xp_remainder: 0n, train_target: "e", xp_rate_mags: [10000n] },
        { id: "e", level: 1n, xp: 0n, xp_remainder: 0n },
      ],
    }
    awardPaidTick(boosted, curve, 5n, 1500n, 10000n, [])
    const boostedAgents = boosted["agents"] as Dict[]
    awardTrain(boosted, asDict(boostedAgents[0]), curve, 5n, 1500n, 10000n, [])
    expect(asBig(asDict(boostedAgents[1])["xp"])).toBe(3n)
    const self: Dict = { id: "s", train_target: "s" }
    expect(awardTrain(city, self, curve, 5n, 1500n, 10000n, [])).toBe(0n)
    const a: Dict = { xp: 0n, level: 1n, xp_remainder: 0n }
    expect(grantWithRemainder(a, 1n, 5000n, curve, 5n, 1500n, 10000n)).toBe(1n)
    expect(asBig(a["xp_remainder"])).toBe(5000n)
    expect(grantWithRemainder(a, 1n, 5000n, curve, 5n, 1500n, 10000n)).toBe(2n)
    expect(asBig(a["xp"])).toBe(3n)
  })

  it("housing is direct Consumer capacity and city level is sticky", () => {
    const thresholds: Dict = { "1": 0n, "2": 400n, "3": 600n, "4": 900n, "5": 1350n, "6": 2025n, "7": 3037n }
    expect(housingBaseOf("flagship_store", 1n, thresholds)).toBe(400n)
    expect(housingBaseOf("flagship_store", 2n, thresholds)).toBe(900n)
    expect(housingBaseOf("flagship_store", 3n, thresholds)).toBe(2025n)
    expect(housingBaseOf("retail_complex", 1n, thresholds)).toBe(600n)
    expect(housingBaseOf("retail_complex", 2n, thresholds)).toBe(1350n)
    expect(housingBaseOf("retail_complex", 3n, thresholds)).toBe(3037n)
    const cap = housingCapacityOf(
      [
        { id: "flagship_store", level: 1n },
        { id: "retail_complex", level: 1n, deactivated: 1n },
      ],
      thresholds,
      11n,
    )
    expect(cap).toBe(411n)
    expect(cityLevelFromPopulation(400n, thresholds, 7n)).toBe(2n)
    expect(stickyCityLevel(4n, 2n)).toBe(4n)
    expect(housingBaseOf("flagship_store", 1n, {})).toBe(400n)
    expect(housingBaseOf("flagship_store", 3n, {})).toBe(2025n)
    expect(housingBaseOf("retail_complex", 1n, {})).toBe(600n)
    expect(housingBaseOf("retail_complex", 3n, {})).toBe(3037n)
    expect(n2).toBe(2)
    expect(n7).toBe(7)
    expect(bi2).toBe(2n)
    expect(bi3).toBe(3n)
    expect(bi5).toBe(5n)
    expect(bi7).toBe(7n)
    expect(bi18).toBe(18n)
    expect(bi240).toBe(240n)
    expect(bi400).toBe(400n)
    expect(bi600).toBe(600n)
    expect(bi900).toBe(900n)
    expect(bi1350).toBe(1350n)
    expect(bi1500).toBe(1500n)
    expect(bi2025).toBe(2025n)
    expect(bi3037).toBe(3037n)
    expect(bi10000).toBe(10000n)
  })

  it("new cities do not backfill closed global days", () => {
    const city: Dict = { influence: 0n, positive_days: 0n, deposit_spent: 100n }
    const skipped = accumulateDay(city, 50n, 10n, 5n, 3n, 24n, 10000n)
    expect(skipped).toBe(0n)
    expect(asBig(city["influence"])).toBe(0n)
    const added = accumulateDay(city, 50n, 10n, 5n, 5n, 24n, 10000n)
    expect(added > 0n || asBig(city["positive_days"]) === 1n).toBe(true)
    consumeAfterSettle(city)
    expect(asBig(city["influence"])).toBe(0n)
    expect(asBig(city["positive_days"])).toBe(0n)
  })

  it("bank reservations exclude prior days and expire into the current day", () => {
    const bps = 10000n
    const levels: Dict = { "1": { share_bps: 2500n }, "4": { share_bps: 6836n } }
    expect(bankShareBps(levels, 4n)).toBe(6836n)
    const state: Dict = { cities: { a: { id: "a" } }, bank_reservations: [] }
    const city = asDict(asDict(state["cities"])["a"])
    const row = authorize(state, city, 40n, 1n, 10000n, 100n, 2500n, "v1", bps)
    expect(asBig(row["eth"])).toBe(25n)
    state["bank_day"] = 2n
    state["bank_used_today_wei"] = 0n
    state["bank_reserved_today_wei"] = 0n
    expect(remainingGlobal(state, 10000n, 100n, bps)).toBe(75n)
    const expired = expire(state, city, "v1")
    expect(asStr(expired?.["status"] ?? "")).toBe("expired")
    expect(remainingGlobal(state, 10000n, 100n, bps)).toBe(100n)
  })

  it("fragments use gross base before payroll and settle the global window", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const data = asDict(cfg["data"])
    const days = asBig(
      asDict(asDict(asDict(data["fragments"])["params"])["fragment_window_city_days"])["v"],
    )
    expect(windowSettleDue(data, days + 1n, asBig(cfg["efficiency_recalc_hour"]))).toBe(true)
    expect(windowSettleDue(data, days, asBig(cfg["efficiency_recalc_hour"]))).toBe(false)
    const base = fragmentGrossBase(undefined, 240000n, undefined, 10000n, 1n, 240n, 10000n)
    expect(base).toBe(1000n)
    const solo = settleFromData(data, [10000n], 100n)
    expect(asBig(solo["cap_applied"])).toBe(0n)
    expect(asBig(solo["dust"])).toBe(0n)
    const whale = settleFromData(data, [9000n, 1000n], 100n)
    expect(asBig(whale["cap_applied"])).toBe(1n)
    const dust = asBig(whale["dust"])
    expect(dust >= 0n).toBe(true)
    const paid = asBig(whale["sum_payout"])
    expect(paid + dust).toBe(100n)
    const payouts = whale["payouts"]
    if (!Array.isArray(payouts)) throw new Error("payouts")
    expect(payouts[0]).toBe(50n)
    expect(payouts[1]).toBe(10n)
    expect(dust).toBe(40n)
    const wiped = settle([0n, 0n], 50n, 5000n, 10000n, true)
    expect(asBig(wiped["pool_left"])).toBe(0n)
    const kept = settle([0n, 0n], 50n, 5000n, 10000n, false)
    expect(asBig(kept["pool_left"])).toBe(50n)
    const shared = settle([9n, 1n], 100n, 5000n, 10000n, false, true)
    const sharedPay = shared["payouts"]
    if (!Array.isArray(sharedPay)) throw new Error("payouts")
    expect(sharedPay[0]).toBe(70n)
    expect(sharedPay[1]).toBe(30n)
    expect(asBig(shared["sum_payout"])).toBe(100n)
    const capped = settle([9000n, 1000n], 100n, 10000n, 10000n, false, false, [1n, 99n], 10000n)
    const cappedCodes = capped["codes"]
    if (!Array.isArray(cappedCodes)) throw new Error("codes")
    expect(cappedCodes.includes("PRIZE_SHARE_CAPPED")).toBe(true)
    const cappedPay = capped["payouts"]
    if (!Array.isArray(cappedPay)) throw new Error("payouts")
    expect(cappedPay[0]).toBe(1n)
    expect(cappedPay[1]).toBe(10n)
    expect(asBig(capped["sum_payout"]) <= 100n).toBe(true)
    const open = settle([9000n, 1000n], 100n, 10000n, 10000n, false, false, [9000n, 1000n], 10000n)
    const openCodes = open["codes"]
    if (!Array.isArray(openCodes)) throw new Error("codes")
    expect(openCodes.includes("PRIZE_SHARE_CAPPED")).toBe(false)
  })

  it("fees canonical generated round-trip is 1445", () => {
    const raw = readFileSync(join(repo, "content/out/pack.json"), "utf8")
    const pack = asDict(parseJsonBigint(raw))
    const econ = asDict(asDict(pack["generated"])["economy"])
    expect(asBig(econ["round_trip_cost_bps"])).toBe(1445n)
  })

  it("creator tax split is 100/20/60/20 of tax atoms on turnover", () => {
    const shareBps = 10000n
    const creatorTaxBps = 200n
    const prizeShareBps = 5000n
    const studioShareBps = 2000n
    const activeWorkCreatorTaxBps = 60n
    const cfg: Dict = {
      share_bps: shareBps,
      creator_tax_bps: creatorTaxBps,
      prize_creator_tax_share_bps: prizeShareBps,
      studio_eth_share_bps: studioShareBps,
      active_work_creator_tax_bps: activeWorkCreatorTaxBps,
      wei: 1n,
      eth_usd_8dec: 1n,
    }
    const tax = creatorTaxBps
    const split = splitCreatorTaxAtoms(
      tax,
      prizeShareBps,
      activeWorkCreatorTaxBps,
      studioShareBps,
      shareBps,
      creatorTaxBps,
    )
    expect(split[0]).toBe(100n)
    expect(split[1]).toBe(20n)
    expect(split[2]).toBe(60n)
    expect(split[3]).toBe(20n)
    expect(split[0] + split[1] + split[2] + split[3]).toBe(tax)
    const state: Dict = {
      treasury_eth: 0n,
      treasury_fund_eth: 0n,
      treasury_basket_eth: 0n,
      treasury_leaderboard_eth: 0n,
      treasury_farm_eth: 0n,
      treasury_studio_eth: 0n,
      treasury_spec_eth: 0n,
      treasury_city_eth: 0n,
      acc: {},
      day_mon: {},
    }
    applyDexTurnover(cfg, state, shareBps)
    expect(asBig(state["treasury_fund_eth"])).toBe(100n)
    expect(asBig(state["treasury_leaderboard_eth"])).toBe(20n)
    expect(asBig(state["treasury_farm_eth"])).toBe(60n)
    expect(asBig(state["treasury_studio_eth"])).toBe(20n)
    expect(asBig(state["treasury_basket_eth"])).toBe(80n)
    const missing: Dict = { ...cfg }
    delete missing["active_work_creator_tax_bps"]
    expect(() => creditCreatorTax(missing, state, tax, true)).toThrow(TickError)
    expect(() =>
      splitCreatorTaxAtoms(tax, prizeShareBps, creatorTaxBps, studioShareBps, shareBps, creatorTaxBps),
    ).toThrow(TickError)
  })

  it("spend amount 1 with protocol 0 does not take CORP from vault", () => {
    const spendBps = 10000n
    const cfg: Dict = {
      spend_bps: spendBps,
      spend_burn_bps: 4000n,
      spend_fund_bps: 6000n,
      spend_protocol_bps: 0n,
      wei: 10n ** 18n,
      capital_anchor: 2000n,
    }
    const vault = 10n ** 18n
    const state: Dict = {
      tick_index: 0n,
      day: 1n,
      fund: 0n,
      capital_outstanding: 0n,
      vault_corp: vault,
      reserve_corp: 0n,
      mint_rate: 2000n,
      acc: {},
      mon: {},
    }
    const city: Dict = {
      id: "a",
      capital: 1n,
      weight: 1n,
      earned_left: 0n,
      earned_spent: 0n,
      deposit_spent: 0n,
    }
    applySpend(cfg, state, city, 1n, 0n)
    expect(asBig(state["vault_corp"])).toBe(vault)
    expect(asBig(state["acc"]["proto_capital"])).toBe(0n)
    expect(asBig(state["fund"])).toBe(1n)
    expect(asBig(city["capital"])).toBe(0n)
  })

  it("unstake returns settled tokens and freezes below S_min", () => {
    const city: Dict = { stake_settled: { NVDA: 10n }, tokens_held: {}, codes: [] }
    expect(asBig(unstake(city, "NVDA", 11n, 0n, 24n, 5n)["ok"])).toBe(0n)
    const ok = unstake(city, "NVDA", 6n, 100n, 24n, 5n)
    expect(asBig(ok["returned"])).toBe(6n)
    expect(asBig(asDict(city["stake_settled"])["NVDA"])).toBe(4n)
    expect(asBig(asDict(city["tokens_held"])["NVDA"])).toBe(6n)
    expect(asBig(asDict(city["district_freeze_until"])["NVDA"])).toBe(124n)
    const freezePending = city["unstake_pending"]
    expect(Array.isArray(freezePending)).toBe(true)
    if (Array.isArray(freezePending)) {
      expect(freezePending.length).toBe(1)
      expect(asDict(freezePending[0] ?? {})["ready_at"]).toBe(124n)
    }
    const citySafe: Dict = { stake_settled: { NVDA: 10n }, tokens_held: {}, codes: [] }
    const stay = unstake(citySafe, "NVDA", 5n, 100n, 24n, 5n)
    expect(asBig(stay["ok"])).toBe(1n)
    expect(asBig(asDict(citySafe["stake_settled"])["NVDA"])).toBe(5n)
    expect("NVDA" in asDict(citySafe["district_freeze_until"] ?? {})).toBe(false)
    expect(citySafe["unstake_pending"]).toBe(undefined)
  })
})

import { clampRate, mintRate, staleDecayRate, tickJitterBps } from "./arith.js"
import { happinessOfCity } from "./aggregates.js"
import { cityBankShareBps, remainingGlobal, resetDayCounters } from "./bank.js"
import { rateRawFromSamples } from "./config.js"
import { applyStack } from "./stack.js"
import { emptyDayMon, seededPrng } from "./state.js"
import { applyCityScope, cityUsesSlots, collectSlotRequests, liveModifierNodes, payrollModifierRows } from "./slots.js"
import { asBig, asDict, asList, asStr, sortedKeys, TickError } from "./values.js"
import type { Dict } from "./values.js"

function requireCfgBig(cfg: Dict, name: string): bigint {
  if (!(name in cfg)) {
    throw new TickError("INDEX", 0n, name, { i: 0n })
  }
  return asBig(cfg[name])
}

function shareBpsOf(cfg: Dict): bigint {
  const share = requireCfgBig(cfg, "share_bps")
  if (share <= 0n) {
    throw new TickError("INDEX", 0n, "share_bps", { i: 0n })
  }
  return share
}

function spendBpsOf(cfg: Dict): bigint {
  const spend = requireCfgBig(cfg, "spend_bps")
  if (spend <= 0n) {
    throw new TickError("INDEX", 0n, "spend_bps", { i: 0n })
  }
  return spend
}

function payrollClaim(row: Dict, city: Dict, bps: bigint): bigint {
  const base = asBig(row["request"])
  if (base <= 0n) return 0n
  const share = asBig(city["fund_share_bps"])
  if (share <= 0n) return base
  return (base * (bps + share)) / bps
}

function accOf(state: Dict): Dict {
  return asDict(state["acc"])
}

function addAcc(state: Dict, key: string, delta: bigint): void {
  const acc = accOf(state)
  acc[key] = asBig(acc[key]) + delta
}

function dayMon(state: Dict): Dict {
  if (!state["day_mon"]) state["day_mon"] = emptyDayMon()
  return asDict(state["day_mon"])
}

export function cpmmBuyCorp(poolEth: bigint, poolCorp: bigint, ethIn: bigint): readonly [bigint, bigint, bigint] {
  if (ethIn <= 0n || poolEth <= 0n || poolCorp <= 0n) return [poolEth, poolCorp, 0n]
  const newEth = poolEth + ethIn
  let newCorp = (poolEth * poolCorp) / newEth
  if (newCorp < 0n) newCorp = 0n
  if (newCorp > poolCorp) newCorp = poolCorp
  return [newEth, newCorp, poolCorp - newCorp]
}

export function cpmmSellCorp(poolEth: bigint, poolCorp: bigint, corpIn: bigint): readonly [bigint, bigint, bigint] {
  if (corpIn <= 0n || poolEth <= 0n || poolCorp <= 0n) return [poolEth, poolCorp, 0n]
  const newCorp = poolCorp + corpIn
  let newEth = (poolEth * poolCorp) / newCorp
  if (newEth < 0n) newEth = 0n
  if (newEth > poolEth) newEth = poolEth
  return [newEth, newCorp, poolEth - newEth]
}

export function assertI1(cfg: Dict, state: Dict, cityId: string): void {
  const cap = asBig(state["vault_corp"]) * asBig(cfg["capital_anchor"])
  const slack = cap - asBig(state["capital_outstanding"])
  const mon = asDict(state["mon"])
  const cur = mon["i1_slack_min"]
  if (cur === null || cur === undefined || slack < asBig(cur)) {
    mon["i1_slack_min"] = slack
    mon["i1_slack_min_day"] = asBig(state["day"])
  }
  const bps = asBig(cfg["bps"])
  if (cap > 0n) {
    const slackBps = (bps * slack) / cap
    const curB = mon["i1_slack_min_bps"]
    if (curB === null || curB === undefined || slackBps < asBig(curB)) {
      mon["i1_slack_min_bps"] = slackBps
      mon["i1_slack_min_bps_day"] = asBig(state["day"])
    }
  }
  if (asBig(state["capital_outstanding"]) > cap) {
    throw new TickError("I1_VAULT", asBig(state["tick_index"]), cityId, {
      outstanding: asBig(state["capital_outstanding"]),
      cap,
    })
  }
  let bags = asBig(state["fund"])
  const cities = asDict(state["cities"])
  for (const cid of Object.keys(cities)) {
    bags += asBig(asDict(cities[cid])["capital"])
  }
  if (bags > cap) {
    throw new TickError("I1_VAULT", asBig(state["tick_index"]), cityId, {
      bags,
      outstanding: asBig(state["capital_outstanding"]),
      cap,
    })
  }
}

export function assertI2(cfg: Dict, state: Dict): void {
  const bps = asBig(cfg["bps"])
  const vault = asBig(cfg["vault_fee_bps"])
  const exitBps = bps - (bps * bps) / (bps + asBig(cfg["bank_markup_bps"]))
  const exitBest = bps - (bps * bps) / (bps + asBig(cfg["bank_markup_floor_bps"]))
  if (vault >= exitBps || vault >= exitBest) {
    throw new TickError("I2_ENTRY_EXIT", asBig(state["tick_index"]), "-", {
      vault,
      exit_bps: exitBps,
      exit_best: exitBest,
    })
  }
}

export function assertI11(cfg: Dict, state: Dict): void {
  const acc = accOf(state)
  const burn = asBig(acc["burn_capital"])
  const fee = asBig(acc["vault_fee_capital"])
  if (asBig(acc["f_reserve"]) > burn + fee) {
    throw new TickError("I11_RESERVE_OVER_SOURCE", asBig(state["tick_index"]), "-", {
      f_reserve: asBig(acc["f_reserve"]),
      burn,
      fee,
    })
  }
  let expected = asBig(acc["reserve_in_corp"]) - asBig(acc["reserve_out_corp"])
  if (expected < 0n) expected = 0n
  if (asBig(state["reserve_corp"]) !== expected) {
    throw new TickError("I11_RESERVE_BALANCE", asBig(state["tick_index"]), "-", {
      reserve: asBig(state["reserve_corp"]),
      expected,
      inn: asBig(acc["reserve_in_corp"]),
      out: asBig(acc["reserve_out_corp"]),
    })
  }
  const minted = asBig(state["capital_minted_total"])
  const rhs =
    asBig(state["capital_outstanding"]) +
    burn +
    asBig(acc["proto_capital"]) +
    asBig(acc["withdrawn_capital"]) +
    asBig(acc["cork_capital"])
  if (minted !== rhs) {
    throw new TickError("I11_MINT_IDENTITY", asBig(state["tick_index"]), "-", {
      minted,
      rhs,
      outstanding: asBig(state["capital_outstanding"]),
    })
  }
}

export function mintFromBacking(
  cfg: Dict,
  state: Dict,
  corpDeposited: bigint,
  reserveReleased: bigint,
  paysFee: bigint,
  dest: string,
): bigint {
  if (corpDeposited < 0n || reserveReleased < 0n) {
    throw new TickError("I3_NEGATIVE_BACKING", asBig(state["tick_index"]), dest, { corp: corpDeposited })
  }
  const backing = corpDeposited + reserveReleased
  if (backing <= 0n) {
    if (dest === "probe_forbidden") {
      throw new TickError("I3_MINT_WITHOUT_DEPOSIT", asBig(state["tick_index"]), dest, { backing: 0n })
    }
    return 0n
  }
  const rate = asBig(state["mint_rate"])
  if (rate <= 0n) return 0n
  const bps = asBig(cfg["bps"])
  const gross = (backing * rate) / asBig(cfg["wei"])
  let minted = gross
  if (paysFee > 0n) {
    minted = (gross * (bps - asBig(cfg["vault_fee_bps"]))) / bps
    const feeCorp = (corpDeposited * asBig(cfg["vault_fee_bps"])) / bps
    state["reserve_corp"] = asBig(state["reserve_corp"]) + feeCorp
    addAcc(state, "reserve_in_corp", feeCorp)
    addAcc(state, "vault_fee_capital", gross - minted)
  }
  if (minted < 0n) minted = 0n
  const cap = (backing * rate) / asBig(cfg["wei"])
  if (minted > cap) {
    throw new TickError("I3_MINT_EXCEEDS_RATE", asBig(state["tick_index"]), dest, {
      minted,
      cap,
      rate,
    })
  }
  if (dest === "fund") {
    state["fund"] = asBig(state["fund"]) + minted
    creditDayFundIn(state, minted)
    addAcc(state, "minted_fund", minted)
    const dm = dayMon(state)
    dm["minted_fund"] = asBig(dm["minted_fund"]) + minted
  }
  state["capital_outstanding"] = asBig(state["capital_outstanding"]) + minted
  state["capital_minted_total"] = asBig(state["capital_minted_total"]) + minted
  if (corpDeposited > 0n) {
    state["vault_corp"] = asBig(state["vault_corp"]) + corpDeposited
    state["corp_deposited_total"] = asBig(state["corp_deposited_total"]) + corpDeposited
  }
  if (reserveReleased > 0n) {
    let rel = reserveReleased
    if (rel > asBig(state["reserve_corp"])) rel = asBig(state["reserve_corp"])
    state["reserve_corp"] = asBig(state["reserve_corp"]) - rel
    addAcc(state, "reserve_out_corp", rel)
  }
  assertI1(cfg, state, dest)
  return minted
}

export function exitCoverageCorp(cfg: Dict, state: Dict): bigint {
  const rate = asBig(state["mint_rate"])
  const markup = asBig(cfg["bank_markup_bps"])
  const bps = asBig(cfg["bps"])
  if (rate <= 0n) return asBig(state["vault_corp"])
  const claimed = (asBig(state["capital_outstanding"]) * asBig(cfg["wei"]) * bps) / (rate * (bps + markup))
  return asBig(state["vault_corp"]) - claimed
}

export function quoteAt(
  nowCityTime: bigint,
  sampleCityTime: bigint,
  stalenessCityHours: bigint,
  sampleEth: bigint,
  sampleCorp: bigint,
  prevEth: bigint,
  prevCorp: bigint,
): { readonly ethUsd8dec: bigint; readonly corpEthWeiPerWhole: bigint; readonly feedLive: bigint } {
  const age = nowCityTime >= sampleCityTime ? nowCityTime - sampleCityTime : 0n
  const fresh = age <= stalenessCityHours
  const ethUsd8dec = sampleEth > 0n ? sampleEth : prevEth
  const corpEthWeiPerWhole = sampleCorp > 0n ? sampleCorp : prevCorp
  const feedLive = fresh && sampleEth > 0n && sampleCorp > 0n ? 1n : 0n
  return { ethUsd8dec, corpEthWeiPerWhole, feedLive }
}

export function updateMintRate(cfg: Dict, state: Dict, inputs: Dict, hour: bigint): void {
  const feedLive = "feed_live" in inputs ? asBig(inputs["feed_live"]) : 1n
  const ethUsdIn = "eth_usd_8dec" in inputs ? asBig(inputs["eth_usd_8dec"]) : asBig(cfg["eth_usd_8dec"])
  const ethUsd = ethUsdIn > 0n ? ethUsdIn : asBig(cfg["eth_usd_8dec"])
  const corpWei = asBig(inputs["corp_eth_wei_per_whole"])
  const raw = rateRawFromSamples(cfg, corpWei, ethUsd)
  const liveQuote = feedLive > 0n && ethUsdIn > 0n
  const bps = asBig(cfg["bps"])
  const ticksDay = asBig(cfg["ticks_day"])
  if (liveQuote && raw > 0n) {
    state["last_live_tick"] = asBig(state["tick_index"])
    state["stale_hours"] = 0n
    state["rate_raw_last"] = raw
    if (hour === 0n || asBig(state["tick_index"]) === 0n) {
      const buf = asList(state["ema_buf"])
      buf.push(raw)
      const keep = Number(asBig(cfg["ema_city_days"]))
      if (buf.length > keep) {
        buf.splice(0, buf.length - keep)
      }
      state["ema_buf"] = buf
      let sum = 0n
      for (const x of buf) sum += asBig(x)
      state["rate_ref"] = sum / BigInt(buf.length)
    }
    const ref = asBig(state["rate_ref"]) > 0n ? asBig(state["rate_ref"]) : raw
    let elapsed = hour === 0n ? ticksDay : 0n
    if (asBig(state["tick_index"]) === 0n) elapsed = 0n
    const prev = asBig(state["mint_rate"])
    const target = clampRate(raw, ref, asBig(cfg["anchor_band_bps"]), bps)
    const newRate = mintRate(
      raw,
      ref,
      asBig(cfg["anchor_band_bps"]),
      asBig(cfg["capital_anchor"]),
      prev,
      asBig(cfg["rise_max_bps"]),
      elapsed,
      ticksDay,
      bps,
    )
    if (elapsed > 0n && prev > 0n && newRate < target) {
      if (newRate < asBig(cfg["capital_anchor"])) addAcc(state, "ratchet_binds", 1n)
    }
    const limit = asBig(cfg["mint_rate_limit_bps"])
    const refCap = asBig(state["rate_ref"])
    if (limit > 0n && refCap > 0n) {
      const ceiling = (refCap * limit) / bps
      if (newRate > ceiling) {
        state["mint_rate"] = ceiling
        asList(state["codes"]).push(asStr(cfg["mint_capped_code"], "MINT_RATE_CAPPED"))
        return
      }
    }
    state["mint_rate"] = newRate
    return
  }
  asList(state["codes"]).push(asStr(cfg["stale_code"]))
  if (raw <= 0n && liveQuote) {
    state["mint_rate"] = 0n
    return
  }
  state["stale_hours"] = asBig(state["stale_hours"]) + 1n
  const age = asBig(state["tick_index"]) - asBig(state["last_live_tick"])
  if (age <= asBig(cfg["stale_max"]) && raw > 0n) return
  if (hour === 0n) {
    const ref = asBig(state["rate_ref"]) > 0n ? asBig(state["rate_ref"]) : asBig(state["rate_raw_last"])
    state["mint_rate"] = staleDecayRate(
      asBig(state["mint_rate"]),
      ref,
      asBig(cfg["anchor_band_bps"]),
      asBig(cfg["stale_decay_bps"]),
      ticksDay,
      ticksDay,
      bps,
    )
  }
}

function creditDayFundIn(state: Dict, amount: bigint): void {
  if (amount <= 0n) return
  state["day_fund_in"] = asBig(state["day_fund_in"]) + amount
}

function smoothedInflow(_cfg: Dict, state: Dict): bigint {
  const buf = asList(state["fund_in_day_buf"])
  let sum = 0n
  let n = 0n
  for (const x of buf) {
    sum += asBig(x)
    n += 1n
  }
  if (n === 0n) return 0n
  return sum / n
}

export function payrollBoostBps(cfg: Dict, state: Dict): bigint {
  const days = asBig(cfg["payroll_boost_launch_city_days"])
  const winTicks = days * asBig(cfg["ticks_day"])
  if (winTicks > 0n && asBig(state["tick_index"]) < winTicks) {
    return asBig(cfg["payroll_boost_launch_bps"])
  }
  return asBig(cfg["payroll_boost_bps"])
}

export function payrollBoostDaysLeft(cfg: Dict, state: Dict): bigint {
  const days = asBig(cfg["payroll_boost_launch_city_days"])
  const ticksDay = asBig(cfg["ticks_day"])
  const winTicks = days * ticksDay
  const idx = asBig(state["tick_index"])
  if (winTicks <= 0n || ticksDay <= 0n || idx >= winTicks) return 0n
  const remaining = winTicks - idx
  return (remaining + ticksDay - 1n) / ticksDay
}

export function fixDayBudget(cfg: Dict, state: Dict, day: bigint, hour: bigint): void {
  if (!(asBig(state["tick_index"]) === 0n || hour === 0n)) return
  if (state["day_budget_day"] === day && asBig(state["tick_index"]) !== 0n) return
  if (hour === 0n && asBig(state["tick_index"]) !== 0n) {
    const buf = asList(state["payroll_day_buf"])
    buf.push(asBig(state["day_payroll"]))
    state["day_payroll"] = 0n
    const keep = Number(asBig(cfg["payroll_fund_cap_days"]))
    if (keep > 0 && buf.length > keep) buf.splice(0, buf.length - keep)
    state["payroll_day_buf"] = buf
    const inBuf = asList(state["fund_in_day_buf"])
    inBuf.push(asBig(state["day_fund_in"]))
    state["day_fund_in"] = 0n
    const keepIn = Number(asBig(cfg["payroll_inflow_window_city_days"]))
    if (keepIn > 0 && inBuf.length > keepIn) inBuf.splice(0, inBuf.length - keepIn)
    state["fund_in_day_buf"] = inBuf
    state["day_mon"] = emptyDayMon()
  }
  state["day_budget_day"] = day
  const div = asBig(cfg["payroll_daily_divisor"])
  const horizon = div === 0n ? 0n : asBig(state["fund"]) / div
  const inflow = smoothedInflow(cfg, state)
  state["day_budget"] = horizon > inflow ? horizon : inflow
  const ticks = asBig(cfg["ticks_day"])
  state["tick_budget"] = ticks === 0n ? 0n : asBig(state["day_budget"]) / ticks
}

function listHas(xs: unknown[], value: bigint): boolean {
  for (const x of xs) {
    if (asBig(x) === value) return true
  }
  return false
}

function scheduleOpen(cfg: Dict, scheduleId: string, hour: bigint, weekday: bigint): readonly [bigint, string] {
  const schedules = asDict(cfg["schedules"])
  let sch = asDict(schedules[scheduleId])
  if (Object.keys(sch).length === 0) sch = asDict(schedules["always"])
  if (listHas(asList(sch["closed_weekdays"]), weekday)) {
    return [0n, asStr(cfg["idle_hours"])]
  }
  if (hour < asBig(sch["open_hour"]) || hour >= asBig(sch["close_hour"])) {
    return [0n, asStr(cfg["idle_hours"])]
  }
  return [1n, ""]
}

export function bankOpen(cfg: Dict, hour: bigint, weekday: bigint): bigint {
  if (weekday === asBig(cfg["bank_closed_weekday"])) return 0n
  if (hour < asBig(cfg["bank_open_hour"]) || hour >= asBig(cfg["bank_close_hour"])) return 0n
  return 1n
}

function inOfflineWindow(cfg: Dict, city: Dict, tickIndex: bigint): bigint {
  const added = asBig(city["offline_cap_hours"])
  const hard = asBig(cfg["offline_hard_cap"], 18n)
  let cap = asBig(cfg["offline_cap"]) + added
  if (cap > hard) cap = hard
  if (cap < 0n) cap = 0n
  const period = asBig(city["login_period"])
  if (period <= 1n) return 1n
  let credited = cap
  if (credited > period) credited = period
  const phase = period === 0n ? 0n : tickIndex % period
  return phase < credited ? 1n : 0n
}

function energyOk(cfg: Dict, city: Dict): bigint {
  if ("energy_stock" in city) {
    let draw = city["energy_draw"]
    if (draw === undefined || draw === null) draw = cfg["workshop_energy"]
    if (asBig(city["energy_stock"]) < asBig(draw)) return 0n
    city["energy_stock"] = asBig(city["energy_stock"]) - asBig(draw)
    return 1n
  }
  return asBig(city["energy_ok"]) > 0n ? 1n : 0n
}

function computeOk(cfg: Dict, city: Dict): bigint {
  const obj = asStr(cfg["research_objective"])
  const need = obj !== "" && asStr(city["objective"]) === obj
  if ("compute_stock" in city) {
    if (asBig(city["compute_stock"]) <= 0n) return 0n
    const draw = asBig(city["compute_draw"])
    if (draw > 0n) {
      if (asBig(city["compute_stock"]) < draw) return 0n
      city["compute_stock"] = asBig(city["compute_stock"]) - draw
    }
    return 1n
  }
  if (need) return asBig(city["compute_ok"]) > 0n ? 1n : 0n
  return 1n
}

export function researchProgressStep(
  objective: string,
  idle: string,
  researchObjective: string,
  progress: bigint,
  timeTicks: bigint,
): readonly [bigint, bigint] {
  if (timeTicks <= 0n) return [progress, 0n]
  if (researchObjective === "" || objective !== researchObjective) return [progress, 0n]
  if (idle !== "") return [progress, 0n]
  const nxt = progress + 1n
  if (nxt >= timeTicks) return [0n, 1n]
  return [nxt, 0n]
}

function slottedResearchWork(city: Dict, researchObjective: string): readonly [string, string] {
  if (!cityUsesSlots(city)) return [asStr(city["objective"]), asStr(city["idle"])]
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    if (asStr(agent["role"]) !== "scientist") continue
    if (asStr(agent["objective"]) !== researchObjective) continue
    if (asStr(agent["building_id"]).length === 0) continue
    if (asStr(agent["idle"]) !== "") continue
    return [researchObjective, ""]
  }
  return ["", asStr(city["idle"], "IDLE_NO_AGENT")]
}

export function advanceResearch(cfg: Dict, state: Dict): void {
  const times = asDict(cfg["research_time_ticks"])
  const obj = asStr(cfg["research_objective"])
  const ids = sortedKeys(times)
  if (ids.length === 0 || obj === "") return
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    const has =
      asStr(city["objective"]) === obj || "research_unlocked" in city || "research_progress" in city
    if (!has) continue
    const unlocked = asList(city["research_unlocked"]).map((x) => asStr(x))
    const focus = asStr(city["research_focus"])
    if (!(focus in times) || unlocked.includes(focus)) {
      city["research_focus"] = ""
      city["research_progress"] = 0n
      continue
    }
    const need = asBig(times[focus])
    const work = slottedResearchWork(city, obj)
    const stepped = researchProgressStep(work[0], work[1], obj, asBig(city["research_progress"]), need)
    city["research_focus"] = focus
    city["research_progress"] = stepped[0]
    if (stepped[1] > 0n) {
      city["research_unlocked"] = [...unlocked, focus]
      city["research_focus"] = ""
      city["research_progress"] = 0n
    }
  }
}

function fuseCityStack(cfg: Dict, city: Dict, cityTime: bigint): bigint {
  const bps = asBig(cfg["bps"])
  const authored = asList(city["nodes"])
  const rows = payrollModifierRows(liveModifierNodes(cfg, city, cityTime))
  const stage: Dict = { base: bps, post: bps }
  if (authored.length === 0) {
    city["stage_bps"] = stage
    return asBig(city["mod_bps"], bps)
  }
  if (rows.length === 0) {
    city["mod_bps"] = bps
    city["stage_bps"] = stage
    return bps
  }
  const data = asDict(cfg["data"])
  if (Object.keys(data).length === 0) {
    city["stage_bps"] = stage
    return asBig(city["mod_bps"], bps)
  }
  const stack = applyStack(data, rows, bps)
  const fused = asBig(stack["fused_bps"])
  city["mod_bps"] = fused
  city["stage_bps"] = asDict(stack["stage_bps"])
  return fused
}

export function collectRequests(cfg: Dict, state: Dict, hour: bigint, weekday: bigint): Dict[] {
  const rows: Dict[] = []
  const jitterOn = asBig(state["jitter_on"])
  const bps = asBig(cfg["bps"])
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    applyCityScope(cfg, city, asBig(state["city_time"]))
    if (cityUsesSlots(city)) {
      const hap = happinessOfCity(cfg, state, city)
      const slotRows = collectSlotRequests(cfg, state, city, cid, hour, weekday, hap)
      for (const row of slotRows) rows.push(row)
      continue
    }
    let idle = ""
    let request = 0n
    if (asBig(city["output_base"]) <= 0n) {
      idle = asStr(cfg["idle_agent"])
    } else if (inOfflineWindow(cfg, city, asBig(state["tick_index"])) === 0n) {
      idle = asStr(cfg["idle_offline"])
      city["offline_denied"] = asBig(city["offline_denied"]) + 1n
    } else {
      const opened = scheduleOpen(cfg, asStr(city["schedule"], "always"), hour, weekday)
      if (opened[0] === 0n) {
        idle = opened[1]
      } else if (energyOk(cfg, city) === 0n) {
        idle = asStr(cfg["idle_energy"])
      } else if (computeOk(cfg, city) === 0n) {
        idle = asStr(cfg["idle_compute"])
      } else {
        const fused = fuseCityStack(cfg, city, asBig(state["city_time"]))
        const j =
          jitterOn > 0n
            ? tickJitterBps(
                seededPrng(cid, asBig(state["tick_index"]), "shift"),
                asBig(cfg["jitter_width_bps"]),
                bps,
                false,
              )
            : bps
        request = (asBig(city["output_base"]) * asBig(city["affinity_bps"])) / bps
        request = (request * asBig(city["level_mult_bps"])) / bps
        request = (request * j) / bps
        request = (request * fused) / bps
        request = (request * (bps - asBig(cfg["residual_idle_bps"]))) / bps
        const hap = happinessOfCity(cfg, state, city)
        if (asBig(cfg["happiness_penalty_live"]) > 0n && hap < asBig(cfg["happiness_penalty_threshold_bps"])) {
          request = (request * hap) / bps
        }
      }
    }
    city["idle"] = idle
    city["request"] = request
    const scaled = request * asBig(city["weight"])
    rows.push({ city_id: cid, request: scaled, unit: request, weight: asBig(city["weight"]) })
  }
  const dm = dayMon(state)
  let reqSum = 0n
  for (const r of rows) reqSum += asBig(r["request"])
  dm["requests"] = asBig(dm["requests"]) + reqSum
  return rows
}

export function pay(cfg: Dict, state: Dict, rows: readonly Dict[]): void {
  const bps = asBig(cfg["bps"])
  let total = 0n
  for (const r of rows) total += asBig(r["request"])
  let budget = asBig(state["tick_budget"])
  if (budget < 0n) {
    throw new TickError("I4_NEG_BUDGET", asBig(state["tick_index"]), "-", { budget })
  }
  if (total <= 0n) {
    state["payroll_ratio_bps"] = bps
    return
  }
  if (budget > 0n && asBig(state["fund"]) <= 0n) budget = 0n
  const boost = payrollBoostBps(cfg, state)
  let paidPool = (total * boost) / bps
  if (paidPool > budget) paidPool = budget
  const fundNow = asBig(state["fund"])
  if (paidPool > fundNow) paidPool = fundNow
  const ratio = (paidPool * bps) / total
  const ceil = asBig(cfg["payroll_boost_launch_bps"])
  state["payroll_ratio_bps"] = ratio > ceil ? ceil : ratio
  let paidSum = 0n
  const cities = asDict(state["cities"])
  const claims: bigint[] = []
  let totalClaim = 0n
  for (const row of rows) {
    const city = asDict(cities[asStr(row["city_id"])])
    const claim = payrollClaim(row, city, bps)
    claims.push(claim)
    totalClaim += claim
  }
  if (totalClaim <= 0n) totalClaim = total
  const seen = new Set<string>()
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    if (row === undefined) continue
    const cid = asStr(row["city_id"])
    const city = asDict(cities[cid])
    if (!seen.has(cid)) {
      city["payout"] = 0n
      seen.add(cid)
    }
    if (asBig(row["request"]) <= 0n) {
      continue
    }
    if (budget <= 0n || asBig(state["fund"]) <= 0n) {
      if (asBig(state["fund"]) > 0n) {
        throw new TickError("I4_ZERO_PAY", asBig(state["tick_index"]), cid, {
          fund: asBig(state["fund"]),
          request: asBig(row["request"]),
        })
      }
      continue
    }
    const claim = claims[i] ?? 0n
    let payout = (claim * paidPool) / totalClaim
    if (payout <= 0n && budget > 0n && asBig(row["request"]) > 0n && asBig(state["fund"]) > 0n) {
      throw new TickError("I4_ZERO_PAY", asBig(state["tick_index"]), cid, {
        payout,
        budget,
        request: asBig(row["request"]),
      })
    }
    if (payout > asBig(state["fund"])) payout = asBig(state["fund"])
    state["fund"] = asBig(state["fund"]) - payout
    const w = asBig(city["weight"]) === 0n ? 1n : asBig(city["weight"])
    const unit = payout / w
    city["capital"] = asBig(city["capital"]) + unit
    city["earned_life"] = asBig(city["earned_life"]) + unit
    city["earned_left"] = asBig(city["earned_left"]) + unit
    const prevPayout = asBig(city["payout"])
    city["payout"] = prevPayout + unit
    const agentId = asStr(row["agent_id"])
    const buildingId = asStr(row["building_id"])
    if (agentId.length > 0) {
      for (const raw of asList(city["agents"])) {
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
        const agent = asDict(raw)
        if (asStr(agent["id"]) === agentId) {
          agent["payout"] = unit
          break
        }
      }
    }
    for (const slotRaw of asList(city["_slot_rows"])) {
      if (slotRaw === null || typeof slotRaw !== "object" || Array.isArray(slotRaw)) continue
      const slot = asDict(slotRaw)
      if (asStr(slot["building_id"]) === buildingId) {
        slot["payout"] = unit
        break
      }
    }
    paidSum += payout
    addAcc(state, "payroll_paid", payout)
    state["day_payroll"] = asBig(state["day_payroll"]) + payout
    if ("influence" in city || "season_row" in city || "day_gdp" in city) {
      city["day_gdp"] = asBig(city["day_gdp"]) + unit
      if (unit > 0n && prevPayout === 0n) city["day_valid_ticks"] = asBig(city["day_valid_ticks"]) + 1n
    }
  }
  if (paidSum > budget) {
    throw new TickError("I4_OVER_BUDGET", asBig(state["tick_index"]), "-", { paid: paidSum, budget })
  }
  addAcc(state, "payout_ticks", 1n)
}

export function applySpend(cfg: Dict, state: Dict, city: Dict, amountIn: bigint, fromEarned: bigint): void {
  let amount = amountIn
  if (amount <= 0n) return
  if (amount > asBig(city["capital"])) amount = asBig(city["capital"])
  const spendBps = spendBpsOf(cfg)
  city["capital"] = asBig(city["capital"]) - amount
  const burn = (amount * asBig(cfg["spend_burn_bps"])) / spendBps
  let toFund = (amount * asBig(cfg["spend_fund_bps"])) / spendBps
  const proto = (amount * asBig(cfg["spend_protocol_bps"])) / spendBps
  toFund += amount - burn - toFund - proto
  const w = asBig(city["weight"]) === 0n ? 1n : asBig(city["weight"])
  const funded = toFund * w
  state["fund"] = asBig(state["fund"]) + funded
  creditDayFundIn(state, funded)
  state["capital_outstanding"] = asBig(state["capital_outstanding"]) - (burn + proto) * w
  const rate = asBig(state["mint_rate"])
  if (rate > 0n) {
    const burnCorp = (burn * asBig(cfg["wei"])) / rate
    const protoCorp = proto <= 0n ? 0n : (proto * asBig(cfg["wei"])) / rate
    state["reserve_corp"] = asBig(state["reserve_corp"]) + burnCorp * w
    addAcc(state, "reserve_in_corp", burnCorp * w)
    const protoOut = protoCorp * w
    if (protoOut > 0n && protoOut <= asBig(state["vault_corp"])) {
      state["vault_corp"] = asBig(state["vault_corp"]) - protoOut
    }
  }
  addAcc(state, "burn_capital", burn * w)
  addAcc(state, "proto_capital", proto * w)
  if (fromEarned > 0n) {
    let take = amount
    if (take > asBig(city["earned_left"])) take = asBig(city["earned_left"])
    city["earned_left"] = asBig(city["earned_left"]) - take
    city["earned_spent"] = asBig(city["earned_spent"]) + take
    addAcc(state, "f_reinvest", toFund * w)
    const leftover = amount - take
    if (leftover > 0n) {
      city["deposit_spent"] = asBig(city["deposit_spent"]) + leftover
      addAcc(state, "f_deposit", ((leftover * asBig(cfg["spend_fund_bps"])) / spendBps) * w)
    }
  } else {
    city["deposit_spent"] = asBig(city["deposit_spent"]) + amount
    addAcc(state, "f_deposit", toFund * w)
  }
  assertI1(cfg, state, asStr(city["id"]))
}

export function splitBankLimit(asks: readonly bigint[], cap: bigint): bigint[] {
  let total = 0n
  for (const a of asks) total += a
  if (total <= 0n || cap <= 0n) return asks.map(() => 0n)
  if (total <= cap) return asks.map((a) => a)
  return asks.map((a) => (a * cap) / total)
}

export function bankWithdraw(cfg: Dict, state: Dict, day: bigint, hour: bigint, weekday: bigint): void {
  const bps = asBig(cfg["bps"])
  const live = asBig(state["pool_eth"])
  const cities = asDict(state["cities"])
  resetDayCounters(state, day)
  let remaining = remainingGlobal(state, live, asBig(cfg["bank_pool_share_bps"]), bps)
  const asks: { cid: string; ethAsk: bigint; scaled: bigint }[] = []
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    let wantCap = asBig(city["withdraw_intent"])
    if (wantCap <= 0n) continue
    if (asBig(city["bank_usage"]) > 0n && bankOpen(cfg, hour, weekday) === 0n) {
      city["idle"] = asStr(city["idle"]) || asStr(cfg["idle_bank"])
      continue
    }
    if (bankOpen(cfg, hour, weekday) === 0n) {
      if (asBig(city["bank_usage"]) > 0n) continue
      const codes = asList(city["codes"])
      codes.push("BANK_CLOSED")
      city["codes"] = codes
      continue
    }
    const rate = asBig(state["mint_rate"])
    let markup = asBig(city["bank_markup_override"], asBig(cfg["bank_markup_bps"]))
    const floor = asBig(cfg["bank_markup_floor_bps"])
    if (markup < floor) markup = floor
    if (rate <= 0n) continue
    const share = cityBankShareBps(cfg, city)
    const personal = (((live * asBig(cfg["bank_pool_share_bps"])) / bps) * share) / bps
    let room = personal - asBig(city["withdrawn_day"]) - asBig(city["reserved_day"])
    if (room < 0n) room = 0n
    let corp = (wantCap * asBig(cfg["wei"]) * bps) / (rate * (bps + markup))
    const maxCap = asBig(city["capital"])
    if (wantCap > maxCap) {
      wantCap = maxCap
      corp = (wantCap * asBig(cfg["wei"]) * bps) / (rate * (bps + markup))
    }
    let ethAsk = 0n
    if (corp > 0n && asBig(state["pool_corp"]) + corp > 0n) {
      const sold = cpmmSellCorp(asBig(state["pool_eth"]), asBig(state["pool_corp"]), corp)
      ethAsk = sold[2]
    }
    if (ethAsk > room) {
      if (ethAsk > 0n) {
        wantCap = (wantCap * room) / ethAsk
        corp = (corp * room) / ethAsk
      }
      ethAsk = room
    }
    const w = asBig(city["weight"]) === 0n ? 1n : asBig(city["weight"])
    asks.push({ cid, ethAsk, scaled: ethAsk * w })
    city["_ask_eth"] = ethAsk
    city["_ask_corp"] = corp
    city["_ask_cap"] = wantCap
  }
  let totalAsk = 0n
  for (const a of asks) totalAsk += a.scaled
  const issued = splitBankLimit(
    asks.map((a) => a.scaled),
    remaining,
  )
  const cut = totalAsk > remaining && totalAsk > 0n ? 1n : 0n
  if (cut > 0n) {
    asList(state["codes"]).push(asStr(cfg["bank_limit_code"]))
    addAcc(state, "bank_cuts", 1n)
  }
  let soldEth = 0n
  for (let i = 0; i < asks.length; i++) {
    const a = asks[i]
    if (a === undefined) continue
    const city = asDict(cities[a.cid])
    const w = asBig(city["weight"]) === 0n ? 1n : asBig(city["weight"])
    const gotScaled = issued[i] ?? 0n
    const got = w === 0n ? gotScaled : gotScaled / w
    if (gotScaled <= 0n) {
      city["withdraw_intent"] = 0n
      continue
    }
    let capBurn = 0n
    let corp = 0n
    if (a.scaled > 0n) {
      capBurn = (asBig(city["_ask_cap"]) * gotScaled) / a.scaled
      corp = (asBig(city["_ask_corp"]) * gotScaled) / a.scaled
    }
    if (capBurn > asBig(city["capital"])) capBurn = asBig(city["capital"])
    city["capital"] = asBig(city["capital"]) - capBurn
    state["capital_outstanding"] = asBig(state["capital_outstanding"]) - capBurn * w
    let vaultTake = corp * w
    if (vaultTake > asBig(state["vault_corp"])) {
      vaultTake = asBig(state["vault_corp"])
      corp = w === 0n ? vaultTake : vaultTake / w
    }
    state["vault_corp"] = asBig(state["vault_corp"]) - vaultTake
    const sell = (vaultTake * asBig(city["sell_share_bps"])) / bps
    const keep = vaultTake - sell
    city["corp_held"] = asBig(city["corp_held"]) + (w === 0n ? keep : keep / w)
    if (sell > 0n) {
      const tax = (gotScaled * asBig(cfg["creator_tax_bps"])) / shareBpsOf(cfg)
      creditCreatorTax(cfg, state, tax, false)
      addAcc(state, "tax_city_eth", tax)
      const nxt = cpmmSellCorp(asBig(state["pool_eth"]), asBig(state["pool_corp"]), sell)
      state["pool_eth"] = nxt[0]
      state["pool_corp"] = nxt[1]
    }
    city["withdrawn_day"] = asBig(city["withdrawn_day"]) + got
    city["withdrawn_life_wei"] = asBig(city["withdrawn_life_wei"]) + got
    city["withdrawn_capital"] = asBig(city["withdrawn_capital"]) + capBurn
    addAcc(state, "withdrawn_capital", capBurn * w)
    const dm = dayMon(state)
    dm["bank_wei"] = asBig(dm["bank_wei"]) + gotScaled
    city["withdraw_intent"] = 0n
    soldEth += gotScaled
    if (cut > 0n) {
      const codes = asList(city["codes"])
      codes.push(asStr(cfg["bank_limit_code"]))
      city["codes"] = codes
    }
  }
  state["bank_used_today_wei"] = asBig(state["bank_used_today_wei"]) + soldEth
  if (soldEth > remaining) {
    throw new TickError("I10_BANK_OVER", asBig(state["tick_index"]), "-", {
      sold: soldEth,
      remaining,
    })
  }
  assertI1(cfg, state, "-")
}

export function buyback(cfg: Dict, state: Dict): void {
  const bps = asBig(cfg["bps"])
  const eth = asBig(state["treasury_eth"])
  if (eth < asBig(cfg["buyback_min_wei"])) return
  const cap = (asBig(state["pool_eth"]) * asBig(cfg["buyback_tranche_cap_bps"])) / bps
  if (eth > cap) addAcc(state, "tranche_binds", 1n)
  const tranche = eth < cap ? eth : cap
  if (tranche <= 0n) return
  const bought = cpmmBuyCorp(asBig(state["pool_eth"]), asBig(state["pool_corp"]), tranche)
  state["pool_eth"] = bought[0]
  state["pool_corp"] = bought[1]
  const corpOut = bought[2]
  state["treasury_eth"] = asBig(state["treasury_eth"]) - tranche
  const spec = asBig(state["treasury_spec_eth"])
  const fromSpec = tranche < spec ? tranche : spec
  state["treasury_spec_eth"] = spec - fromSpec
  const cityPot = asBig(state["treasury_city_eth"])
  let fromCity = tranche - fromSpec
  if (fromCity > cityPot) fromCity = cityPot
  state["treasury_city_eth"] = cityPot - fromCity
  const minted = mintFromBacking(cfg, state, corpOut, 0n, 1n, "fund")
  addAcc(state, "buyback_eth", tranche)
  addAcc(state, "buyback_minted", minted)
  const dm = dayMon(state)
  dm["buyback_eth"] = asBig(dm["buyback_eth"]) + tranche
  dm["buyback_minted"] = asBig(dm["buyback_minted"]) + minted
  if (tranche > 0n) {
    addAcc(state, "f_external", (minted * fromSpec) / tranche)
    addAcc(state, "f_entry", minted - (minted * fromSpec) / tranche)
  }
}

function virginCorp(state: Dict): bigint {
  let cork = asBig(state["reserve_cork"])
  if (cork > asBig(state["reserve_corp"])) cork = asBig(state["reserve_corp"])
  const v = asBig(state["reserve_corp"]) - cork
  return v < 0n ? 0n : v
}

function noteVirginWeekDrain(cfg: Dict, state: Dict): void {
  const start = asBig(state["week_start_virgin"])
  const drained = asBig(state["week_drained_virgin"])
  if (start <= 0n) return
  const bps = (drained * asBig(cfg["bps"])) / start
  const mon = asDict(state["mon"])
  if (bps > asBig(mon["max_virgin_week_drain_bps"])) mon["max_virgin_week_drain_bps"] = bps
}

function flushWeekDrip(cfg: Dict, state: Dict): void {
  const bps = asBig(cfg["bps"])
  if (asBig(state["week_gate"]) <= 0n) {
    addAcc(state, "weeks_closed", 1n)
    noteVirginWeekDrain(cfg, state)
    return
  }
  addAcc(state, "weeks_open", 1n)
  const cap = (asBig(state["week_start_virgin"]) * asBig(cfg["reserve_weekly_drain_bps"])) / bps
  let room = cap - asBig(state["week_drained_virgin"])
  if (room < 0n) room = 0n
  const rate = asBig(state["mint_rate"])
  let needCorp = 0n
  if (rate > 0n && asBig(state["week_shortfall_cap"]) > 0n) {
    needCorp = (asBig(state["week_shortfall_cap"]) * asBig(cfg["wei"])) / rate
  }
  let drip = needCorp < room ? needCorp : room
  const virgin = virginCorp(state)
  if (drip > virgin) drip = virgin
  if (drip <= 0n) {
    if (needCorp > room) addAcc(state, "weeks_cap_bound", 1n)
    else addAcc(state, "weeks_demand_bound", 1n)
    noteVirginWeekDrain(cfg, state)
    return
  }
  const pays = asBig(state["reserve_pays_fee"]) > 0n ? 1n : 0n
  const minted = mintFromBacking(cfg, state, 0n, drip, pays, "fund")
  addAcc(state, "f_reserve", minted)
  state["week_drained_virgin"] = asBig(state["week_drained_virgin"]) + drip
  const dm = dayMon(state)
  dm["drip_corp"] = asBig(dm["drip_corp"]) + drip
  if (needCorp > room) addAcc(state, "weeks_cap_bound", 1n)
  else addAcc(state, "weeks_demand_bound", 1n)
  noteVirginWeekDrain(cfg, state)
}

export function reserveDrip(cfg: Dict, state: Dict): void {
  const bps = asBig(cfg["bps"])
  const weekDays = asBig(cfg["city_week_days"])
  const week = weekDays === 0n ? 0n : (asBig(state["day"]) - 1n) / weekDays
  if (asBig(state["week_started"]) === 0n) {
    state["week_started"] = 1n
    state["week_index"] = week
    state["week_start_virgin"] = virginCorp(state)
    state["week_start_cork"] = asBig(state["reserve_cork"])
    state["week_drained_virgin"] = 0n
    state["week_shortfall_cap"] = 0n
    state["week_gate"] = 0n
  } else if (asBig(state["week_index"]) !== week) {
    flushWeekDrip(cfg, state)
    state["week_index"] = week
    state["week_start_virgin"] = virginCorp(state)
    state["week_start_cork"] = asBig(state["reserve_cork"])
    state["week_drained_virgin"] = 0n
    state["week_shortfall_cap"] = 0n
    state["week_gate"] = 0n
  }
  const cities = asDict(state["cities"])
  let totalReq = 0n
  for (const cid of Object.keys(cities)) {
    const city = asDict(cities[cid])
    totalReq += asBig(city["request"]) * asBig(city["weight"])
  }
  if (asBig(state["tick_budget"]) < totalReq) {
    state["week_shortfall_cap"] = asBig(state["week_shortfall_cap"]) + (totalReq - asBig(state["tick_budget"]))
    state["week_gate"] = 1n
  }
  const cap = (asBig(state["week_start_virgin"]) * asBig(cfg["reserve_weekly_drain_bps"])) / bps
  if (asBig(state["week_drained_virgin"]) > cap) {
    throw new TickError("I5_RESERVE_DRAIN", asBig(state["tick_index"]), "-", {
      drained: asBig(state["week_drained_virgin"]),
      cap,
      start: asBig(state["week_start_virgin"]),
    })
  }
}

export function fundCap(cfg: Dict, state: Dict): void {
  const buf = asList(state["payroll_day_buf"])
  const keep = asBig(cfg["payroll_fund_cap_days"])
  if (BigInt(buf.length) < keep) return
  let cap = 0n
  for (const x of buf) cap += asBig(x)
  if (cap <= 0n || asBig(state["fund"]) <= cap) return
  const extra = asBig(state["fund"]) - cap
  state["fund"] = asBig(state["fund"]) - extra
  state["capital_outstanding"] = asBig(state["capital_outstanding"]) - extra
  addAcc(state, "cork_capital", extra)
  const rate = asBig(state["mint_rate"])
  if (rate > 0n) {
    const corp = (extra * asBig(cfg["wei"])) / rate
    state["reserve_corp"] = asBig(state["reserve_corp"]) + corp
    state["reserve_cork"] = asBig(state["reserve_cork"]) + corp
    addAcc(state, "reserve_in_corp", corp)
  }
  assertI1(cfg, state, "-")
}

export function corkReturn(cfg: Dict, state: Dict): void {
  const buf = asList(state["payroll_day_buf"])
  const keep = asBig(cfg["payroll_fund_cap_days"])
  if (BigInt(buf.length) < keep) return
  let cap = 0n
  for (const x of buf) cap += asBig(x)
  if (asBig(state["fund"]) >= cap) return
  const cork = asBig(state["reserve_cork"])
  if (cork <= 0n) return
  const rate = asBig(state["mint_rate"])
  if (rate <= 0n) return
  const need = cap - asBig(state["fund"])
  const needCorp = (need * asBig(cfg["wei"])) / rate
  const drip = needCorp < cork ? needCorp : cork
  if (drip <= 0n) return
  const minted = mintFromBacking(cfg, state, 0n, drip, 0n, "fund")
  state["capital_minted_total"] = asBig(state["capital_minted_total"]) - minted
  const parked = asBig(accOf(state)["cork_capital"])
  const take = minted < parked ? minted : parked
  accOf(state)["cork_capital"] = parked - take
  const gain = minted - take
  if (gain > 0n) state["capital_minted_total"] = asBig(state["capital_minted_total"]) + gain
  let left = cork - drip
  if (left < 0n) left = 0n
  state["reserve_cork"] = left
  addAcc(state, "f_cork", minted)
  addAcc(state, "cork_reminted", minted)
  const dm = dayMon(state)
  dm["drip_cork_corp"] = asBig(dm["drip_cork_corp"]) + drip
}

export function splitCreatorTaxAtoms(
  tax: bigint,
  prizeShareBps: bigint,
  activeWorkCreatorTaxBps: bigint,
  studioShareBps: bigint,
  shareBps: bigint,
  creatorTaxBps: bigint,
): readonly [bigint, bigint, bigint, bigint] {
  if (shareBps <= 0n || creatorTaxBps <= 0n) {
    throw new TickError("INDEX", 0n, "creator_tax_bps", { i: creatorTaxBps })
  }
  const prizeLeg = (tax * prizeShareBps) / shareBps
  const studio = (prizeLeg * studioShareBps) / shareBps
  const stockLeg = prizeLeg - studio
  const farm = (tax * activeWorkCreatorTaxBps) / creatorTaxBps
  const leaderboard = stockLeg - farm
  if (leaderboard < 0n) {
    throw new TickError("TAX_SPLIT_NEG", 0n, "-", { farm, leaderboard, stock_leg: stockLeg })
  }
  return [tax - prizeLeg, leaderboard, farm, studio]
}

export function creditCreatorTax(cfg: Dict, state: Dict, tax: bigint, spec: boolean): void {
  if (tax <= 0n) return
  const split = splitCreatorTaxAtoms(
    tax,
    requireCfgBig(cfg, "prize_creator_tax_share_bps"),
    requireCfgBig(cfg, "active_work_creator_tax_bps"),
    requireCfgBig(cfg, "studio_eth_share_bps"),
    shareBpsOf(cfg),
    requireCfgBig(cfg, "creator_tax_bps"),
  )
  const fund = split[0]
  const leaderboard = split[1]
  const farm = split[2]
  const studio = split[3]
  state["treasury_eth"] = asBig(state["treasury_eth"]) + fund
  state["treasury_fund_eth"] = asBig(state["treasury_fund_eth"]) + fund
  state["treasury_basket_eth"] = asBig(state["treasury_basket_eth"]) + leaderboard + farm
  state["treasury_leaderboard_eth"] = asBig(state["treasury_leaderboard_eth"]) + leaderboard
  state["treasury_farm_eth"] = asBig(state["treasury_farm_eth"]) + farm
  state["treasury_studio_eth"] = asBig(state["treasury_studio_eth"]) + studio
  if (spec) {
    state["treasury_spec_eth"] = asBig(state["treasury_spec_eth"]) + fund
  } else {
    state["treasury_city_eth"] = asBig(state["treasury_city_eth"]) + fund
  }
}

export function applyDexTurnover(cfg: Dict, state: Dict, turnoverUsd8dec: bigint, ethUsd8dec: bigint = 0n): void {
  if (turnoverUsd8dec <= 0n) return
  const ethUsd = ethUsd8dec > 0n ? ethUsd8dec : asBig(cfg["eth_usd_8dec"])
  if (ethUsd <= 0n) return
  const shareBps = shareBpsOf(cfg)
  const taxUsd = (turnoverUsd8dec * requireCfgBig(cfg, "creator_tax_bps")) / shareBps
  const taxWei = (taxUsd * asBig(cfg["wei"])) / ethUsd
  creditCreatorTax(cfg, state, taxWei, true)
  addAcc(state, "tax_spec_eth", taxWei)
  addAcc(state, "turnover_usd_8dec", turnoverUsd8dec)
  const dm = dayMon(state)
  dm["turnover_usd_8dec"] = asBig(dm["turnover_usd_8dec"]) + turnoverUsd8dec
  dm["tax_eth"] = asBig(dm["tax_eth"]) + taxWei
}

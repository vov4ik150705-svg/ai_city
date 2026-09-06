import { clampRate, mintRate, staleDecayRate, tickJitterBps } from "./arith.js"
import { happinessOfCity } from "./aggregates.js"
import { rateRawFromSamples } from "./config.js"
import { applyStack } from "./stack.js"
import { emptyDayMon, seededPrng } from "./state.js"
import { asBig, asDict, asList, asStr, sortedKeys, TickError } from "./values.js"
import type { Dict } from "./values.js"

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

export function updateMintRate(cfg: Dict, state: Dict, inputs: Dict, hour: bigint): void {
  const feedLive = "feed_live" in inputs ? asBig(inputs["feed_live"]) : 1n
  const ethUsd = "eth_usd_8dec" in inputs ? asBig(inputs["eth_usd_8dec"]) : asBig(cfg["eth_usd_8dec"])
  const corpWei = asBig(inputs["corp_eth_wei_per_whole"])
  const raw = rateRawFromSamples(cfg, corpWei, ethUsd)
  const bps = asBig(cfg["bps"])
  const ticksDay = asBig(cfg["ticks_day"])
  if (feedLive > 0n && raw > 0n) {
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
    state["mint_rate"] = newRate
    return
  }
  asList(state["codes"]).push(asStr(cfg["stale_code"]))
  if (raw <= 0n && feedLive > 0n) {
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
    state["day_mon"] = emptyDayMon()
  }
  state["day_budget_day"] = day
  const div = asBig(cfg["payroll_daily_divisor"])
  state["day_budget"] = div === 0n ? 0n : asBig(state["fund"]) / div
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
  const cap = asBig(cfg["offline_cap"])
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
    let focus = asStr(city["research_focus"])
    if (!(focus in times) || unlocked.includes(focus)) {
      focus = ""
      for (const nid of ids) {
        if (!unlocked.includes(nid)) {
          focus = nid
          break
        }
      }
    }
    if (focus === "") {
      city["research_focus"] = ""
      city["research_progress"] = 0n
      continue
    }
    const need = asBig(times[focus])
    const stepped = researchProgressStep(
      asStr(city["objective"]),
      asStr(city["idle"]),
      obj,
      asBig(city["research_progress"]),
      need,
    )
    city["research_focus"] = focus
    city["research_progress"] = stepped[0]
    if (stepped[1] > 0n) {
      city["research_unlocked"] = [...unlocked, focus]
      city["research_focus"] = ""
      city["research_progress"] = 0n
    }
  }
}

function fuseCityStack(cfg: Dict, city: Dict): bigint {
  const bps = asBig(cfg["bps"])
  const rows = asList(city["nodes"]).map((r) => asDict(r))
  const stage: Dict = { base: bps, post: bps }
  if (rows.length === 0) {
    city["stage_bps"] = stage
    return asBig(city["mod_bps"], bps)
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
        const fused = fuseCityStack(cfg, city)
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
  const ratio = total === 0n ? bps : (budget * bps) / total
  state["payroll_ratio_bps"] = ratio > bps ? bps : ratio
  if (budget > 0n && asBig(state["fund"]) <= 0n) budget = 0n
  let paidSum = 0n
  const cities = asDict(state["cities"])
  for (const row of rows) {
    const city = asDict(cities[asStr(row["city_id"])])
    if (asBig(row["request"]) <= 0n) {
      city["payout"] = 0n
      continue
    }
    if (budget <= 0n || asBig(state["fund"]) <= 0n) {
      city["payout"] = 0n
      if (asBig(state["fund"]) > 0n) {
        throw new TickError("I4_ZERO_PAY", asBig(state["tick_index"]), asStr(row["city_id"]), {
          fund: asBig(state["fund"]),
          request: asBig(row["request"]),
        })
      }
      continue
    }
    let payout = (asBig(row["request"]) * budget) / total
    if (payout <= 0n && budget > 0n && asBig(row["request"]) > 0n && asBig(state["fund"]) > 0n) {
      throw new TickError("I4_ZERO_PAY", asBig(state["tick_index"]), asStr(row["city_id"]), {
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
    city["payout"] = unit
    paidSum += payout
    addAcc(state, "payroll_paid", payout)
    state["day_payroll"] = asBig(state["day_payroll"]) + payout
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
  const bps = asBig(cfg["bps"])
  city["capital"] = asBig(city["capital"]) - amount
  const burn = (amount * asBig(cfg["spend_burn_bps"])) / bps
  const toFund = (amount * asBig(cfg["spend_fund_bps"])) / bps
  const proto = amount - burn - toFund
  const w = asBig(city["weight"]) === 0n ? 1n : asBig(city["weight"])
  state["fund"] = asBig(state["fund"]) + toFund * w
  state["capital_outstanding"] = asBig(state["capital_outstanding"]) - (burn + proto) * w
  const rate = asBig(state["mint_rate"])
  if (rate > 0n) {
    const burnCorp = (burn * asBig(cfg["wei"])) / rate
    const protoCorp = (proto * asBig(cfg["wei"])) / rate
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
      addAcc(state, "f_deposit", ((leftover * asBig(cfg["spend_fund_bps"])) / bps) * w)
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
  const globalLim = (live * asBig(cfg["bank_pool_share_bps"])) / bps
  let usedToday = asBig(state["bank_used_today_wei"])
  const cities = asDict(state["cities"])
  if (state["bank_day"] !== day) {
    state["bank_day"] = day
    usedToday = 0n
    for (const cid of Object.keys(cities)) {
      asDict(cities[cid])["withdrawn_day"] = 0n
    }
  }
  let remainingGlobal = globalLim - usedToday
  if (remainingGlobal < 0n) remainingGlobal = 0n
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
    const markup = asBig(cfg["bank_markup_bps"])
    if (rate <= 0n) continue
    const share = asBig(city["bank_level"]) > 0n ? asBig(cfg["bank_l1_share_bps"]) : 0n
    const personal = (((live * asBig(cfg["bank_pool_share_bps"])) / bps) * share) / bps
    let room = personal - asBig(city["withdrawn_day"])
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
    remainingGlobal,
  )
  const cut = totalAsk > remainingGlobal && totalAsk > 0n ? 1n : 0n
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
      const tax = (gotScaled * asBig(cfg["creator_tax_bps"])) / bps
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
  state["bank_used_today_wei"] = usedToday + soldEth
  if (soldEth > remainingGlobal) {
    throw new TickError("I10_BANK_OVER", asBig(state["tick_index"]), "-", {
      sold: soldEth,
      remaining: remainingGlobal,
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

function splitCreatorTaxAtoms(tax: bigint, prizeShareBps: bigint, bps: bigint): readonly [bigint, bigint] {
  const prize = (tax * prizeShareBps) / bps
  return [tax - prize, prize]
}

function creditCreatorTax(cfg: Dict, state: Dict, tax: bigint, spec: boolean): void {
  if (tax <= 0n) return
  const bps = asBig(cfg["bps"])
  const split = splitCreatorTaxAtoms(tax, asBig(cfg["prize_creator_tax_share_bps"]), bps)
  const fund = split[0]
  const prize = split[1]
  state["treasury_eth"] = asBig(state["treasury_eth"]) + fund
  state["treasury_fund_eth"] = asBig(state["treasury_fund_eth"]) + fund
  state["treasury_basket_eth"] = asBig(state["treasury_basket_eth"]) + prize
  if (spec) {
    state["treasury_spec_eth"] = asBig(state["treasury_spec_eth"]) + fund
  } else {
    state["treasury_city_eth"] = asBig(state["treasury_city_eth"]) + fund
  }
}

export function applyDexTurnover(cfg: Dict, state: Dict, turnoverUsd8dec: bigint): void {
  if (turnoverUsd8dec <= 0n) return
  const ethUsd = asBig(cfg["eth_usd_8dec"])
  if (ethUsd <= 0n) return
  const bps = asBig(cfg["bps"])
  const taxUsd = (turnoverUsd8dec * asBig(cfg["creator_tax_bps"])) / bps
  const taxWei = (taxUsd * asBig(cfg["wei"])) / ethUsd
  creditCreatorTax(cfg, state, taxWei, true)
  addAcc(state, "tax_spec_eth", taxWei)
  addAcc(state, "turnover_usd_8dec", turnoverUsd8dec)
  const dm = dayMon(state)
  dm["turnover_usd_8dec"] = asBig(dm["turnover_usd_8dec"]) + turnoverUsd8dec
  dm["tax_eth"] = asBig(dm["tax_eth"]) + taxWei
}

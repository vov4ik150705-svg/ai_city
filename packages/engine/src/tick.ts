import { canonical } from "./canonical.js"
import { bi5, bi7, bi240, bi1500 } from "./literals.js"
import {
  applyDexTurnover,
  applySpend,
  assertI11,
  assertI2,
  bankWithdraw,
  buyback,
  collectRequests,
  corkReturn,
  exitCoverageCorp,
  fixDayBudget,
  fundCap,
  pay,
  advanceResearch,
  reserveDrip,
  updateMintRate,
} from "./economy.js"
import { applyCityScope, buildingDistrictFrozen, cityUsesSlots, liveModifierNodes, tagDistrictFrozen } from "./slots.js"
import {
  buildSlotsOf,
  cityLevelFromPopulation,
  clipOfflineHours,
  housingCapacityOf,
  ordinaryActiveCount,
  population,
  stickyCityLevel,
} from "./aggregates.js"
import { accrueAmount, fragmentGrossBase, settleCities, windowSettleDue } from "./fragments.js"
import { accumulateDay, consumeAfterSettle, periodSettleDue, seasonSettle, seasonSettleDue } from "./seasons.js"
import { awardPaidTick, awardTrain, trainComputeCost, trainTargetOf, trainTargetOk } from "./xp.js"
import { encodeHeader, requireHeader, requireRecord } from "./record.js"
import { cityClock, companionCommandsHash, resolveCityTime, shiftSeedHex } from "./state.js"
import { asBig, asBool, asDict, asList, asStr, clampInt, sortedKeys, TickError } from "./values.js"
import type { Dict } from "./values.js"

function overlaySettleWallet(city: Dict, row: Dict): void {
  if (asStr(row["wallet"]).trim().length > 0) return
  const wallet = asStr(city["wallet"]).trim()
  if (wallet.length > 0) row["wallet"] = wallet
}

function overlaySettleDemo(city: Dict, row: Dict): void {
  if (asStr(city["account_kind"]) === "demo" || asStr(row["account_kind"]) === "demo") {
    row["demo"] = 1n
  }
}

function pyOr(value: unknown, fallback: bigint): bigint {
  if (value === undefined || value === null || value === false || value === "") return fallback
  const n = asBig(value)
  if (n === 0n) return fallback
  return n
}

function accumulateInfluenceDay(cfg: Dict, state: Dict, day: bigint, hour: bigint): void {
  if (hour !== 0n || asBig(state["tick_index"]) === 0n) return
  const data = asDict(cfg["data"])
  if (Object.keys(data).length === 0) return
  const closed = day - 1n
  const cities = asDict(state["cities"])
  const bps = asBig(cfg["bps"])
  const ticksDay = asBig(cfg["ticks_day"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    if (!("influence" in city) && !("season_row" in city)) continue
    accumulateDay(city, asBig(city["day_gdp"]), asBig(city["day_valid_ticks"]), asBig(city["created_day"]), closed, ticksDay, bps)
    city["day_gdp"] = 0n
    city["day_valid_ticks"] = 0n
  }
}

function awardXp(cfg: Dict, state: Dict): void {
  const curve = asDict(cfg["xp_to_next"])
  if (Object.keys(curve).length === 0) return
  const levelMax = asBig(cfg["agent_level_max"], bi5)
  const gain = asBig(cfg["agent_level_gain_bps"], bi1500)
  const bps = asBig(cfg["bps"])
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    const agents = asList(city["agents"])
    if (agents.length === 0) continue
    const cityMags: bigint[] = []
    for (const m of asList(city["xp_rate_mags"])) cityMags.push(asBig(m))
    awardPaidTick(city, curve, levelMax, gain, bps, cityMags)
    for (const raw of agents) {
      if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
      const agent = asDict(raw)
      if (asStr(agent["idle"]) !== "") continue
      if (cityUsesSlots(city)) {
        if (asStr(agent["building_id"]).length === 0) continue
        if (asStr(agent["role"]) !== "scientist" || asStr(agent["objective"]) !== "train") continue
      }
      const targetId = trainTargetOf(agent, city)
      if (!targetId) continue
      if (!trainTargetOk(city, asStr(agent["id"]), targetId)) continue
      if (!cityUsesSlots(city) && "compute_stock" in city) {
        const mags: bigint[] = []
        for (const m of asList(agent["compute_cost_mags"])) mags.push(asBig(m))
        for (const m of asList(agent["train_compute_mags"])) mags.push(asBig(m))
        if (mags.length > 0) {
          const extra = trainComputeCost(asBig(city["compute_draw"]), mags, bps)
          if (extra > asBig(city["compute_stock"])) continue
          city["compute_stock"] = asBig(city["compute_stock"]) - extra
        }
      }
      awardTrain(city, agent, curve, levelMax, gain, bps, cityMags)
    }
  }
}

function refreshCityProgress(cfg: Dict, state: Dict): void {
  const thresholds = asDict(cfg["population_thresholds"])
  const levelMax = asBig(cfg["city_level_max"], bi7)
  const per = asBig(cfg["population_per_job"])
  const data = asDict(cfg["data"])
  const defs = asDict(asDict(data["buildings"])["buildings"])
  const packSlots = asDict(cfg["slots_at_city_level"])
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    const functions = city["functions"]
    if (functions === undefined && !("occupied_jobs" in city)) continue
    if (Array.isArray(functions)) {
      city["housing_capacity"] = housingCapacityOf(functions, thresholds, asBig(city["housing_capacity_add"]))
      city["build_slots_used"] = ordinaryActiveCount(functions, defs)
    }
    if ("occupied_jobs" in city || Array.isArray(functions)) {
      const jobs = asBig(city["occupied_jobs"])
      const housing = asBig(city["housing_capacity"])
      city["population"] = population(jobs, per, housing)
      const derived = cityLevelFromPopulation(asBig(city["population"]), thresholds, levelMax)
      city["city_level"] = stickyCityLevel(asBig(city["city_level"], 1n), derived)
      applyCityScope(cfg, city, asBig(state["city_time"]))
      const agentSlots = asBig(city["agent_slots"], asBig(packSlots[asBig(city["city_level"]).toString()]))
      if (agentSlots > 0n) city["build_slots"] = buildSlotsOf(agentSlots)
    }
  }
}

function applyCompanion(cfg: Dict, state: Dict, commands: unknown): void {
  if (!("companion" in asDict(cfg["data"]))) return
  if (!commands) return
  if (asBig(cfg["companion_replan_on_login"]) > 0n) return
  for (const cmd of asList(commands)) {
    if (cmd === null || typeof cmd !== "object" || Array.isArray(cmd)) continue
    const row = cmd as Dict
    const cid = asStr(row["city_id"])
    const cities = asDict(state["cities"])
    if (cid && cid in cities) {
      const city = asDict(cities[cid])
      const journal = asList(city["companion_journal"])
      journal.push(row)
      city["companion_journal"] = journal
    }
  }
}

function foldEma(prev: bigint, price: bigint, span: bigint, alphaNum: bigint): bigint {
  if (price <= 0n) return prev
  if (prev <= 0n || span <= 0n) return price
  const den = span + 1n
  let weight = den - alphaNum
  if (weight < 0n) weight = 0n
  return (prev * weight + price * alphaNum) / den
}

function noteDistrictQuotes(cfg: Dict, state: Dict, inputs: Dict): void {
  const quotes = asDict(inputs["district_quotes"])
  const length = asBig(cfg["tick_length_city_hours"])
  const short = asBig(cfg["efficiency_ema_short_city_hours"])
  const long = asBig(cfg["efficiency_ema_long_city_hours"])
  const alpha = asBig(cfg["efficiency_ema_alpha_num"])
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    const opened = new Set<string>()
    for (const item of asList(city["districts"])) {
      if (typeof item === "string" && item.length > 0) opened.add(item)
    }
    const slots = asDict(city["district_efficiency"])
    const next: Dict = { ...slots }
    const touched = new Set<string>()
    for (const did of sortedKeys(quotes)) {
      if (!opened.has(did)) continue
      const price = asBig(quotes[did])
      if (price <= 0n) continue
      const slot = asDict(next[did])
      const row: Dict = { ...slot }
      row["ema_24h"] = foldEma(asBig(slot["ema_24h"]), price, short, alpha)
      row["ema_30d"] = foldEma(asBig(slot["ema_30d"]), price, long, alpha)
      row["oracle_age_hours"] = 0n
      row["price"] = price
      next[did] = row
      touched.add(did)
    }
    for (const did of Object.keys(next)) {
      if (touched.has(did)) continue
      const slot = asDict(next[did])
      const row: Dict = { ...slot }
      row["oracle_age_hours"] = asBig(slot["oracle_age_hours"]) + length
      next[did] = row
    }
    if (Object.keys(next).length > 0) city["district_efficiency"] = next
  }
}

function recalcEfficiency(cfg: Dict, state: Dict): void {
  const bps = asBig(cfg["bps"])
  const stale = asBig(cfg["oracle_stale_city_hours"])
  const decayAge = asBig(cfg["oracle_decay_city_hours"])
  const step = asBig(cfg["oracle_decay_bps_per_day"])
  const k = asBig(cfg["efficiency_k_bps"])
  const clamp = asBig(cfg["efficiency_clamp_bps"])
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    const districts = city["district_efficiency"]
    if (!districts || typeof districts !== "object") continue
    const slots = asDict(districts)
    for (const did of Object.keys(slots)) {
      const slot = asDict(slots[did])
      const ema24 = asBig(slot["ema_24h"])
      const ema30 = asBig(slot["ema_30d"])
      const age = asBig(slot["oracle_age_hours"])
      if (ema24 <= 0n || ema30 <= 0n) {
        slot["efficiency_bps"] = bps
        const codes = asList(city["codes"])
        codes.push("ORACLE_NO_SAMPLE")
        city["codes"] = codes
        continue
      }
      if (age > decayAge) {
        const cur = asBig(slot["efficiency_bps"], bps)
        if (cur > bps) {
          const nxt = cur - step
          slot["efficiency_bps"] = nxt > bps ? nxt : bps
        } else if (cur < bps) {
          const nxt = cur + step
          slot["efficiency_bps"] = nxt < bps ? nxt : bps
        }
        const codes = asList(city["codes"])
        codes.push("ORACLE_STALE")
        city["codes"] = codes
        continue
      }
      if (age > stale) {
        const codes = asList(city["codes"])
        codes.push("ORACLE_STALE")
        city["codes"] = codes
        continue
      }
      const denom = ema30 > 1n ? ema30 : 1n
      const ratioBps = (ema24 * bps) / denom
      const boost = (k * (ratioBps - bps)) / bps
      slot["efficiency_bps"] = clampInt(bps + boost, bps - clamp, bps + clamp)
    }
  }
}

function hourSix(cfg: Dict, state: Dict, day: bigint, hour: bigint): void {
  if (hour !== asBig(cfg["efficiency_recalc_hour"])) return
  recalcEfficiency(cfg, state)
  const data = asDict(cfg["data"])
  if (Object.keys(data).length === 0) return
  const cities = asDict(state["cities"])
  if (windowSettleDue(data, day, hour)) {
    const subset: Dict = {}
    for (const cid of sortedKeys(cities)) {
      const city = asDict(cities[cid])
      if (city["fragment_ledger"] === undefined && city["fragment_pool"] === undefined) continue
      subset[cid] = city
    }
    if (Object.keys(subset).length > 0) {
      const rawPools = state["fragment_pools"]
      const poolArg: bigint | Dict =
        rawPools !== undefined && rawPools !== null && typeof rawPools === "object"
          ? asDict(rawPools)
          : (() => {
              let pool = 0n
              for (const cid of Object.keys(subset)) {
                pool = asBig(asDict(subset[cid])["fragment_pool"])
                if (pool > 0n) break
              }
              return pool
            })()
      settleCities(data, subset, poolArg)
    }
  }
  if (!periodSettleDue(data, day, hour)) return
  const rows: Dict[] = []
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    if (!("influence" in city) && !("season_row" in city)) continue
    const seeded = asDict(city["season_row"])
    if (Object.keys(seeded).length > 0) {
      const row: Dict = { ...seeded }
      overlaySettleWallet(city, row)
      overlaySettleDemo(city, row)
      rows.push(row)
    } else {
      const row: Dict = {
        city_id: cid,
        influence: asBig(city["influence"]),
        positive_days: asBig(city["positive_days"]),
        live_stake: city["live_stake"],
        demo: city["demo"],
        account_kind: city["account_kind"],
        spend_protocol: asBig(city["spend_protocol_period"]),
      }
      overlaySettleWallet(city, row)
      overlaySettleDemo(city, row)
      rows.push(row)
    }
  }
  if (rows.length > 0) {
    const rawPools = state["season_prize_pools"]
    const poolArg: bigint | Dict =
      rawPools !== undefined && rawPools !== null && typeof rawPools === "object"
        ? asDict(rawPools)
        : asBig(state["season_prize_pool"])
    state["season_settlement"] = seasonSettle(
      data,
      rows,
      poolArg,
      false,
      day,
      hour,
    )
    if (periodSettleDue(data, day, hour) || seasonSettleDue(data, day, hour)) {
      for (const cid of sortedKeys(cities)) {
        const city = asDict(cities[cid])
        if (!("influence" in city) && !("season_row" in city)) continue
        consumeAfterSettle(city)
      }
    }
  }
}

function fragmentGrossOf(cfg: Dict, building: Dict): bigint {
  const data = asDict(cfg["data"])
  const bid = asStr(building["id"], asStr(building["archetype"]))
  const level = asBig(building["level"], 1n)
  let authored = building["fragment_gross_base"]
  if ((authored === undefined || authored === null) && bid) {
    const spec = asDict(asDict(asDict(data["buildings"])["buildings"])[bid])
    authored = spec["fragment_gross_base"]
  }
  const bps = asBig(cfg["bps"])
  let costL1 = asBig(building["cost_l1"])
  let ow: bigint | undefined
  let growth = bps
  let payback = bi240
  if (bid && Object.keys(data).length > 0) {
    const bal = asDict(asDict(data["balance"])["params"])
    const growthRow = asDict(bal["output_growth_bps"])
    const payRow = asDict(bal["normalization_payback_ticks"])
    if ("v" in growthRow) growth = asBig(growthRow["v"])
    if ("v" in payRow) payback = asBig(payRow["v"])
    const spec = asDict(asDict(asDict(data["buildings"])["buildings"])[bid])
    const storedOw = spec["output_weight_bps"]
    if (storedOw !== undefined && storedOw !== null && typeof storedOw === "object") {
      ow = asBig(asDict(storedOw)["v"])
    }
    if (costL1 <= 0n) {
      const costs = asList(asDict(asDict(asDict(cfg["generated"])["balance"])["level_cost"])[bid])
      if (costs.length > 0) costL1 = asBig(costs[0])
    }
    if (costL1 <= 0n) {
      const weights = spec["cost_weight_bps"]
      if (weights !== undefined && weights !== null && typeof weights === "object") {
        costL1 = (asBig(cfg["workshop_cost"]) * asBig(asDict(weights)["v"])) / bps
      }
    }
    if (costL1 <= 0n) costL1 = asBig(building["cost_l1"])
  }
  return fragmentGrossBase(authored, costL1, ow, growth, level, payback, bps)
}

function fragmentRateMags(cfg: Dict, city: Dict, cityTime: bigint): bigint[] {
  const mags: bigint[] = []
  for (const m of asList(city["fragment_rate_mags"])) mags.push(asBig(m))
  for (const node of liveModifierNodes(cfg, city, cityTime)) {
    if (asStr(node["key"]) === "fragment_rate_bps") mags.push(asBig(node["magnitude"]))
  }
  return mags
}

function creditFragments(city: Dict, data: Dict, building: Dict, delta: bigint): void {
  city["fragments"] = asBig(city["fragments"]) + delta
  if (delta <= 0n) return
  const did = asStr(building["district"])
  const ticker = did ? asStr(asDict(asDict(asDict(data["districts"])["districts"])[did])["ticker"]) : ""
  if (ticker.length === 0) return
  const ledger = asDict(city["fragment_ledger"] ?? {})
  ledger[ticker] = asBig(ledger[ticker]) + delta
  city["fragment_ledger"] = ledger
}

function slotWorked(city: Dict, bid: string): boolean {
  for (const raw of asList(city["_slot_rows"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const slot = asDict(raw)
    if (asStr(slot["building_id"]) !== bid) continue
    if (asStr(slot["idle"]) === "") return true
  }
  return false
}

function accrueSlottedFragments(cfg: Dict, city: Dict, cityTime: bigint): bigint {
  const data = asDict(cfg["data"])
  const defs = asDict(asDict(data["buildings"])["buildings"])
  const paid = asStr(cfg["status_paid"])
  const mags = fragmentRateMags(cfg, city, cityTime)
  const bps = asBig(cfg["bps"])
  let total = 0n
  for (const raw of asList(city["functions"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const fn = asDict(raw)
    if (fn["deactivated"] === true || asBig(fn["deactivated"]) > 0n) continue
    if (fn["frozen"] === true || asBig(fn["frozen"]) > 0n) continue
    if (fn["construction"] === true || asBig(fn["construction"]) > 0n) continue
    const bid = asStr(fn["id"])
    if (bid.length === 0) continue
    if (buildingDistrictFrozen(cfg, city, bid, cityTime)) continue
    if (!slotWorked(city, bid)) continue
    const spec = asDict(defs[bid])
    const building: Dict = {
      ...spec,
      id: bid,
      level: asBig(fn["level"], 1n),
    }
    let gross = fragmentGrossOf(cfg, building)
    if (gross <= 0n && asBool(building["force_fragment_accrual"])) gross = asBig(city["payout"])
    const delta = accrueAmount(data, gross, mags, building, paid, false, bps, paid)
    creditFragments(city, data, building, delta)
    total += delta
  }
  return total
}

function accrueFragments(cfg: Dict, state: Dict, city: Dict): bigint {
  const data = asDict(cfg["data"])
  if (Object.keys(data).length === 0) return 0n
  const cityTime = asBig(state["city_time"])
  if (cityUsesSlots(city)) return accrueSlottedFragments(cfg, city, cityTime)
  const building = city["building"]
  if (!building || typeof building !== "object" || Array.isArray(building)) return 0n
  const idle = asStr(city["idle"]) !== ""
  const payout = asBig(city["payout"])
  let status = payout > 0n && !idle ? asStr(cfg["status_paid"]) : asStr(cfg["status_idle"])
  if (asBool(city["construction"])) status = asStr(cfg["status_construction"])
  const mags = fragmentRateMags(cfg, city, cityTime)
  let gross = fragmentGrossOf(cfg, asDict(building))
  if (gross <= 0n && asBool(asDict(building)["force_fragment_accrual"])) gross = payout
  const delta = accrueAmount(
    data,
    gross,
    mags,
    asDict(building),
    status,
    idle,
    asBig(cfg["bps"]),
    asStr(cfg["status_paid"]),
  )
  creditFragments(city, data, asDict(building), delta)
  return delta
}

function recordsOf(state: Dict): Dict[] {
  const cfg = asDict(state["cfg"])
  const spec = asDict(cfg["record_spec"])
  const length = asBig(cfg["tick_length_city_hours"])
  const bps = asBig(cfg["bps"])
  const out: Dict[] = []
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    let cityTime = state["city_time"]
    if (cityTime === undefined || cityTime === null) {
      cityTime = asBig(cfg["anchor_hour"]) + asBig(state["tick_index"]) * length
    }
    const delta = accrueFragments(cfg, state, city)
    const slotRows = asList(city["_slot_rows"])
    if (cityUsesSlots(city)) {
      const ordered: Dict[] = []
      for (const raw of slotRows) {
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
        ordered.push(asDict(raw))
      }
      ordered.sort((a, b) => {
        const x = asStr(a["agent_id"])
        const y = asStr(b["agent_id"])
        if (x < y) return -1
        if (x > y) return 1
        return 0
      })
      let first = true
      for (const slot of ordered) {
        const idle = asStr(slot["idle"])
        const payout = asBig(slot["payout"])
        let status = idle || payout <= 0n ? asStr(cfg["status_idle"]) : asStr(cfg["status_paid"])
        if (asBool(city["construction"])) status = asStr(cfg["status_construction"])
        const stage = asDict(slot["stage"])
        const agentId = asStr(slot["agent_id"])
        const seedRaw = asStr(slot["seed_id"])
        const seedId = seedRaw.length > 0 ? seedRaw : agentId
        const rec: Dict = {
          layout_version: asBig(cfg["layout_version"]),
          city_id: cid,
          tick_index: asBig(state["tick_index"]),
          city_time: asBig(cityTime),
          agent_id: agentId,
          building_id: asStr(slot["building_id"]),
          objective: asStr(slot["objective"]),
          inputs: {
            compute: asBig(slot["compute"]),
            energy: asBig(slot["energy"]),
            materials: 0n,
          },
          district_efficiency_bps: asBig(city["district_efficiency_bps"], bps),
          seed: shiftSeedHex(cid, asBig(state["tick_index"]), seedId),
          output: payout,
          payroll_ratio_bps: asBig(state["payroll_ratio_bps"]),
          status,
          reason: idle,
          fragments_delta: first ? delta : 0n,
          stage_bps: {
            base: asBig(stage["base"], bps),
            post: asBig(stage["post"], bps),
          },
        }
        first = false
        if (Object.keys(spec).length > 0) {
          requireRecord(rec, spec, asBig(state["tick_index"]), cid)
        }
        out.push(rec)
        canonical(rec)
      }
      continue
    }
    const idle = asStr(city["idle"])
    const payout = asBig(city["payout"])
    let status = idle || payout <= 0n ? asStr(cfg["status_idle"]) : asStr(cfg["status_paid"])
    if (asBool(city["construction"])) status = asStr(cfg["status_construction"])
    const stage = asDict(city["stage_bps"])
    const rec: Dict = {
      layout_version: asBig(cfg["layout_version"]),
      city_id: cid,
      tick_index: asBig(state["tick_index"]),
      city_time: asBig(cityTime),
      agent_id: "shift",
      building_id: asStr(city["building_id"]),
      objective: asStr(city["objective"]),
      inputs: {
        compute: asBig(city["compute_draw"]),
        energy: asBig(city["energy_draw"]),
        materials: 0n,
      },
      district_efficiency_bps: asBig(city["district_efficiency_bps"], bps),
      seed: shiftSeedHex(cid, asBig(state["tick_index"]), "shift"),
      output: payout,
      payroll_ratio_bps: asBig(state["payroll_ratio_bps"]),
      status,
      reason: idle,
      fragments_delta: delta,
      stage_bps: {
        base: asBig(stage["base"], bps),
        post: asBig(stage["post"], bps),
      },
    }
    if (Object.keys(spec).length > 0) {
      requireRecord(rec, spec, asBig(state["tick_index"]), cid)
    }
    out.push(rec)
    canonical(rec)
  }
  return out
}

export function tick(state: Dict, inputs: Dict): readonly [Dict, Dict[]] {
  if (typeof inputs["eth_usd_8dec"] === "number") {
    throw new TickError("I9_FLOAT", asBig(state["tick_index"]), "-", { bad: 1n })
  }
  const cfg = asDict(state["cfg"])
  assertI2(cfg, state)
  state["codes"] = []
  const resolved = resolveCityTime(cfg, inputs, asBig(state["tick_index"]))
  state["tick_index"] = resolved[0]
  state["city_time"] = resolved[1]
  const clock = cityClock(cfg, asBig(state["tick_index"]))
  state["day"] = clock[0]
  state["hour"] = clock[1]
  state["weekday"] = clock[2]
  if (inputs["pack_hash"] && asStr(inputs["pack_hash"]) !== asStr(cfg["pack_hash"])) {
    throw new TickError("PACK_HASH", asBig(state["tick_index"]), "-", { got: 0n })
  }
  applyCompanion(cfg, state, inputs["companion_commands"] ?? [])
  updateMintRate(cfg, state, inputs, clock[1])
  if (asBig(state["mint_rate"]) > asBig(cfg["capital_anchor"])) {
    throw new TickError("I1_RATE_CEILING", asBig(state["tick_index"]), "-", { rate: asBig(state["mint_rate"]) })
  }
  applyDexTurnover(cfg, state, asBig(inputs["dex_turnover_usd_8dec"]), asBig(inputs["eth_usd_8dec"]))
  accumulateInfluenceDay(cfg, state, clock[0], clock[1])
  noteDistrictQuotes(cfg, state, inputs)
  hourSix(cfg, state, clock[0], clock[1])
  fixDayBudget(cfg, state, clock[0], clock[1])
  const rows = collectRequests(cfg, state, clock[1], clock[2])
  pay(cfg, state, rows)
  advanceResearch(cfg, state)
  awardXp(cfg, state)
  refreshCityProgress(cfg, state)
  const cities = asDict(state["cities"])
  for (const cid of sortedKeys(cities)) {
    const city = asDict(cities[cid])
    city["codes"] = []
    tagDistrictFrozen(city, asBig(state["city_time"]))
    applySpend(cfg, state, city, asBig(city["spend_intent"]), asBig(city["spend_from_earned"]))
    city["spend_intent"] = 0n
  }
  bankWithdraw(cfg, state, clock[0], clock[1], clock[2])
  buyback(cfg, state)
  reserveDrip(cfg, state)
  fundCap(cfg, state)
  corkReturn(cfg, state)
  const cov = exitCoverageCorp(cfg, state)
  const mon = asDict(state["mon"])
  const cur7 = mon["i7_cov_min"]
  if (cur7 === null || cur7 === undefined || cov < asBig(cur7)) {
    mon["i7_cov_min"] = cov
    mon["i7_cov_min_day"] = clock[0]
    if (cov < 0n) asList(state["codes"]).push(asStr(cfg["exit_uncovered_code"]))
  }
  const vault = asBig(state["vault_corp"])
  if (vault > 0n) {
    const covBps = (asBig(cfg["bps"]) * cov) / vault
    const curCb = mon["i7_cov_min_bps"]
    if (curCb === null || curCb === undefined || covBps < asBig(curCb)) {
      mon["i7_cov_min_bps"] = covBps
      mon["i7_cov_min_bps_day"] = clock[0]
    }
  }
  assertI11(cfg, state)
  return [state, recordsOf(state)]
}

export function tickHeader(state: Dict, inputs: Dict, prevStateHash: string = ""): Dict {
  const cfg = asDict(state["cfg"])
  const cmds = inputs["companion_commands"] ?? []
  const cities = asDict(state["cities"])
  const cityId =
    asStr(inputs["city_id"]) || (Object.keys(cities).length > 0 ? (Object.keys(cities)[0] ?? "") : "")
  const hdr: Dict = {
    layout_version: asBig(cfg["layout_version"]),
    city_id: cityId,
    tick_index: asBig(state["tick_index"]),
    city_time: asBig(state["city_time"]),
    pack_hash: asStr(cfg["pack_hash"]),
    corp_eth_wei_per_whole: asBig(inputs["corp_eth_wei_per_whole"]),
    eth_usd_8dec: asBig(inputs["eth_usd_8dec"]),
    feed_live: asBig(inputs["feed_live"]),
    dex_turnover_usd_8dec: asBig(inputs["dex_turnover_usd_8dec"]),
    price_sample_city_time: pyOr(inputs["price_sample_city_time"], asBig(state["city_time"])),
    companion_commands_hash: companionCommandsHash(cmds),
    prev_state_hash: prevStateHash ? prevStateHash : "",
    stake_snapshot: asBig(inputs["stake_snapshot"]),
  }
  const spec = asDict(cfg["header_spec"])
  if (Object.keys(spec).length > 0) {
    requireHeader(hdr, spec, asBig(state["tick_index"]), cityId)
  }
  return hdr
}

export function catchUp(state: Dict, inputsNow: Dict, lastCityTime: bigint): readonly [Dict, Dict[]] {
  const cfg = asDict(state["cfg"])
  const length = asBig(cfg["tick_length_city_hours"])
  const now = asBig(inputsNow["city_time"])
  const elapsed = length === 0n ? 0n : (now - lastCityTime) / length
  if (elapsed <= 0n) return [state, []]
  const gapCity = asStr(inputsNow["city_id"])
  const gapLive = asDict(asDict(state["cities"])[gapCity])
  if (Object.keys(gapLive).length > 0) applyCityScope(cfg, gapLive, now)
  const added = asBig(gapLive["offline_cap_hours"], asBig(state["offline_cap_hours"]))
  const capHours = clipOfflineHours(asBig(cfg["offline_cap"]), added, asBig(cfg["offline_hard_cap"]))
  const cap = length === 0n ? 0n : capHours / length
  const credited = elapsed < cap ? elapsed : cap
  const skipped = elapsed - credited
  const records: Dict[] = []
  const bps = asBig(cfg["bps"])
  if (skipped > 0n) {
    const fromTick = length === 0n ? 0n : (lastCityTime - asBig(cfg["anchor_hour"])) / length + 1n
    const gapAgent = cityUsesSlots(gapLive) ? "" : "shift"
    records.push({
      layout_version: asBig(cfg["layout_version"]),
      city_id: gapCity,
      tick_index: fromTick,
      city_time: lastCityTime + length,
      agent_id: gapAgent,
      building_id: "",
      objective: "",
      inputs: { compute: 0n, energy: 0n, materials: 0n },
      district_efficiency_bps: bps,
      seed: shiftSeedHex(gapCity, fromTick, gapAgent),
      output: 0n,
      payroll_ratio_bps: asBig(state["payroll_ratio_bps"]),
      status: asStr(cfg["status_gap"]),
      reason: asStr(cfg["idle_offline"]),
      fragments_delta: 0n,
      stage_bps: { base: bps, post: bps },
    })
  }
  const currentIndex = length === 0n ? 0n : (now - asBig(cfg["anchor_hour"])) / length
  const first = currentIndex - credited + 1n
  let i = 0n
  let st = state
  while (i < credited) {
    const idx = first + i
    const inp: Dict = { ...inputsNow }
    inp["tick_index"] = idx
    inp["city_time"] = asBig(cfg["anchor_hour"]) + idx * length
    const stepped = tick(st, inp)
    st = stepped[0]
    for (const r of stepped[1]) records.push(r)
    i += 1n
  }
  return [st, records]
}

export { encodeHeader }

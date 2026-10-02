import { bi3, bi400, bi600, bi900, bi1350, bi2025, bi3037, n2, n3, n4, n5, n6, n7 } from "./literals.js"
import { asBig, asDict, asStr, max1 } from "./values.js"
import type { Dict } from "./values.js"

const TERMS = ["housing_bps", "parks_bps", "energy_bps", "payroll_bps"] as const

function clampBps(value: bigint, bps: bigint): bigint {
  if (value < 0n) return 0n
  if (value > bps) return bps
  return value
}

export function housingTermBps(
  housingCapacity: bigint,
  occupiedJobs: bigint,
  populationPerJob: bigint,
  bps: bigint,
): bigint {
  return clampBps((housingCapacity * bps) / max1(occupiedJobs * populationPerJob), bps)
}

export function parksTermBps(
  parkSlots: bigint,
  parkCapacityJobs: bigint,
  occupiedJobs: bigint,
  bps: bigint,
): bigint {
  return clampBps((parkSlots * parkCapacityJobs * bps) / max1(occupiedJobs), bps)
}

export function energyTermBps(
  energyStock: bigint,
  energyDemandPerTick: bigint,
  energyBufferTicks: bigint,
  bps: bigint,
): bigint {
  return clampBps((energyStock * bps) / max1(energyDemandPerTick * energyBufferTicks), bps)
}

export function productivityBps(realized: bigint, nominal: bigint, bps: bigint): bigint {
  return (realized * bps) / max1(nominal)
}

export function population(occupiedJobs: bigint, populationPerJob: bigint, housingCapacity: bigint): bigint {
  return occupiedJobs * populationPerJob + housingCapacity
}

const HOUSING_LEVEL_INDEX: { readonly [id: string]: readonly number[] } = {
  flagship_store: [n2, n4, n6],
  retail_complex: [n3, n5, n7],
}

const HOUSING_FALLBACK: { readonly [level: number]: bigint } = {
  [n2]: bi400,
  [n3]: bi600,
  [n4]: bi900,
  [n5]: bi1350,
  [n6]: bi2025,
  [n7]: bi3037,
}

export function housingBaseOf(archetype: string, level: bigint, thresholds: Dict): bigint {
  const idx = HOUSING_LEVEL_INDEX[archetype]
  if (idx === undefined) return 0n
  let lv = Number(level)
  if (lv < 1) return 0n
  if (lv > idx.length) lv = idx.length
  const key = String(idx[lv - 1])
  if (key in thresholds) return asBig(thresholds[key])
  return HOUSING_FALLBACK[idx[lv - 1] ?? 0] ?? 0n
}

export function housingCapacityOf(functions: readonly unknown[], thresholds: Dict, housingAdd = 0n): bigint {
  let total = housingAdd
  if (total < 0n) total = 0n
  for (const raw of functions) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asDict(raw)
    if (asBig(row["frozen"]) > 0n || asBig(row["deactivated"]) > 0n || row["frozen"] === true || row["deactivated"] === true) {
      continue
    }
    const aid = asStr(row["id"], asStr(row["archetype"]))
    const lv = asBig(row["level"], 1n)
    total += housingBaseOf(aid, lv, thresholds)
  }
  return total
}

export function cityLevelFromPopulation(pop: bigint, thresholds: Dict, levelMax: bigint): bigint {
  if (levelMax < 1n) return 1n
  let level = 1n
  let L = 1n
  while (L <= levelMax) {
    const need = asBig(thresholds[L.toString()])
    if (pop >= need) level = L
    else break
    L += 1n
  }
  return level
}

export function stickyCityLevel(current: bigint, derived: bigint): bigint {
  let cur = current
  if (cur < 1n) cur = 1n
  return cur > derived ? cur : derived
}

export function buildSlotsOf(agentSlots: bigint, autonomousOrdinary = bi3): bigint {
  const out = agentSlots + autonomousOrdinary
  return out > 0n ? out : 0n
}

export function ordinaryActiveCount(functions: readonly unknown[], defs: Dict): bigint {
  let n = 0n
  for (const raw of functions) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asDict(raw)
    if (asBig(row["frozen"]) > 0n || asBig(row["deactivated"]) > 0n || row["frozen"] === true || row["deactivated"] === true) {
      continue
    }
    const aid = asStr(row["id"], asStr(row["archetype"]))
    const spec = asDict(defs[aid])
    if (spec["autonomous"] === true || spec["prebuilt"] === true) continue
    n += 1n
  }
  return n
}

export function clipOfflineHours(base: bigint, added: bigint, hardCap: bigint): bigint {
  const total = base + added
  if (total < 0n) return 0n
  return total < hardCap ? total : hardCap
}

export function gdpDay(payouts: readonly bigint[]): bigint {
  let total = 0n
  for (const p of payouts) total += p
  return total
}

export function happinessBps(terms: Dict, weights: Dict, bps: bigint): readonly [bigint, Dict] {
  let wsum = 0n
  for (const key of Object.keys(weights)) {
    wsum += asBig(weights[key])
  }
  if (wsum !== bps) {
    throw new Error(`happiness_bps: weights sum to ${wsum.toString()}, not ${bps.toString()}`)
  }
  for (const key of TERMS) {
    if (!(key in weights)) throw new Error(`happiness_bps: missing weight ${key}`)
    if (!(key in terms)) throw new Error(`happiness_bps: missing term ${key}`)
  }
  for (const key of Object.keys(weights)) {
    if (!(TERMS as readonly string[]).includes(key)) {
      throw new Error(`happiness_bps: unknown weight ${key}`)
    }
  }
  const breakdown: Dict = {}
  let total = 0n
  for (const key of TERMS) {
    const clamped = clampBps(asBig(terms[key]), bps)
    breakdown[key] = clamped
    total += asBig(weights[key]) * clamped
  }
  return [clampBps(total / bps, bps), breakdown]
}

export function happinessOfCity(cfg: Dict, state: Dict, city: Dict): bigint {
  if (!("housing_capacity" in city) && !("park_slots" in city)) {
    return asBig(cfg["bps"])
  }
  const weights = asDict(cfg["happiness_weights"])
  if (Object.keys(weights).length === 0) {
    return asBig(cfg["bps"])
  }
  const bps = asBig(cfg["bps"])
  const jobs = asBig(city["occupied_jobs"])
  let draw = city["energy_draw"]
  if (draw === undefined || draw === null) draw = cfg["workshop_energy"]
  const terms: Dict = {
    housing_bps: housingTermBps(asBig(city["housing_capacity"]), jobs, asBig(cfg["population_per_job"]), bps),
    parks_bps: parksTermBps(asBig(city["park_slots"]), asBig(cfg["park_capacity_jobs"]), jobs, bps),
    energy_bps: energyTermBps(asBig(city["energy_stock"]), asBig(draw), asBig(cfg["energy_buffer_ticks"]), bps),
    payroll_bps: asBig(state["payroll_ratio_bps"]),
  }
  const pair = happinessBps(terms, weights, bps)
  city["happiness_bps"] = pair[0]
  return pair[0]
}

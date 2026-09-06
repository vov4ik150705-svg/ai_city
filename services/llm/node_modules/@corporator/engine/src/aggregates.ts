import { asBig, asDict, max1 } from "./values.js"
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

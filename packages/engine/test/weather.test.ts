import { describe, expect, it } from "vitest"
import { collectSlotRequests, loadConfig, newState, tick } from "../src/index.ts"
import { asBig, asDict, asStr } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { liveCity, loadPack, makeInputs } from "./harness.ts"

function engineer(id: string, bid: string): Dict {
  return {
    id,
    role: "engineer",
    building_id: bid,
    objective: "",
    traits: [],
    level_mult_bps: 10000n,
  }
}

function seed(cfg: Dict, pack: Dict, functions: Dict[], agents: Dict[]): Dict {
  const city = liveCity(cfg, pack, "a")
  city["functions"] = functions
  city["agents"] = agents
  city["energy_stock"] = 1000000n
  city["compute_stock"] = 1000000n
  city["nodes"] = []
  city["research_unlocked"] = []
  city["district_efficiency_bps"] = asBig(cfg["bps"])
  city["district_freeze_until"] = {}
  city["districts"] = ["compute", "energy"]
  return city
}

function run(cfg: Dict, city: Dict): { readonly workshop: bigint; readonly energy: bigint; readonly robot: bigint } {
  const beforeEnergy = asBig(city["energy_stock"])
  const clone = structuredClone(city)
  const rows = collectSlotRequests(cfg, { jitter_on: 0n, city_time: 12n, tick_index: 0n }, clone, "a", 12n, 1n, asBig(cfg["bps"]))
  let workshop = 0n
  let robot = 0n
  for (const raw of rows) {
    const row = asDict(raw)
    if (asStr(row["building_id"]) === "workshop") workshop = asBig(row["request"])
    if (asStr(row["building_id"]) === "robotics_lab") robot = asBig(row["request"])
  }
  return { workshop, energy: asBig(clone["energy_stock"]) - beforeEnergy, robot }
}

describe("district_weather", () => {
  it("district weather scales the beacon and not the workshop", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const bps = asBig(cfg["bps"])
    const weather: Dict = {
      compute: { efficiency_bps: 9000n },
      energy: { efficiency_bps: 11000n },
    }
    const shopFns: Dict[] = [{ id: "workshop", level: 1n }]
    const shopAgents: Dict[] = [engineer("e1", "workshop")]
    const shopBare = run(cfg, seed(cfg, pack, shopFns, shopAgents))
    const shopHitCity = seed(cfg, pack, shopFns, shopAgents)
    shopHitCity["district_efficiency"] = weather
    const shopHit = run(cfg, shopHitCity)
    const plantFns: Dict[] = [{ id: "energy_plant", level: 1n }]
    const plantAgents: Dict[] = [engineer("e2", "energy_plant")]
    const plantBare = run(cfg, seed(cfg, pack, plantFns, plantAgents))
    const plantHitCity = seed(cfg, pack, plantFns, plantAgents)
    plantHitCity["district_efficiency"] = weather
    const plantHit = run(cfg, plantHitCity)
    const robotFns: Dict[] = [{ id: "robotics_lab", level: 1n }]
    const robotBare = run(cfg, seed(cfg, pack, robotFns, []))
    const robotHitCity = seed(cfg, pack, robotFns, [])
    robotHitCity["district_efficiency"] = weather
    const robotHit = run(cfg, robotHitCity)
    expect(shopBare.workshop > 0n).toBe(true)
    expect(plantBare.energy > 0n).toBe(true)
    expect(robotBare.robot > 0n).toBe(true)
    expect(shopHit.workshop).toBe(shopBare.workshop)
    expect(plantHit.energy).toBe((plantBare.energy * 11000n) / bps)
    expect(robotHit.robot).toBe((robotBare.robot * ((9000n + 11000n) / (1n + 1n))) / bps)
  })

  it("a missing sample stays neutral and a quote does not floor it", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const bps = asBig(cfg["bps"])
    const city = liveCity(cfg, pack, "a")
    city["districts"] = ["compute"]
    city["district_efficiency"] = {
      compute: { ema_24h: 0n, ema_30d: 0n, oracle_age_hours: 0n, efficiency_bps: 11500n },
    }
    const state = newState(cfg, { a: city }, {})
    const hour6 = 18n
    const emptied = tick(state, makeInputs(cfg, hour6))
    const slot = asDict(asDict(asDict(asDict(emptied[0]["cities"])["a"])["district_efficiency"])["compute"])
    expect(asBig(slot["efficiency_bps"])).toBe(bps)
    const quotedCity = liveCity(cfg, pack, "a")
    quotedCity["districts"] = ["compute"]
    const quoted = newState(cfg, { a: quotedCity }, {})
    const seeded = tick(quoted, makeInputs(cfg, 0n, { district_quotes: { compute: 200n } }))
    const seedSlot = asDict(asDict(asDict(asDict(seeded[0]["cities"])["a"])["district_efficiency"])["compute"])
    expect(asBig(seedSlot["ema_24h"])).toBe(200n)
    expect(asBig(seedSlot["ema_30d"])).toBe(200n)
    seedSlot["ema_24h"] = 200n
    seedSlot["ema_30d"] = 100n
    seedSlot["oracle_age_hours"] = 0n
    const clamped = tick(seeded[0], makeInputs(cfg, hour6))
    const cap = asDict(asDict(asDict(asDict(clamped[0]["cities"])["a"])["district_efficiency"])["compute"])
    expect(asBig(cap["efficiency_bps"])).toBe(bps + asBig(cfg["efficiency_clamp_bps"]))
  })
})

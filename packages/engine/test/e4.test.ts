import { describe, expect, it } from "vitest"
import { collectSlotRequests, loadConfig } from "../src/index.ts"
import { asBig, asDict, asStr } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { liveCity, loadPack } from "./harness.ts"

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

function seedCity(cfg: Dict, pack: Dict, functions: Dict[], agents: Dict[]): Dict {
  const city = liveCity(cfg, pack, "a")
  city["functions"] = functions
  city["agents"] = agents
  city["energy_stock"] = 1_000_000n
  city["compute_stock"] = 1_000_000n
  city["nodes"] = []
  city["research_unlocked"] = []
  city["district_efficiency_bps"] = asBig(cfg["bps"])
  city["district_freeze_until"] = {}
  return city
}

function workshopRequest(cfg: Dict, city: Dict): bigint {
  const state: Dict = { jitter_on: 0n, city_time: 12n, tick_index: 0n }
  const clone = structuredClone(city)
  const rows = collectSlotRequests(cfg, state, clone, "a", 12n, 1n, asBig(cfg["bps"]))
  for (const raw of rows) {
    const row = asDict(raw)
    if (asStr(row["building_id"]) === "workshop") return asBig(row["request"])
  }
  return 0n
}

describe("e4_building_links", () => {
  it("e4_plant_raises_workshop_output", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const bps = asBig(cfg["bps"])
    const links = asDict(asDict(asDict(cfg["generated"])["buildings"])["output_links"])
    const plantMag = asBig(asDict(links["energy_plant"])["magnitude"])
    const baseFns: Dict[] = [{ id: "workshop", level: 1n }]
    const baseAgents: Dict[] = [engineer("e1", "workshop")]
    const bare = seedCity(cfg, pack, baseFns, baseAgents)
    const linked = seedCity(
      cfg,
      pack,
      [...baseFns, { id: "energy_plant", level: 1n }],
      [...baseAgents, engineer("e2", "energy_plant")],
    )
    const without = workshopRequest(cfg, bare)
    const withPlant = workshopRequest(cfg, linked)
    expect(without > 0n).toBe(true)
    expect(withPlant).toBe((without * (bps + plantMag)) / bps)
  })

  it("e4_node_yields_to_plant", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const plantOnly = seedCity(
      cfg,
      pack,
      [
        { id: "workshop", level: 1n },
        { id: "energy_plant", level: 1n },
      ],
      [engineer("e1", "workshop"), engineer("e2", "energy_plant")],
    )
    const both = seedCity(
      cfg,
      pack,
      [
        { id: "workshop", level: 1n },
        { id: "energy_plant", level: 1n },
        { id: "power_node", level: 1n },
      ],
      [engineer("e1", "workshop"), engineer("e2", "energy_plant"), engineer("e3", "power_node")],
    )
    expect(workshopRequest(cfg, both)).toBe(workshopRequest(cfg, plantOnly))
  })

  it("e4_hall_without_manager_is_dark", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const bare = seedCity(cfg, pack, [{ id: "workshop", level: 1n }], [engineer("e1", "workshop")])
    const hall = seedCity(
      cfg,
      pack,
      [
        { id: "workshop", level: 1n },
        { id: "city_hall", level: 1n },
      ],
      [engineer("e1", "workshop")],
    )
    expect(workshopRequest(cfg, hall)).toBe(workshopRequest(cfg, bare))
  })
})

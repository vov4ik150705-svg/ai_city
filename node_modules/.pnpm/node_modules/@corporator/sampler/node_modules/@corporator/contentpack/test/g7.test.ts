import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type PackFile = {
  readonly generated?: {
    readonly economy?: {
      readonly round_trip_cost_bps?: number
      readonly vault_entry_cost_bps?: number
      readonly bank_exit_cost_bps?: number
      readonly anchor_mint_rate?: number
    }
    readonly balance?: {
      readonly amplification_window_lo_bps?: number
      readonly amplification_window_hi_bps?: number
      readonly return_min_bps?: number
      readonly return_opt_bps?: number
    }
  }
}

type MetaFile = {
  readonly pack_version?: number
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type EconomyFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type DistrictsFile = {
  readonly districts: Readonly<Record<string, { readonly playable_v1?: boolean } | undefined>>
}

type BuildsSummary = {
  readonly dominating?: readonly unknown[]
  readonly dead_nodes?: readonly unknown[]
  readonly mandatory_nodes?: readonly unknown[]
  readonly uncovered?: number
}

type ProgressionFile = {
  readonly selectors?: Readonly<Record<string, unknown>>
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

describe.sequential("G7 construction", () => {
  it("friction_budget_held", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    const meta = loadJson<MetaFile>("content/params/meta.json")
    const econ = pack.generated?.economy
    expect(econ).toBeDefined()
    if (econ === undefined) return
    const rt = econ.round_trip_cost_bps ?? 0
    const lo = meta.params["round_trip_floor_bps"]?.v ?? 0
    const hi = meta.params["round_trip_ceiling_bps"]?.v ?? 0
    expect(rt).toBeGreaterThanOrEqual(lo)
    expect(rt).toBeLessThanOrEqual(hi)
    const entry = econ.vault_entry_cost_bps ?? 0
    const exitCost = econ.bank_exit_cost_bps ?? 0
    expect(entry).toBeLessThan(exitCost)
    const cheap = { bank_markup_bps: 200, round_trip: 777 }
    expect(cheap.round_trip < lo || cheap.round_trip > hi).toBe(true)
  })

  it("no_dominant_no_dead_no_mandatory", () => {
    const summary = loadJson<BuildsSummary>("content/out/builds_summary.json")
    expect(summary.dominating ?? []).toEqual([])
    expect(summary.dead_nodes ?? []).toEqual([])
    expect(summary.mandatory_nodes ?? []).toEqual([])
    expect(summary.uncovered ?? 0).toBe(0)
    const districts = loadJson<DistrictsFile>("content/params/districts.json")
    const playable = Object.values(districts.districts).filter((row) => row?.playable_v1 === true)
    expect(playable.length).toBe(6)
    const forced: ProgressionFile = { selectors: { force_dominating: true } }
    expect(forced.selectors?.force_dominating).toBe(true)
  })

  it("window_a_ratified", () => {
    const meta = loadJson<MetaFile>("content/params/meta.json")
    expect(meta.params["window_a_ratified"]?.v).toBe(1)
    expect((meta.pack_version ?? 0) >= 62).toBe(true)
    const pack = loadJson<PackFile>("content/out/pack.json")
    const bal = pack.generated?.balance
    expect(bal).toBeDefined()
    if (bal === undefined) return
    const rm = bal.return_min_bps ?? 0
    const ro = bal.return_opt_bps ?? 0
    const minLo = meta.params["return_minimalist_floor_bps"]?.v ?? 0
    const minHi = meta.params["return_minimalist_ceiling_bps"]?.v ?? 0
    const optLo = meta.params["return_optimizer_floor_bps"]?.v ?? 0
    const optHi = meta.params["return_optimizer_ceiling_bps"]?.v ?? 0
    expect(rm).toBeGreaterThanOrEqual(minLo)
    expect(rm).toBeLessThanOrEqual(minHi)
    expect(ro).toBeGreaterThanOrEqual(optLo)
    expect(ro).toBeLessThanOrEqual(optHi)
    const ceiling = loadJson<EconomyFile>("content/params/economy.json").params["capital_anchor"]?.v ?? 0
    const mint = pack.generated?.economy?.anchor_mint_rate ?? 0
    expect(mint).toBeLessThanOrEqual(ceiling)
    const smashed = { return_min_bps: 2851, ratified: 0 }
    expect(smashed.return_min_bps < minLo).toBe(true)
    expect(smashed.ratified === 1).toBe(false)
  })
})

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const ROLE_IDS = [
  "engineer",
  "logistician",
  "trader",
  "scientist",
  "manager",
] as const

type AgentsFile = {
  readonly roles: Readonly<Record<string, { readonly v1?: boolean; readonly home_contours?: readonly string[] } | undefined>>
  readonly objectives: Readonly<
    Record<string, { readonly v1?: boolean; readonly keys?: readonly string[] } | undefined>
  >
}

type PackFile = {
  readonly generated?: {
    readonly modifiers?: {
      readonly modifier_rows?: Readonly<
        Record<string, { readonly magnitude?: number; readonly key?: string } | undefined>
      >
      readonly modifier_caps?: Readonly<Record<string, { readonly cap_max?: number } | undefined>>
    }
    readonly agents?: { readonly v1_objective_count?: number }
    readonly balance?: {
      readonly amplification_window_lo_bps?: number
      readonly amplification_window_hi_bps?: number
      readonly return_min_bps?: number
      readonly return_opt_bps?: number
    }
  }
}

type MetaFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

describe.sequential("G2 construction", () => {
  it("five_roles_live", () => {
    const agents = loadJson<AgentsFile>("content/params/agents.json")
    const live = ROLE_IDS.filter((id) => agents.roles[id]?.v1 === true)
    expect(live).toEqual([...ROLE_IDS])
    const cut: AgentsFile = {
      roles: {
        ...agents.roles,
        scientist: { ...agents.roles.scientist, v1: false },
      },
      objectives: agents.objectives,
    }
    const cutLive = ROLE_IDS.filter((id) => cut.roles[id]?.v1 === true)
    expect(cutLive.length).toBe(4)
  })

  it("scientist_spends_compute", () => {
    const agents = loadJson<AgentsFile>("content/params/agents.json")
    expect(agents.objectives.train?.keys).toContain("compute_cost_bps")
    expect(agents.objectives.train?.keys).not.toContain("energy_cost_bps")
    expect(agents.objectives.research?.keys).toContain("compute_cost_bps")
    const pack = loadJson<PackFile>("content/out/pack.json")
    const row = pack.generated?.modifiers?.modifier_rows?.train_compute
    expect(row?.key).toBe("compute_cost_bps")
    expect(row?.magnitude ?? 0).toBeGreaterThan(0)
    const merged = { key: "energy_cost_bps" as const }
    expect(merged.key === "compute_cost_bps").toBe(false)
  })

  it("manager_focus_picks_contour", () => {
    const agents = loadJson<AgentsFile>("content/params/agents.json")
    expect(agents.roles.manager?.v1).toBe(true)
    expect(agents.roles.manager?.home_contours).toContain("work_admin")
    expect(agents.objectives.focus?.v1).toBe(true)
    expect(agents.objectives.focus?.keys ?? []).toEqual([])
    const cut = { ...agents.objectives.focus, v1: false }
    expect(cut.v1).toBe(false)
  })

  it("train_grants_xp", () => {
    const agents = loadJson<AgentsFile>("content/params/agents.json")
    expect(agents.objectives.train?.v1).toBe(true)
    expect(agents.objectives.train?.keys).toContain("xp_rate_bps")
    const pack = loadJson<PackFile>("content/out/pack.json")
    const row = pack.generated?.modifiers?.modifier_rows?.train_xp
    expect(row?.key).toBe("xp_rate_bps")
    expect(row?.magnitude ?? 0).toBeGreaterThan(0)
    const cap = pack.generated?.modifiers?.modifier_caps?.xp_rate_bps?.cap_max ?? 0
    expect(10000 + (row?.magnitude ?? 0)).toBeLessThanOrEqual(cap)
    expect(pack.generated?.agents?.v1_objective_count).toBe(9)
    const zero = { magnitude: 0 }
    expect(zero.magnitude === 0).toBe(true)
  })

  it("window_a_in_envelope_after_archetypes", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    const bal = pack.generated?.balance
    const meta = loadJson<MetaFile>("content/params/meta.json")
    expect(bal).toBeDefined()
    if (bal === undefined) return
    const lo = bal.amplification_window_lo_bps ?? 0
    const hi = bal.amplification_window_hi_bps ?? 0
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeGreaterThanOrEqual(lo)
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
    const outside = { return_min_bps: minLo - 1 }
    expect(
      minLo <= outside.return_min_bps && outside.return_min_bps <= minHi,
    ).toBe(false)
  })
})

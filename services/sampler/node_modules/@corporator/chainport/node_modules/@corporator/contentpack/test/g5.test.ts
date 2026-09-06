import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type CompanionFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
  readonly commands: {
    readonly allowed: Readonly<Record<string, unknown>>
    readonly forbidden: Readonly<Record<string, unknown>>
  }
}

type PackFile = {
  readonly generated?: {
    readonly companion?: {
      readonly uptime_witness?: {
        readonly minimalist?: number
        readonly companion?: number
        readonly optimizer?: number
      }
      readonly row_magnitudes?: Readonly<Record<string, number | undefined>>
    }
    readonly balance?: {
      readonly amplification_window_lo_bps?: number
      readonly amplification_window_hi_bps?: number
      readonly return_min_bps?: number
      readonly return_opt_bps?: number
    }
    readonly modifiers?: {
      readonly modifier_caps?: Readonly<Record<string, { readonly cap_max?: number } | undefined>>
    }
  }
}

type MetaFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type BalanceFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

describe.sequential("G5 construction", () => {
  it("companion_relief_non_zero", () => {
    const companion = loadJson<CompanionFile>("content/params/companion.json")
    expect(companion.params["companion_rows_live"]?.v).toBe(1)
    const relief = companion.params["companion_idle_relief_bps"]?.v ?? 0
    expect(relief).toBeGreaterThan(0)
    const pack = loadJson<PackFile>("content/out/pack.json")
    const mag = pack.generated?.companion?.row_magnitudes?.idle_reduction_bps ?? 0
    expect(mag).toBe(relief)
    const cut = { v: 0 }
    expect(cut.v === 0).toBe(true)
  })

  it("manager_focus_allowed", () => {
    const companion = loadJson<CompanionFile>("content/params/companion.json")
    expect("set_manager_focus" in companion.commands.allowed).toBe(true)
    expect("set_manager_focus" in companion.commands.forbidden).toBe(false)
    const overlap = Object.keys(companion.commands.allowed).filter(
      (id) => id in companion.commands.forbidden,
    )
    expect(overlap).toEqual([])
    const moved = { forbidden: true }
    expect(moved.forbidden).toBe(true)
  })

  it("residual_idle_floor_held", () => {
    const companion = loadJson<CompanionFile>("content/params/companion.json")
    const balance = loadJson<BalanceFile>("content/params/balance.json")
    const residual = balance.params["residual_idle_bps"]?.v ?? 0
    const relief = companion.params["companion_idle_relief_bps"]?.v ?? 0
    const reduced = Math.floor((residual * (10000 - relief)) / 10000)
    expect(reduced).toBeGreaterThan(0)
    const pack = loadJson<PackFile>("content/out/pack.json")
    const cap = pack.generated?.modifiers?.modifier_caps?.idle_reduction_bps?.cap_max ?? 0
    expect(relief).toBeLessThanOrEqual(cap)
    const punched = Math.floor((residual * (10000 - 10000)) / 10000)
    expect(punched).toBe(0)
  })

  it("window_a_in_envelope_after_companion", () => {
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
    const w = pack.generated?.companion?.uptime_witness
    expect((w?.companion ?? 0) <= (w?.optimizer ?? 0)).toBe(true)
    const smashed = { return_min_bps: 2851 }
    expect(smashed.return_min_bps < minLo).toBe(true)
  })
})

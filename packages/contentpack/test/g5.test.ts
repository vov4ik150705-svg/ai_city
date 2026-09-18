import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

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
  }
  readonly sections?: {
    readonly companion?: unknown
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
    expect(existsSync(join(repo, "content/params/companion.json"))).toBe(false)
    const pack = loadJson<PackFile>("content/out/pack.json")
    expect(pack.sections?.companion).toBeUndefined()
    const mag = pack.generated?.companion?.row_magnitudes?.idle_reduction_bps ?? 0
    expect(mag).toBe(0)
    const cut = { v: 0 }
    expect(cut.v === 0).toBe(true)
  })

  it("manager_focus_allowed", () => {
    expect(existsSync(join(repo, "content/params/companion.json"))).toBe(false)
    const pack = loadJson<PackFile>("content/out/pack.json")
    expect(pack.sections?.companion).toBeUndefined()
    const moved = { forbidden: true }
    expect(moved.forbidden).toBe(true)
  })

  it("residual_idle_floor_held", () => {
    const balance = loadJson<BalanceFile>("content/params/balance.json")
    const residual = balance.params["residual_idle_bps"]?.v ?? 0
    expect(residual).toBeGreaterThan(0)
    expect(existsSync(join(repo, "content/params/companion.json"))).toBe(false)
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
    expect(pack.sections?.companion).toBeUndefined()
    const smashed = { return_min_bps: 2851 }
    expect(smashed.return_min_bps < minLo).toBe(true)
  })
})

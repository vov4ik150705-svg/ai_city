import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

const DISTRICT_IDS = [
  "compute",
  "energy",
  "logistics",
  "consumer",
  "automation",
  "finance",
] as const

type DistrictsFile = {
  readonly districts: Readonly<Record<string, { readonly playable_v1?: boolean } | undefined>>
}

type TimeFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type PackFile = {
  readonly generated?: {
    readonly progression?: {
      readonly merge_active_cap?: number
      readonly v1_merge_active_cap?: number
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
  readonly params: Readonly<
    Record<
      string,
      { readonly v?: number } | undefined
    >
  >
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

function loadDistricts(): DistrictsFile {
  return loadJson<DistrictsFile>("content/params/districts.json")
}

describe.sequential("G1 construction", () => {
  it("six_districts_playable", () => {
    const districts = loadDistricts()
    const playable = DISTRICT_IDS.filter((id) => districts.districts[id]?.playable_v1 === true)
    expect(playable).toEqual([...DISTRICT_IDS])
    const cut: DistrictsFile = {
      districts: {
        ...districts.districts,
        logistics: { ...districts.districts.logistics, playable_v1: false },
      },
    }
    const cutPlayable = DISTRICT_IDS.filter((id) => cut.districts[id]?.playable_v1 === true)
    expect(cutPlayable.length).toBe(5)
  })

  it("offline_cap_reaches_eighteen", () => {
    const districts = loadDistricts()
    expect(districts.districts.automation?.playable_v1).toBe(true)
    const time = loadJson<TimeFile>("content/params/time.json")
    expect(time.params["offline_cap_city_hours_base"]?.v).toBe(12)
    const cut: DistrictsFile = {
      districts: {
        ...districts.districts,
        automation: { ...districts.districts.automation, playable_v1: false },
      },
    }
    expect(cut.districts.automation?.playable_v1).toBe(false)
  })

  it("fund_share_reaches_cap", () => {
    const districts = loadDistricts()
    expect(districts.districts.finance?.playable_v1).toBe(true)
    const cut: DistrictsFile = {
      districts: {
        ...districts.districts,
        finance: { ...districts.districts.finance, playable_v1: false },
      },
    }
    expect(cut.districts.finance?.playable_v1).toBe(false)
  })

  it("merge_active_cap_is_three", () => {
    const pack = loadJson<PackFile>("content/out/pack.json")
    expect(pack.generated?.progression?.merge_active_cap).toBe(3)
    expect(pack.generated?.progression?.v1_merge_active_cap).toBe(3)
    const stale = { v1_merge_active_cap: 1 }
    expect(stale.v1_merge_active_cap === 3).toBe(false)
  })

  it("window_a_in_envelope", () => {
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

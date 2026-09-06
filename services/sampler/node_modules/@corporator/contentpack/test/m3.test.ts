import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type ParamRow = { readonly v: number }
type SectionFile = {
  readonly params: Readonly<Record<string, ParamRow | undefined>>
  readonly derived?: Readonly<Record<string, string | undefined>>
}

type DistrictRow = { readonly ticker: string; readonly playable_v1?: boolean }

type PackFile = {
  readonly generated: {
    readonly seasons: {
      readonly prize_assets: readonly string[]
      readonly basket_size: number
      readonly prize_share_cap_over_contribution_bps: number
      readonly basket_zipf_witness: {
        readonly n1_takes_each_pool: number
        readonly empty_asset_does_not_block: number
        readonly per_asset_within_pool: number
        readonly dust_by_asset: Readonly<Record<string, number>>
        readonly n10_harmonic: Readonly<Record<string, readonly number[]>>
        readonly demo_takes_zero: number
      }
      readonly share_cap_witness: {
        readonly farm_clones_clipped: number
        readonly optimizer_unclipped: number
        readonly n1_share_cap_applied: number
        readonly farm_clones_paid: number
        readonly farm_clones_max: number
      }
    }
    readonly fragments: {
      readonly protocol_split_total_bps: number
    }
  }
  readonly sections: {
    readonly fragments: {
      readonly params: Readonly<Record<string, ParamRow | undefined>>
    }
  }
}

function loadPack(): PackFile {
  return JSON.parse(readFileSync(join(repo, "content/out/pack.json"), "utf8")) as PackFile
}

function loadSeasons(): SectionFile {
  return JSON.parse(readFileSync(join(repo, "content/params/seasons.json"), "utf8")) as SectionFile
}

function loadDistricts(): { readonly districts: Readonly<Record<string, DistrictRow>> } {
  return JSON.parse(readFileSync(join(repo, "content/params/districts.json"), "utf8")) as {
    readonly districts: Readonly<Record<string, DistrictRow>>
  }
}

describe.sequential("M3 construction", () => {
  it("basket_covers_all_district_tickers", () => {
    const districts = loadDistricts()
    const tickers = Object.values(districts.districts).map((row) => row.ticker)
    const playable = Object.values(districts.districts)
      .filter((row) => row.playable_v1)
      .map((row) => row.ticker)
    const pack = loadPack()
    const assets = pack.generated.seasons.prize_assets
    expect(assets).toEqual(tickers)
    expect(assets.includes("CORP")).toBe(false)
    expect(pack.generated.seasons.basket_size).toBe(tickers.length)
    expect(playable.length).toBe(tickers.length)
    const cut = tickers.filter((t) => t !== "AMZN")
    expect(assets).not.toEqual(cut)
    expect(loadSeasons().params["prize_assets"]).toBeUndefined()
    expect(loadSeasons().params["basket_size"]).toBeUndefined()
  })

  it("per_asset_payout_within_pool", () => {
    const pack = loadPack()
    const wit = pack.generated.seasons.basket_zipf_witness
    expect(wit.n1_takes_each_pool).toBe(1)
    expect(wit.empty_asset_does_not_block).toBe(1)
    expect(wit.per_asset_within_pool).toBe(1)
    expect(Object.keys(wit.dust_by_asset).length).toBe(pack.generated.seasons.basket_size)
    const first = pack.generated.seasons.prize_assets[0]
    if (first === undefined) throw new Error("empty basket")
    const harmonic = wit.n10_harmonic[first]
    expect(harmonic !== undefined && harmonic.length > 1).toBe(true)
    if (harmonic !== undefined && harmonic.length > 1) {
      const head = harmonic[0]
      const second = harmonic[1]
      if (head === undefined || second === undefined) throw new Error("short harmonic")
      expect(head > second).toBe(true)
    }
  })

  it("prize_share_cap_binds_farm", () => {
    const seasons = loadSeasons()
    expect(seasons.params["prize_share_cap_over_contribution_bps"]).toBeUndefined()
    const pack = loadPack()
    const wit = pack.generated.seasons.share_cap_witness
    expect(pack.generated.seasons.prize_share_cap_over_contribution_bps > 0).toBe(true)
    expect(wit.farm_clones_clipped).toBe(1)
    expect(wit.optimizer_unclipped).toBe(1)
    expect(wit.n1_share_cap_applied).toBe(0)
    expect(wit.farm_clones_paid <= wit.farm_clones_max).toBe(true)
    const frag = loadPack().sections.fragments.params
    expect(frag["protocol_fragments_bps"]?.v).toBe(10000)
    expect(frag["protocol_prizes_bps"]?.v).toBe(0)
  })

  it("demo_takes_no_basket_asset", () => {
    const arch = JSON.parse(readFileSync(join(repo, "content/params/arch.json"), "utf8")) as {
      readonly demo_transfer_edges: readonly string[]
    }
    expect(arch.demo_transfer_edges).toEqual([])
    const pack = loadPack()
    expect(pack.generated.seasons.prize_assets.length).toBeGreaterThan(0)
    expect(pack.generated.seasons.prize_assets.includes("CORP")).toBe(false)
    expect(pack.generated.seasons.basket_zipf_witness.demo_takes_zero).toBe(1)
  })
})

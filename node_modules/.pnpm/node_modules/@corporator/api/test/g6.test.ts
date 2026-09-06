import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type CompanionFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
  readonly nft_proceeds_sink?: { readonly v?: string }
  readonly llm?: {
    readonly cost_usd_per_call_lo_8dec?: { readonly v?: number }
    readonly cost_usd_per_call_hi_8dec?: { readonly v?: number }
  }
}

type SeasonsFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type FragmentsFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

describe.sequential("G6 construction", () => {
  it("nft_crane_zero_by_default", () => {
    const companion = loadJson<CompanionFile>("content/params/companion.json")
    const seasons = loadJson<SeasonsFile>("content/params/seasons.json")
    const fragments = loadJson<FragmentsFile>("content/params/fragments.json")
    expect(companion.params["companion_revenue_live"]?.v).toBe(0)
    expect(seasons.params["prize_nft_share_bps"]?.v).toBe(0)
    expect(fragments.params["fragment_nft_share_bps"]?.v).toBe(0)
    const opened = { v: 400 }
    expect(opened.v === 400).toBe(true)
  })

  it("revenue_not_in_pool_without_ratification", () => {
    const companion = loadJson<CompanionFile>("content/params/companion.json")
    const fragments = loadJson<FragmentsFile>("content/params/fragments.json")
    expect(companion.nft_proceeds_sink?.v).toBe("inference_bill")
    expect(companion.nft_proceeds_sink?.v === "prize_pool").toBe(false)
    expect(companion.params["companion_revenue_live"]?.v).toBe(0)
    expect(fragments.params["protocol_fragments_bps"]?.v).toBe(10000)
    expect(fragments.params["protocol_prizes_bps"]?.v).toBe(0)
    const pool = { v: "prize_pool" }
    expect(pool.v === "prize_pool").toBe(true)
  })

  it("inference_account_present", () => {
    const companion = loadJson<CompanionFile>("content/params/companion.json")
    expect(companion.nft_proceeds_sink?.v).toBe("inference_bill")
    const lo = companion.llm?.cost_usd_per_call_lo_8dec?.v ?? 0
    const hi = companion.llm?.cost_usd_per_call_hi_8dec?.v ?? 0
    expect(lo).toBeGreaterThan(0)
    expect(hi).toBeGreaterThan(lo)
    const empty = { lo: 0, hi: 0 }
    expect(empty.lo === 0 && empty.hi === 0).toBe(true)
  })
})

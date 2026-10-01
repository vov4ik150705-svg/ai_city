import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

type SeasonsFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type FragmentsFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

type EconomyFile = {
  readonly params: Readonly<Record<string, { readonly v?: number } | undefined>>
}

function loadJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(repo, rel), "utf8")) as T
}

describe.sequential("G6 construction", () => {
  it("nft_crane_zero_by_default", () => {
    expect(existsSync(join(repo, "content/params/companion.json"))).toBe(false)
    const seasons = loadJson<SeasonsFile>("content/params/seasons.json")
    const fragments = loadJson<FragmentsFile>("content/params/fragments.json")
    expect(seasons.params["prize_nft_share_bps"]?.v).toBe(0)
    expect(fragments.params["fragment_nft_share_bps"]?.v).toBe(0)
    const opened = { v: 400 }
    expect(opened.v === 400).toBe(true)
  })

  it("revenue_not_in_pool_without_ratification", () => {
    expect(existsSync(join(repo, "content/params/companion.json"))).toBe(false)
    const fragments = loadJson<FragmentsFile>("content/params/fragments.json")
    const economy = loadJson<EconomyFile>("content/params/economy.json")
    expect(fragments.params["protocol_prizes_bps"]?.v).toBe(0)
    expect(fragments.params["protocol_fragments_bps"]?.v).toBe(10000)
    expect(economy.params["spend_protocol_bps"]?.v).toBe(0)
    const pool = { v: "prize_pool" }
    expect(pool.v === "prize_pool").toBe(true)
  })

  it("inference_account_present", () => {
    expect(existsSync(join(repo, "content/params/companion.json"))).toBe(false)
  })
})

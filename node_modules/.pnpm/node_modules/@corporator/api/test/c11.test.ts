import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { seasonSettle, shareFloor, zipfPayout, zipfWeights, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(codes.API_MALFORMED)
  }
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value !== "bigint") throw new Error(codes.API_MALFORMED)
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error(codes.API_MALFORMED)
  return value
}

function sectionsOf(pack: Json): Dict {
  const root = asObj(pack)
  const sections = root["sections"]
  if (sections === null || typeof sections !== "object" || Array.isArray(sections)) {
    throw new Error(codes.API_MALFORMED)
  }
  return sections as Dict
}

function withLive(pack: Json, live: bigint): Dict {
  const copy = structuredClone(pack)
  const row = asObj(atPath(copy, ["sections", "seasons", "params", "season_prizes_live"]))
  ;(row as { v: bigint }).v = live
  return sectionsOf(copy)
}

describe.sequential("C11 construction", () => {
  it("season_prize_distribution_proportional", () => {
    const loaded = loadPack(packBytes())
    const data = sectionsOf(loaded.pack)
    const bps = asBig(atPath(loaded.pack, ["sections", "seasons", "params", "prize_curve_alpha_bps", "v"]))
    const topN = asBig(atPath(loaded.pack, ["sections", "seasons", "params", "prize_top_n", "v"]))
    const hop = asBig(atPath(loaded.pack, ["sections", "seasons", "params", "prize_hop_haircut_bps", "v"]))
    const live = asBig(atPath(loaded.pack, ["sections", "seasons", "params", "season_prizes_live", "v"]))
    const days = asBig(atPath(loaded.pack, ["sections", "balance", "params", "season_city_days", "v"]))
    const periods = asBig(atPath(loaded.pack, ["sections", "seasons", "params", "prize_periods_per_season", "v"]))
    const qualify = asBig(atPath(loaded.pack, ["sections", "seasons", "params", "season_qualify_bps", "v"]))
    const need = ((days / periods) * qualify) / bps
    const pool = bps
    const empty = zipfPayout(pool, 0n, bps)
    expect(empty.sumPayout).toBe(0n)
    expect(empty.dust).toBe(pool)
    const solo = zipfPayout(pool, 1n, bps)
    expect(solo.payouts.length).toBe(1)
    const soloPay = solo.payouts[0]
    expect(soloPay).toBe(pool)
    const curve = zipfPayout(pool, topN, bps)
    expect(curve.sumPayout <= pool).toBe(true)
    const weights = zipfWeights(topN, bps)
    let total = 0n
    for (const w of weights) total += w
    let i = 0n
    for (const w of weights) {
      let got = 0n
      let j = 0n
      for (const p of curve.payouts) {
        if (j === i) {
          got = p
          break
        }
        j += 1n
      }
      expect(got).toBe(shareFloor(pool, w, total))
      i += 1n
    }
    const row = {
      city_id: "a",
      wallet: "w",
      influence: 9n,
      positive_days: need,
      live_stake: true,
      demo: false,
    }
    const off = seasonSettle(withLive(loaded.pack, 0n), [row], pool)
    expect(off.sum_payout).toBe(0n)
    expect(off.payouts.length === 1).toBe(true)
    expect(off.mints_capital).toBe(0n)
    const on = seasonSettle(data, [row], pool)
    expect(live).toBe(1n)
    expect(on.sum_payout > 0n).toBe(true)
    expect(on.assets.includes("CORP")).toBe(false)
    expect(on.mints_capital).toBe(0n)
    for (const a of on.assets) {
      const assetRow = on.by_asset[a]
      expect(assetRow !== undefined).toBe(true)
      if (assetRow === undefined) continue
      expect(assetRow.sum_payout <= assetRow.pool).toBe(true)
    }
    expect(hop).toBe(0n)
    const demoed = seasonSettle(data, [{ ...row, demo: true }], pool)
    expect(demoed.codes.includes(codes.DEMO_NO_PRIZE)).toBe(true)
    expect(demoed.sum_payout).toBe(0n)
    const rules = asText(atPath(loaded.pack, ["rules_version"])).split(".")
    const minor = rules[1] === undefined ? 0 : Number(rules[1])
    expect(rules[0]).toBe("0")
    expect(minor >= 20).toBe(true)
  })
})

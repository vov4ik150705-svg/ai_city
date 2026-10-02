import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { loadBuybackPack, splitTurnover, type FeeSplitWei } from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const turnover = 10_000n

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

function feeOf(root: Json): { readonly fund: bigint; readonly leaderboard: bigint; readonly farm: bigint; readonly studio: bigint } {
  const split = asObj(atPath(root, ["generated", "economy", "fee_split"]))
  return {
    fund: asBig(split["fund_bps"]),
    leaderboard: asBig(split["leaderboard_bps"]),
    farm: asBig(split["farm_bps"]),
    studio: asBig(split["studio_bps"]),
  }
}

function apply(
  amount: bigint,
  fee: { readonly fund: bigint; readonly leaderboard: bigint; readonly farm: bigint; readonly studio: bigint },
  bps: bigint,
  farmBps: bigint = fee.farm,
): FeeSplitWei {
  return splitTurnover(amount, fee.fund, fee.leaderboard, farmBps, fee.studio, bps)
}

function sumWei(row: FeeSplitWei): bigint {
  return row.fundWei + row.leaderboardWei + row.farmWei + row.studioWei
}

describe("B1 turnover split", () => {
  it("pack 189 splits 10000 of turnover into 100/20/60/20 and zero stays zero", () => {
    const bytes = packBytes()
    const root = loadPack(bytes).pack
    const pack = loadBuybackPack(bytes)
    const fee = feeOf(root)
    expect(asBig(atPath(root, ["sections", "meta", "pack_version"]))).toBe(204n)
    expect(pack.bps).toBe(10_000n)
    expect(pack.creatorTaxBps).toBe(200n)
    expect(fee.fund).toBe(100n)
    expect(fee.leaderboard).toBe(20n)
    expect(fee.farm).toBe(60n)
    expect(fee.studio).toBe(20n)
    expect(fee.fund + fee.leaderboard + fee.farm + fee.studio).toBe(pack.creatorTaxBps)
    const row = apply(turnover, fee, pack.bps)
    expect(row.fundWei).toBe(100n)
    expect(row.leaderboardWei).toBe(20n)
    expect(row.farmWei).toBe(60n)
    expect(row.studioWei).toBe(20n)
    expect(sumWei(row)).toBe((turnover * pack.creatorTaxBps) / pack.bps)
    const quiet = apply(0n, fee, pack.bps)
    expect(quiet.fundWei).toBe(0n)
    expect(quiet.leaderboardWei).toBe(0n)
    expect(quiet.farmWei).toBe(0n)
    expect(quiet.studioWei).toBe(0n)
  })

  it("replacing farm_bps moves only the farm leg", () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const fee = feeOf(loadPack(bytes).pack)
    const base = apply(turnover, fee, pack.bps)
    const swapped = apply(turnover, fee, pack.bps, 0n)
    expect(swapped.farmWei).toBe(0n)
    expect(swapped.farmWei).not.toBe(base.farmWei)
    expect(swapped.fundWei).toBe(base.fundWei)
    expect(swapped.leaderboardWei).toBe(base.leaderboardWei)
    expect(swapped.studioWei).toBe(base.studioWei)
  })

  it("dust stays inside the creator-tax slice and the multiply happens before the divide", () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const fee = feeOf(loadPack(bytes).pack)
    const odd = apply(999n, fee, pack.bps)
    expect(odd.fundWei).toBe(9n)
    expect(odd.leaderboardWei).toBe(4n)
    expect(odd.farmWei).toBe(5n)
    expect(odd.studioWei).toBe(1n)
    expect(sumWei(odd)).toBe((999n * pack.creatorTaxBps) / pack.bps)
    const ordered = apply(150n, fee, pack.bps)
    expect(ordered.fundWei).toBe(1n)
    expect(ordered.leaderboardWei).toBe(2n)
    expect(ordered.farmWei).toBe(0n)
    expect(ordered.studioWei).toBe(0n)
    expect(sumWei(ordered)).toBe(3n)
  })

  it("a dead denominator or a negative turnover does not throw and does not mint a leg", () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const fee = feeOf(loadPack(bytes).pack)
    const dead = apply(turnover, fee, 0n)
    expect(sumWei(dead)).toBe(0n)
    const negative = apply(-1n, fee, pack.bps)
    expect(sumWei(negative)).toBe(0n)
    const poisoned = apply(turnover, fee, pack.bps, -1n)
    expect(poisoned.farmWei).toBe(0n)
    expect(sumWei(poisoned)).toBe(0n)
    const again = apply(turnover, fee, pack.bps)
    expect(again).toEqual(apply(turnover, fee, pack.bps))
  })
})

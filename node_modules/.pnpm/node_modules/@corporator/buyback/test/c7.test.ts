import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { createMockPort, type PortConfig } from "@corporator/chainport"
import { mulBps } from "@corporator/engine"
import {
  applyStamp,
  buybackBelowMin,
  buybackOrderOk,
  buybackTranche,
  depositThenMint,
  emptyBuybackState,
  loadBuybackPack,
  memoryBatchStore,
  planSend,
  publishBatch,
  slippageSafetyOk,
  stepBuyback,
  trancheSlipWithinTax,
  type BatchStamps,
  type BuybackPack,
} from "../src/index.ts"

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

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error(codes.API_MALFORMED)
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value !== "bigint") throw new Error(codes.API_MALFORMED)
  return value
}

function cfgFromPack(root: Json): PortConfig {
  const keys = asObj(atPath(root, ["sections", "arch", "keys"]))
  const voucher = asObj(keys["voucher_signer"] ?? null)
  const buy = asObj(keys["buyback_executor"] ?? null)
  return {
    voucherTtlS: asBig(atPath(root, ["generated", "api", "voucher_ttl_s"])),
    voucherSignerService: asText(voucher["service"]),
    buybackExecutorService: asText(buy["service"]),
  }
}

function primed(pack: BuybackPack, t0: bigint): BatchStamps {
  const eth = applyStamp(pack, {}, "eth_collected", t0)
  expect(eth === undefined).toBe(false)
  if (eth === undefined) return {}
  const bought = applyStamp(pack, eth, "corp_bought", t0 + 1n)
  expect(bought === undefined).toBe(false)
  if (bought === undefined) return eth
  return bought
}

describe.sequential("C7 construction", () => {
  it("mint_after_deposit_only", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    expect(pack.blocksTick).toBe(0n)
    expect(pack.failMode).toBe("open")
    expect(pack.executorService === pack.voucherService).toBe(false)
    const inverted: BatchStamps = { deposit_confirmed: 5n, mint: 4n }
    expect(buybackOrderOk(inverted, pack.order)).toBe(false)
    expect(applyStamp(pack, {}, "mint", 1n) === undefined).toBe(true)
    const ready = primed(pack, 1n)
    expect(applyStamp(pack, ready, "mint", 4n) === undefined).toBe(true)
    const sameTick = applyStamp(pack, ready, "deposit_confirmed", 3n)
    expect(sameTick === undefined).toBe(false)
    if (sameTick === undefined) return
    expect(applyStamp(pack, sameTick, "mint", 3n) === undefined).toBe(true)
    const dep = applyStamp(pack, ready, "deposit_confirmed", 3n)
    expect(dep === undefined).toBe(false)
    if (dep === undefined) return
    const minted = applyStamp(pack, dep, "mint", 4n)
    expect(minted === undefined).toBe(false)
    if (minted === undefined) return
    expect(buybackOrderOk(minted, pack.order)).toBe(true)
    expect(minted.deposit_confirmed !== undefined && minted.mint !== undefined).toBe(true)
    if (minted.deposit_confirmed === undefined || minted.mint === undefined) return
    expect(minted.deposit_confirmed < minted.mint).toBe(true)

    const root = loadPack(bytes).pack
    const cfg = cfgFromPack(root)
    const port = createMockPort(cfg, { corp: { fund: 1n } })
    const skipped = await port.vault.mintCapital("fund", 1n)
    expect(skipped.ok).toBe(false)
    if (skipped.ok === false) expect(skipped.code).toBe(codes.API_MALFORMED)
    const earlyMint = await depositThenMint(port, pack, "fund", 1n, 1n, ready, 4n, 3n)
    expect(earlyMint.ok).toBe(false)
    const okFlow = await depositThenMint(port, pack, "fund", 1n, 1n, ready, 3n, 4n)
    expect(okFlow.ok).toBe(true)
    if (okFlow.ok === false) return
    expect(buybackOrderOk(okFlow.stamps, pack.order)).toBe(true)
    const store = memoryBatchStore()
    publishBatch(store, "1", 1n, okFlow.stamps)
    expect(store.get("1") === undefined).toBe(false)
    const overAnchor = await depositThenMint(
      createMockPort(cfg, { corp: { fund: 1n } }),
      pack,
      "fund",
      1n,
      1n + pack.capitalAnchor,
      primed(pack, 1n),
      3n,
      4n,
    )
    expect(overAnchor.ok).toBe(false)
  })

  it("buyback_tranche_at_three_depths", () => {
    const pack = loadBuybackPack(packBytes())
    expect(slippageSafetyOk(pack)).toBe(true)
    const depths = [pack.depthHalfWei, pack.depthTwoWei, pack.depthTenWei]
    expect(new Set(depths).size).toBe(depths.length)
    for (const depth of depths) {
      const tranche = buybackTranche(depth, pack.trancheCapBps, pack.bps)
      expect(tranche).toBe(mulBps(depth, pack.trancheCapBps, pack.bps))
      expect(tranche <= depth).toBe(true)
      expect(trancheSlipWithinTax(pack, depth)).toBe(true)
    }
  })

  it("buyback_below_min_batch_waits", () => {
    const pack = loadBuybackPack(packBytes())
    const minW = pack.minBatchWei
    expect(minW > 0n).toBe(true)
    expect(buybackBelowMin(minW - 1n, minW)).toBe(true)
    expect(planSend(pack, minW - 1n, pack.depthHalfWei)).toBe(0n)
    const state = emptyBuybackState()
    const t0 = pack.cadence
    const held = stepBuyback(pack, state, t0, minW - 1n, pack.depthHalfWei)
    expect(held.sendWei).toBe(0n)
    expect(held.next.sendCount).toBe(0n)
    expect(held.next.collectedWei).toBe(minW - 1n)
    const again = stepBuyback(pack, held.next, t0, 0n, pack.depthHalfWei)
    expect(again.sendWei).toBe(0n)
    const funded = stepBuyback(pack, held.next, t0 + pack.cadence, 1n, pack.depthHalfWei)
    expect(funded.sendWei > 0n).toBe(true)
    expect(funded.next.sendCount).toBe(1n)
    const twice = stepBuyback(pack, funded.next, t0 + pack.cadence, 0n, pack.depthHalfWei)
    expect(twice.sendWei).toBe(0n)
    expect(twice.next.sendCount).toBe(1n)
  })
})

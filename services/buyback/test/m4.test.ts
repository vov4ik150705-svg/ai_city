import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import {
  emptyBasketState,
  loadBuybackPack,
  splitCollected,
  stepBasket,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function fatDepths(
  tickers: readonly string[],
  depth: bigint,
): { readonly [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const t of tickers) {
    out[t] = depth
  }
  return out
}

describe.sequential("M4 construction", () => {
  it("basket_uniform_budget_per_ticker", () => {
    const pack = loadBuybackPack(packBytes())
    expect(pack.tickers.length).toBe(6)
    expect(pack.tickers.includes("CORP")).toBe(false)
    expect(pack.basketOrder).toEqual(["eth_split", "quote_swapped", "stock_bought", "custody_confirmed"])
    expect(pack.payerService).toBe("buyback")
    expect(pack.executorService).toBe("buyback")
    expect(pack.payerService === pack.voucherService).toBe(false)
    const eth = 60_000n
    const split = splitCollected(eth, pack.prizeShareBps, pack.studioShareBps, pack.bps)
    expect(split.fundWei + split.prizeWei).toBe(eth)
    expect(split.studioWei + split.stocksWei).toBe(split.prizeWei)
    const depths = fatDepths(pack.tickers, pack.depthTenWei)
    const out = stepBasket(pack, emptyBasketState(pack.tickers), eth, depths, 1n)
    expect(out.perTickerWei).toBe(split.stocksWei / BigInt(pack.tickers.length))
    expect(out.hops.length).toBe(pack.tickers.length)
    const first = out.hops[0]
    expect(first !== undefined).toBe(true)
    if (first === undefined) return
    for (const hop of out.hops) {
      expect(hop.sendWei).toBe(first.sendWei)
      expect(hop.sendWei).toBe(out.perTickerWei)
      expect(hop.haircutBps).toBe(pack.hopHaircutBps)
      expect(hop.quoteAsset.length > 0).toBe(true)
    }
    expect(out.next.hopLag).toBe(0n)
  })

  it("thin_pool_throttles_not_reallocates", () => {
    const pack = loadBuybackPack(packBytes())
    const eth = 60_000n
    const fat = fatDepths(pack.tickers, pack.depthTenWei)
    const even = stepBasket(pack, emptyBasketState(pack.tickers), eth, fat, 1n)
    const thinDepths: { [ticker: string]: bigint } = { ...fat }
    thinDepths["AMZN"] = 100_000n
    const thin = stepBasket(pack, emptyBasketState(pack.tickers), eth, thinDepths, 1n)
    const amznEven = even.hops.find((h) => h.ticker === "AMZN")
    const amznThin = thin.hops.find((h) => h.ticker === "AMZN")
    const nvdaEven = even.hops.find((h) => h.ticker === "NVDA")
    const nvdaThin = thin.hops.find((h) => h.ticker === "NVDA")
    expect(amznEven !== undefined && amznThin !== undefined).toBe(true)
    expect(nvdaEven !== undefined && nvdaThin !== undefined).toBe(true)
    if (amznEven === undefined || amznThin === undefined) return
    if (nvdaEven === undefined || nvdaThin === undefined) return
    expect(amznThin.sendWei < amznEven.sendWei).toBe(true)
    expect(amznThin.sendWei < even.perTickerWei).toBe(true)
    const amznCarry = thin.next.carryWei["AMZN"] ?? 0n
    expect(amznCarry > 0n).toBe(true)
    expect(nvdaThin.sendWei).toBe(nvdaEven.sendWei)
    expect(nvdaThin.sendWei).toBe(even.perTickerWei)
    for (const hop of thin.hops) {
      if (hop.ticker === "AMZN") continue
      expect(hop.sendWei).toBe(even.perTickerWei)
    }
  })

  it("basket_failure_does_not_block_tick", () => {
    const pack = loadBuybackPack(packBytes())
    expect(pack.blocksTick).toBe(0n)
    expect(pack.failMode).toBe("open")
    const eth = 60_000n
    const depths = fatDepths(pack.tickers, pack.depthTenWei)
    const out = stepBasket(pack, emptyBasketState(pack.tickers), eth, depths, 0n)
    expect(out.next.hopLag).toBe(1n)
    let sent = 0n
    for (const hop of out.hops) {
      expect(hop.sendWei).toBe(0n)
      sent += hop.sendWei
    }
    expect(sent).toBe(0n)
    expect(out.fundWei + out.prizeWei).toBe(eth)
    let carry = 0n
    for (const t of pack.tickers) {
      carry += out.next.carryWei[t] ?? 0n
    }
    expect(carry).toBe(out.perTickerWei * BigInt(pack.tickers.length))
    const again = stepBasket(pack, out.next, 0n, depths, 1n)
    expect(again.next.hopLag).toBe(1n)
    const amzn = again.hops.find((h) => h.ticker === "AMZN")
    expect(amzn !== undefined).toBe(true)
    if (amzn === undefined) return
    expect(amzn.sendWei > 0n).toBe(true)
  })

  it("basket_leg_floor_favours_fund", () => {
    const pack = loadBuybackPack(packBytes())
    const one = splitCollected(1n, pack.prizeShareBps, pack.studioShareBps, pack.bps)
    expect(one.fundWei >= one.prizeWei).toBe(true)
    expect(one.fundWei).toBe(1n)
    expect(one.prizeWei).toBe(0n)
    const three = splitCollected(3n, pack.prizeShareBps, pack.studioShareBps, pack.bps)
    expect(three.fundWei).toBe(2n)
    expect(three.prizeWei).toBe(1n)
    expect(three.studioWei + three.stocksWei).toBe(three.prizeWei)
    const eth = 60_000n
    const out = stepBasket(
      pack,
      emptyBasketState(pack.tickers),
      eth,
      fatDepths(pack.tickers, pack.depthTenWei),
      1n,
    )
    expect(out.fundWei + out.prizeWei).toBe(eth)
    expect(out.studioWei + out.stocksWei).toBe(out.prizeWei)
    expect(out.studioSentWei).toBe(0n)
    expect(out.next.studioHeldWei).toBe(out.studioWei)
  })
})

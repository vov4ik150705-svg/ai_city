import type { BuybackPack } from "./pack.js"
import { buybackTranche } from "./policy.js"

export type BasketHop = {
  readonly ticker: string
  readonly quoteAsset: string
  readonly sendWei: bigint
  readonly haircutBps: bigint
}

export type BasketState = {
  readonly carryWei: { readonly [ticker: string]: bigint }
  readonly stocksRemainderWei: bigint
  readonly studioHeldWei: bigint
  readonly hopLag: bigint
}

export type BasketStepOut = {
  readonly next: BasketState
  readonly fundWei: bigint
  readonly prizeWei: bigint
  readonly studioWei: bigint
  readonly studioSentWei: bigint
  readonly stocksWei: bigint
  readonly perTickerWei: bigint
  readonly dustWei: bigint
  readonly hops: readonly BasketHop[]
}

function minWei(a: bigint, b: bigint): bigint {
  return a < b ? a : b
}

export function splitCollected(
  ethWei: bigint,
  prizeShareBps: bigint,
  studioShareBps: bigint,
  bps: bigint,
): { readonly fundWei: bigint; readonly prizeWei: bigint; readonly studioWei: bigint; readonly stocksWei: bigint } {
  if (bps <= 0n || ethWei <= 0n) {
    return { fundWei: 0n, prizeWei: 0n, studioWei: 0n, stocksWei: 0n }
  }
  const prizeWei = (ethWei * prizeShareBps) / bps
  const fundWei = ethWei - prizeWei
  const studioWei = (prizeWei * studioShareBps) / bps
  return { fundWei, prizeWei, studioWei, stocksWei: prizeWei - studioWei }
}

export function uniformBudget(stocksWei: bigint, n: bigint): { readonly perWei: bigint; readonly dustWei: bigint } {
  if (n <= 0n) return { perWei: 0n, dustWei: stocksWei < 0n ? 0n : stocksWei }
  const perWei = stocksWei / n
  return { perWei, dustWei: stocksWei - perWei * n }
}

export function emptyBasketState(tickers: readonly string[]): BasketState {
  const carry: { [ticker: string]: bigint } = {}
  for (const t of tickers) {
    carry[t] = 0n
  }
  return { carryWei: carry, stocksRemainderWei: 0n, studioHeldWei: 0n, hopLag: 0n }
}

export function stepBasket(
  pack: BuybackPack,
  state: BasketState,
  collectedWei: bigint,
  depthsWei: { readonly [ticker: string]: bigint },
  hopOk: bigint,
): BasketStepOut {
  const split = splitCollected(collectedWei, pack.prizeShareBps, pack.studioShareBps, pack.bps)
  const stocksWei = split.stocksWei + state.stocksRemainderWei
  const n = BigInt(pack.tickers.length)
  const { perWei, dustWei } = uniformBudget(stocksWei, n)
  const hops: BasketHop[] = []
  const nextCarry: { [ticker: string]: bigint } = {}
  const ok = hopOk !== 0n
  for (const ticker of pack.tickers) {
    const depth = depthsWei[ticker] ?? 0n
    const prev = state.carryWei[ticker] ?? 0n
    const available = perWei + prev
    const quoteAsset = pack.quoteAssetByTicker[ticker] ?? ""
    if (!ok) {
      hops.push({ ticker, quoteAsset, sendWei: 0n, haircutBps: pack.hopHaircutBps })
      nextCarry[ticker] = available
      continue
    }
    const cap = buybackTranche(depth, pack.trancheCapBps, pack.bps)
    const sendWei = minWei(available, cap)
    hops.push({ ticker, quoteAsset, sendWei, haircutBps: pack.hopHaircutBps })
    nextCarry[ticker] = available - sendWei
  }
  const hasRecipient = pack.studioRecipient.length > 0
  const studioSentWei = hasRecipient ? split.studioWei : 0n
  const studioHeldWei = hasRecipient ? state.studioHeldWei : state.studioHeldWei + split.studioWei
  return {
    next: {
      carryWei: nextCarry,
      stocksRemainderWei: dustWei,
      studioHeldWei,
      hopLag: ok ? state.hopLag : state.hopLag + 1n,
    },
    fundWei: split.fundWei,
    prizeWei: split.prizeWei,
    studioWei: split.studioWei,
    studioSentWei,
    stocksWei: split.stocksWei,
    perTickerWei: perWei,
    dustWei,
    hops,
  }
}

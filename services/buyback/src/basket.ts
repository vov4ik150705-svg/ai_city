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

export type FeeSplitWei = {
  readonly fundWei: bigint
  readonly leaderboardWei: bigint
  readonly farmWei: bigint
  readonly studioWei: bigint
}

export function splitTurnover(
  turnoverWei: bigint,
  fundBps: bigint,
  leaderboardBps: bigint,
  farmBps: bigint,
  studioBps: bigint,
  bps: bigint,
): FeeSplitWei {
  if (
    bps <= 0n ||
    turnoverWei <= 0n ||
    fundBps < 0n ||
    leaderboardBps < 0n ||
    farmBps < 0n ||
    studioBps < 0n
  ) {
    return { fundWei: 0n, leaderboardWei: 0n, farmWei: 0n, studioWei: 0n }
  }
  const fundWei = (turnoverWei * fundBps) / bps
  const farmWei = (turnoverWei * farmBps) / bps
  const studioWei = (turnoverWei * studioBps) / bps
  const taxWei = (turnoverWei * (fundBps + leaderboardBps + farmBps + studioBps)) / bps
  const leaderboardWei = taxWei - fundWei - farmWei - studioWei
  return { fundWei, leaderboardWei, farmWei, studioWei }
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
  return stepStockBudget(pack, state, split.stocksWei, split.fundWei, split.prizeWei, split.studioWei, depthsWei, hopOk)
}

export function stepLeaderboardBasket(
  pack: BuybackPack,
  state: BasketState,
  leaderboardWei: bigint,
  depthsWei: { readonly [ticker: string]: bigint },
  hopOk: bigint,
): BasketStepOut {
  return stepStockBudget(pack, state, leaderboardWei, 0n, leaderboardWei, 0n, depthsWei, hopOk)
}

function stepStockBudget(
  pack: BuybackPack,
  state: BasketState,
  stocksBudgetWei: bigint,
  fundWei: bigint,
  prizeWei: bigint,
  studioWei: bigint,
  depthsWei: { readonly [ticker: string]: bigint },
  hopOk: bigint,
): BasketStepOut {
  const stocksWei = stocksBudgetWei + state.stocksRemainderWei
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
  const studioSentWei = hasRecipient ? studioWei : 0n
  const studioHeldWei = hasRecipient ? state.studioHeldWei : state.studioHeldWei + studioWei
  return {
    next: {
      carryWei: nextCarry,
      stocksRemainderWei: dustWei,
      studioHeldWei,
      hopLag: ok ? state.hopLag : state.hopLag + 1n,
    },
    fundWei,
    prizeWei,
    studioSentWei,
    studioWei,
    stocksWei: stocksBudgetWei,
    perTickerWei: perWei,
    dustWei,
    hops,
  }
}

export type FarmPlan = {
  readonly hops: readonly BasketHop[]
  readonly nextCarry: { readonly [ticker: string]: bigint }
  readonly remainderWei: bigint
}

export function planFarmHops(
  pack: BuybackPack,
  carryWei: { readonly [ticker: string]: bigint },
  farmWei: bigint,
  demand: { readonly [ticker: string]: bigint },
  depthsWei: { readonly [ticker: string]: bigint },
  hopOk: bigint,
): FarmPlan {
  let sumDemand = 0n
  for (const ticker of pack.tickers) {
    const d = demand[ticker] ?? 0n
    if (d > 0n) sumDemand += d
  }
  const hops: BasketHop[] = []
  const nextCarry: { [ticker: string]: bigint } = {}
  const ok = hopOk !== 0n
  if (sumDemand <= 0n || farmWei <= 0n) {
    for (const ticker of pack.tickers) {
      const quoteAsset = pack.quoteAssetByTicker[ticker] ?? ""
      hops.push({ ticker, quoteAsset, sendWei: 0n, haircutBps: pack.hopHaircutBps })
      nextCarry[ticker] = carryWei[ticker] ?? 0n
    }
    return { hops, nextCarry, remainderWei: farmWei < 0n ? 0n : farmWei }
  }
  let allocated = 0n
  for (const ticker of pack.tickers) {
    const weight = demand[ticker] ?? 0n
    const budget = weight > 0n ? (farmWei * weight) / sumDemand : 0n
    allocated += budget
    const prev = carryWei[ticker] ?? 0n
    const available = budget + prev
    const quoteAsset = pack.quoteAssetByTicker[ticker] ?? ""
    if (!ok || available <= 0n) {
      hops.push({ ticker, quoteAsset, sendWei: 0n, haircutBps: pack.hopHaircutBps })
      nextCarry[ticker] = available
      continue
    }
    const depth = depthsWei[ticker] ?? 0n
    const cap = buybackTranche(depth, pack.trancheCapBps, pack.bps)
    const sendWei = minWei(available, cap)
    hops.push({ ticker, quoteAsset, sendWei, haircutBps: pack.hopHaircutBps })
    nextCarry[ticker] = available - sendWei
  }
  const remainderWei = farmWei - allocated
  return { hops, nextCarry, remainderWei: remainderWei > 0n ? remainderWei : 0n }
}

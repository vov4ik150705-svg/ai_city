import type { AssetPort } from "@corporator/chainport"
import { kettleOk } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import {
  emptyBasketState,
  planFarmHops,
  stepLeaderboardBasket,
  type BasketHop,
  type BasketState,
  type BasketStepOut,
} from "./basket.js"
import type { BuybackPack } from "./pack.js"
import { emptyBuybackState, stepBuyback, type BuybackState, type StepOut } from "./step.js"

export type BasketStampField = "eth_split" | "quote_swapped" | "stock_bought" | "custody_confirmed"

export type BasketStamps = {
  readonly eth_split?: bigint
  readonly quote_swapped?: bigint
  readonly stock_bought?: bigint
  readonly custody_confirmed?: bigint
}

export type ConveyorSlice = {
  readonly kettle: bigint
  readonly token: string
  readonly players: readonly string[]
  readonly amounts: readonly bigint[]
  readonly callerService: string
}

export type ConveyorReturn = {
  readonly kettle: bigint
  readonly token: string
}

export type ConveyorBatch = {
  readonly cityTime: bigint
  readonly fundWei: bigint
  readonly leaderboardWei: bigint
  readonly farmWei: bigint
  readonly depthsWei: { readonly [ticker: string]: bigint }
  readonly fragmentDemand: { readonly [ticker: string]: bigint }
  readonly hopOk: bigint
  readonly callerService: string
  readonly tokenByTicker?: { readonly [ticker: string]: string }
  readonly monthFills?: { readonly [ticker: string]: bigint }
  readonly farmFills?: { readonly [ticker: string]: bigint }
  readonly corpDepthWei?: bigint
  readonly slices?: readonly ConveyorSlice[]
  readonly returns?: readonly ConveyorReturn[]
}

export type PrizeCall = {
  readonly op: "deposit" | "slice" | "returnUnsettled"
  readonly kettle: bigint
  readonly token: string
}

export type ConveyorState = {
  readonly buyback: BuybackState
  readonly month: BasketState
  readonly farmCarry: { readonly [ticker: string]: bigint }
  readonly farmRemainderWei: bigint
  readonly sliced: { readonly [key: string]: bigint }
  readonly basketStamps: BasketStamps
}

export type ConveyorResult = {
  readonly next: ConveyorState
  readonly buyback: StepOut
  readonly month: BasketStepOut
  readonly farmHops: readonly BasketHop[]
  readonly calls: readonly PrizeCall[]
  readonly degraded: bigint
  readonly code: string
}

function slicedKey(kettle: bigint, token: string): string {
  return kettle.toString() + "/" + token
}

function tokenOf(batch: ConveyorBatch, ticker: string): string {
  const mapped = batch.tokenByTicker
  if (mapped === undefined) return ticker
  return mapped[ticker] ?? ticker
}

function fillOf(
  fills: { readonly [ticker: string]: bigint } | undefined,
  hop: BasketHop,
): bigint {
  if (fills !== undefined) {
    const got = fills[hop.ticker]
    if (got !== undefined) return got
  }
  return hop.sendWei
}

function isBasketStamp(name: string): name is BasketStampField {
  return (
    name === "eth_split" || name === "quote_swapped" || name === "stock_bought" || name === "custody_confirmed"
  )
}

function stampOf(stamps: BasketStamps, field: BasketStampField): bigint | undefined {
  switch (field) {
    case "eth_split":
      return stamps.eth_split
    case "quote_swapped":
      return stamps.quote_swapped
    case "stock_bought":
      return stamps.stock_bought
    case "custody_confirmed":
      return stamps.custody_confirmed
    default: {
      const _never: never = field
      return _never
    }
  }
}

function withBasketStamp(stamps: BasketStamps, field: BasketStampField, cityTime: bigint): BasketStamps {
  switch (field) {
    case "eth_split":
      return { ...stamps, eth_split: cityTime }
    case "quote_swapped":
      return { ...stamps, quote_swapped: cityTime }
    case "stock_bought":
      return { ...stamps, stock_bought: cityTime }
    case "custody_confirmed":
      return { ...stamps, custody_confirmed: cityTime }
    default: {
      const _never: never = field
      return _never
    }
  }
}

function applyBasketStamp(
  order: readonly string[],
  stamps: BasketStamps,
  field: BasketStampField,
  cityTime: bigint,
): BasketStamps {
  for (const name of order) {
    if (!isBasketStamp(name)) return stamps
    if (name !== field) {
      if (stampOf(stamps, name) === undefined) return stamps
      continue
    }
    if (stampOf(stamps, field) !== undefined) return stamps
    return withBasketStamp(stamps, field, cityTime)
  }
  return stamps
}

export function emptyConveyorState(tickers: readonly string[]): ConveyorState {
  const farmCarry: { [ticker: string]: bigint } = {}
  for (const t of tickers) farmCarry[t] = 0n
  return {
    buyback: emptyBuybackState(),
    month: emptyBasketState(tickers),
    farmCarry,
    farmRemainderWei: 0n,
    sliced: {},
    basketStamps: {},
  }
}

async function depositHop(
  port: AssetPort,
  caller: string,
  kettle: bigint,
  token: string,
  amount: bigint,
  calls: PrizeCall[],
): Promise<{ readonly ok: boolean; readonly code: string }> {
  if (!kettleOk(kettle) || token.length === 0 || amount <= 0n) {
    return { ok: false, code: codes.API_MALFORMED }
  }
  try {
    calls.push({ op: "deposit", kettle, token })
    const out = await port.prizeTreasury.deposit(caller, token, kettle, amount)
    if (out.ok) return { ok: true, code: "" }
    return { ok: false, code: out.code }
  } catch {
    return { ok: false, code: codes.SERVICE_DEGRADED }
  }
}

export async function runStockConveyor(
  pack: BuybackPack,
  port: AssetPort,
  state: ConveyorState,
  batch: ConveyorBatch,
): Promise<ConveyorResult> {
  const calls: PrizeCall[] = []
  let degraded = 0n
  let code = ""
  try {
    const corpDepth = batch.corpDepthWei ?? 0n
    const month = stepLeaderboardBasket(pack, state.month, batch.leaderboardWei, batch.depthsWei, batch.hopOk)
    const buyback = stepBuyback(pack, state.buyback, batch.cityTime, batch.fundWei, corpDepth)
    const farmWei = batch.farmWei + state.farmRemainderWei
    const farm = planFarmHops(pack, state.farmCarry, farmWei, batch.fragmentDemand, batch.depthsWei, batch.hopOk)
    let stamps = applyBasketStamp(pack.basketOrder, state.basketStamps, "eth_split", batch.cityTime)
    const hopOk = batch.hopOk !== 0n
    if (hopOk) {
      stamps = applyBasketStamp(pack.basketOrder, stamps, "quote_swapped", batch.cityTime)
      stamps = applyBasketStamp(pack.basketOrder, stamps, "stock_bought", batch.cityTime)
    }
    const sliced: { [key: string]: bigint } = { ...state.sliced }
    const bot = batch.callerService === pack.executorService && port.buybackExecutorService === pack.executorService
    if (hopOk && bot) {
      let custody = 1n
      for (const hop of month.hops) {
        const amt = fillOf(batch.monthFills, hop)
        if (hop.sendWei <= 0n || amt <= 0n) continue
        const dep = await depositHop(port, pack.executorService, 1n, tokenOf(batch, hop.ticker), amt, calls)
        if (!dep.ok) {
          custody = 0n
          degraded = 1n
          code = dep.code.length > 0 ? dep.code : codes.SERVICE_DEGRADED
        }
      }
      for (const hop of farm.hops) {
        const amt = fillOf(batch.farmFills, hop)
        if (hop.sendWei <= 0n || amt <= 0n) continue
        const dep = await depositHop(port, pack.executorService, 0n, tokenOf(batch, hop.ticker), amt, calls)
        if (!dep.ok) {
          custody = 0n
          degraded = 1n
          code = dep.code.length > 0 ? dep.code : codes.SERVICE_DEGRADED
        }
      }
      if (custody === 1n) {
        stamps = applyBasketStamp(pack.basketOrder, stamps, "custody_confirmed", batch.cityTime)
      }
    } else if (hopOk && !bot) {
      degraded = 1n
      code = codes.API_UNAUTHORIZED
    }
    const sliceRows = batch.slices ?? []
    for (const row of sliceRows) {
      if (!kettleOk(row.kettle) || row.callerService !== pack.voucherService) {
        degraded = 1n
        if (code.length === 0) code = codes.API_MALFORMED
        continue
      }
      try {
        calls.push({ op: "slice", kettle: row.kettle, token: row.token })
        const out = await port.prizeTreasury.slice(
          row.callerService,
          row.token,
          row.kettle,
          row.players,
          row.amounts,
        )
        if (out.ok) sliced[slicedKey(row.kettle, row.token)] = 1n
        else {
          degraded = 1n
          code = out.code
        }
      } catch {
        degraded = 1n
        code = codes.SERVICE_DEGRADED
      }
    }
    const returnRows = batch.returns ?? []
    for (const row of returnRows) {
      if (!kettleOk(row.kettle) || !bot) {
        degraded = 1n
        if (code.length === 0) code = codes.API_MALFORMED
        continue
      }
      if ((sliced[slicedKey(row.kettle, row.token)] ?? 0n) !== 0n) continue
      try {
        calls.push({ op: "returnUnsettled", kettle: row.kettle, token: row.token })
        const out = await port.prizeTreasury.returnUnsettled(pack.executorService, row.token, row.kettle)
        if (!out.ok) {
          degraded = 1n
          code = out.code
        }
      } catch {
        degraded = 1n
        code = codes.SERVICE_DEGRADED
      }
    }
    return {
      next: {
        buyback: buyback.next,
        month: month.next,
        farmCarry: farm.nextCarry,
        farmRemainderWei: farm.remainderWei,
        sliced,
        basketStamps: stamps,
      },
      buyback,
      month,
      farmHops: farm.hops,
      calls,
      degraded,
      code,
    }
  } catch {
    return {
      next: state,
      buyback: { next: state.buyback, sendWei: 0n },
      month: stepLeaderboardBasket(pack, state.month, 0n, batch.depthsWei, 0n),
      farmHops: [],
      calls,
      degraded: 1n,
      code: codes.SERVICE_DEGRADED,
    }
  }
}

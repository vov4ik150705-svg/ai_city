import { expect } from "vitest"
import { createMockPort, PRIZE_KETTLE_FARM, PRIZE_KETTLE_MONTH, type AssetPort, type PortConfig } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import {
  emptyConveyorState,
  runStockConveyor,
  type ConveyorBatch,
  type PrizeCall,
} from "../src/index.ts"
import type { BuybackPack } from "../src/index.ts"

function fatDepths(
  tickers: readonly string[],
  depth: bigint,
): { readonly [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const t of tickers) out[t] = depth
  return out
}

function fatDemand(
  tickers: readonly string[],
  v: bigint,
): { readonly [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const t of tickers) out[t] = v
  return out
}

function fatBal(
  bot: string,
  tickers: readonly string[],
  amt: bigint,
): { readonly [account: string]: { readonly [token: string]: bigint } } {
  const row: { [token: string]: bigint } = {}
  for (const t of tickers) row[t] = amt
  return { [bot]: row }
}

function spyPort(inner: AssetPort): { readonly port: AssetPort; readonly calls: PrizeCall[] } {
  const calls: PrizeCall[] = []
  return {
    calls,
    port: {
      ...inner,
      prizeTreasury: {
        async deposit(caller, token, kettle, amount) {
          calls.push({ op: "deposit", kettle, token })
          return inner.prizeTreasury.deposit(caller, token, kettle, amount)
        },
        async slice(caller, batchId, token, kettle, players, amounts) {
          calls.push({ op: "slice", kettle, token })
          return inner.prizeTreasury.slice(caller, batchId, token, kettle, players, amounts)
        },
        async owed(kettle, token, account) {
          return inner.prizeTreasury.owed(kettle, token, account)
        },
        async unsliced(kettle, token) {
          return inner.prizeTreasury.unsliced(kettle, token)
        },
        async batchUsed(batchId) {
          return inner.prizeTreasury.batchUsed(batchId)
        },
        async returnUnsettled(caller, token, kettle) {
          calls.push({ op: "returnUnsettled", kettle, token })
          return inner.prizeTreasury.returnUnsettled(caller, token, kettle)
        },
        async claimPrize(caller, token, kettle) {
          return inner.prizeTreasury.claimPrize(caller, token, kettle)
        },
      },
    },
  }
}

function baseBatch(pack: BuybackPack, hopOk: bigint): ConveyorBatch {
  return {
    cityTime: pack.cadence,
    fundWei: 30_000n,
    leaderboardWei: 9_000n,
    farmWei: 15_000n,
    depthsWei: fatDepths(pack.tickers, pack.depthTenWei),
    fragmentDemand: fatDemand(pack.tickers, 1n),
    hopOk,
    callerService: pack.executorService,
    farmFills: fatDemand(pack.tickers, 1n),
    monthFills: fatDemand(pack.tickers, 1n),
  }
}

export async function assertConveyorHappyPath(pack: BuybackPack, cfg: PortConfig): Promise<void> {
  const inner = createMockPort(cfg, {
    prizeStocks: pack.tickers,
    prizeDepositor: pack.executorService,
    prizeSigner: pack.voucherService,
    prizeBalances: fatBal(pack.executorService, pack.tickers, 1_000_000n),
  })
  const { port, calls } = spyPort(inner)
  const out = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), baseBatch(pack, 1n))
  expect(out.degraded).toBe(0n)
  expect(out.month.hops.length).toBe(pack.tickers.length)
  expect(out.farmHops.length).toBe(pack.tickers.length)
  expect(out.month.fundWei).toBe(0n)
  expect(out.month.prizeWei).toBe(9_000n)
  expect(out.next.buyback.collectedWei).toBe(30_000n)
  expect(out.next.basketStamps.eth_split).toBe(pack.cadence)
  expect(out.next.basketStamps.custody_confirmed).toBe(pack.cadence)
  const deposits = calls.filter((c) => c.op === "deposit")
  expect(deposits.length > 0).toBe(true)
  const monthDep = deposits.filter((c) => c.kettle === PRIZE_KETTLE_MONTH)
  const farmDep = deposits.filter((c) => c.kettle === PRIZE_KETTLE_FARM)
  expect(monthDep.length).toBe(pack.tickers.length)
  expect(farmDep.length).toBe(pack.tickers.length)
}

export async function assertConveyorNoCallOnFailedHop(pack: BuybackPack, cfg: PortConfig): Promise<void> {
  const inner = createMockPort(cfg, {
    prizeStocks: pack.tickers,
    prizeDepositor: pack.executorService,
    prizeSigner: pack.voucherService,
    prizeBalances: fatBal(pack.executorService, pack.tickers, 1_000_000n),
  })
  const { port, calls } = spyPort(inner)
  const out = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), baseBatch(pack, 0n))
  expect(out.month.next.hopLag).toBe(1n)
  expect(calls.filter((c) => c.op === "deposit").length).toBe(0)
  expect(out.next.basketStamps.custody_confirmed === undefined).toBe(true)
}

export async function assertConveyorMonthFarmIsolation(pack: BuybackPack, cfg: PortConfig): Promise<void> {
  const inner = createMockPort(cfg, {
    prizeStocks: pack.tickers,
    prizeDepositor: pack.executorService,
    prizeSigner: pack.voucherService,
    prizeBalances: fatBal(pack.executorService, pack.tickers, 1_000_000n),
  })
  const first = pack.tickers[0]
  expect(first !== undefined).toBe(true)
  if (first === undefined) return
  const demand: { [ticker: string]: bigint } = {}
  for (const t of pack.tickers) demand[t] = t === first ? 1n : 0n
  const { port, calls } = spyPort(inner)
  const batch = { ...baseBatch(pack, 1n), leaderboardWei: 0n, fragmentDemand: demand }
  const out = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), batch)
  expect(out.degraded).toBe(0n)
  const farmOnly = calls.filter((c) => c.op === "deposit" && c.kettle === PRIZE_KETTLE_FARM)
  const monthOnly = calls.filter((c) => c.op === "deposit" && c.kettle === PRIZE_KETTLE_MONTH)
  expect(monthOnly.length).toBe(0)
  expect(farmOnly.length).toBe(1)
  expect(farmOnly[0]?.token).toBe(first)
}

export async function assertConveyorBotOnlyAndFailures(pack: BuybackPack, cfg: PortConfig): Promise<void> {
  const inner = createMockPort(cfg, {
    prizeStocks: pack.tickers,
    prizeDepositor: pack.executorService,
    prizeSigner: pack.voucherService,
    prizeBalances: fatBal(pack.executorService, pack.tickers, 1_000_000n),
  })
  const { port, calls } = spyPort(inner)
  const stranger = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), {
    ...baseBatch(pack, 1n),
    callerService: "intruder",
  })
  expect(stranger.degraded).toBe(1n)
  expect(stranger.code).toBe(codes.API_UNAUTHORIZED)
  expect(calls.filter((c) => c.op === "deposit").length).toBe(0)

  const failing: AssetPort = {
    ...inner,
    prizeTreasury: {
      ...inner.prizeTreasury,
      async deposit() {
        return { ok: false, code: codes.SERVICE_DEGRADED }
      },
    },
  }
  const failSpy = spyPort(failing)
  const failed = await runStockConveyor(pack, failSpy.port, emptyConveyorState(pack.tickers), baseBatch(pack, 1n))
  expect(failed.degraded).toBe(1n)
  expect(failed.code).toBe(codes.SERVICE_DEGRADED)
  expect(failed.month.fundWei).toBe(0n)
  expect(failed.month.prizeWei).toBe(9_000n)

  const first = pack.tickers[0]
  expect(first !== undefined).toBe(true)
  if (first === undefined) return
  const live = spyPort(inner)
  const deposited = await runStockConveyor(pack, live.port, emptyConveyorState(pack.tickers), baseBatch(pack, 1n))
  expect(deposited.degraded).toBe(0n)
  const sliced = await runStockConveyor(pack, live.port, deposited.next, {
    ...baseBatch(pack, 0n),
    fundWei: 0n,
    leaderboardWei: 0n,
    farmWei: 0n,
    slices: [
      {
        kettle: PRIZE_KETTLE_FARM,
        token: first,
        players: ["p"],
        amounts: [1n],
        callerService: pack.voucherService,
      },
    ],
    returns: [{ kettle: PRIZE_KETTLE_FARM, token: first }],
  })
  expect(sliced.calls.filter((c) => c.op === "slice").length).toBe(0)
  expect(sliced.calls.filter((c) => c.op === "returnUnsettled").length).toBe(0)
  expect(sliced.degraded).toBe(1n)

  const marked = spyPort(inner)
  const sentBack = await runStockConveyor(pack, marked.port, emptyConveyorState(pack.tickers), {
    ...baseBatch(pack, 1n),
    returns: [{ kettle: PRIZE_KETTLE_FARM, token: first, windowId: "4" }],
    farmWindows: { "4": "sent" },
  })
  expect(sentBack.calls.filter((c) => c.op === "returnUnsettled" && c.kettle === PRIZE_KETTLE_FARM).length).toBe(1)
  const held = spyPort(inner)
  const shortBack = await runStockConveyor(pack, held.port, emptyConveyorState(pack.tickers), {
    ...baseBatch(pack, 1n),
    returns: [{ kettle: PRIZE_KETTLE_FARM, token: first, windowId: "4" }],
    farmWindows: { "4": "short" },
  })
  expect(shortBack.calls.filter((c) => c.op === "returnUnsettled").length).toBe(0)

  const over = await runStockConveyor(pack, live.port, emptyConveyorState(pack.tickers), {
    ...baseBatch(pack, 0n),
    slices: [
      {
        kettle: PRIZE_KETTLE_MONTH,
        token: first,
        players: ["p"],
        amounts: [10n ** 18n],
        callerService: pack.voucherService,
      },
    ],
  })
  expect(over.degraded).toBe(1n)
  expect(over.calls.filter((c) => c.op === "slice").length).toBe(1)
}

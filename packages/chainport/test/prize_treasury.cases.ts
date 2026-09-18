import { expect } from "vitest"
import { codes } from "@corporator/protocol"
import {
  createMockPort,
  createRpcPort,
  kettleOk,
  PRIZE_KETTLE_FARM,
  PRIZE_KETTLE_MONTH,
  transportFromPort,
  type PortConfig,
} from "../src/index.ts"

const TICKERS = ["NVDA", "TSLA", "AMZN", "AAPL", "MSFT", "COIN"] as const

export async function assertPrizeTreasuryPort(cfg: PortConfig): Promise<void> {
  expect(kettleOk(PRIZE_KETTLE_FARM)).toBe(true)
  expect(kettleOk(PRIZE_KETTLE_MONTH)).toBe(true)
  expect(kettleOk(2n)).toBe(false)
  const bot = cfg.buybackExecutorService
  const signer = cfg.voucherSignerService
  const balances: { [account: string]: { [token: string]: bigint } } = {
    [bot]: { NVDA: 100n, TSLA: 50n },
  }
  const mock = createMockPort(cfg, {
    prizeStocks: TICKERS,
    prizeDepositor: bot,
    prizeSigner: signer,
    prizeBalances: balances,
  })
  expect(mock.prizeTreasury).toBeDefined()
  expect((await mock.prizeTreasury.deposit("intruder", "NVDA", PRIZE_KETTLE_FARM, 10n)).ok).toBe(false)
  expect((await mock.prizeTreasury.deposit(bot, "CORP", PRIZE_KETTLE_FARM, 10n)).ok).toBe(false)
  expect((await mock.prizeTreasury.deposit(bot, "NVDA", 2n, 10n)).ok).toBe(false)
  expect((await mock.prizeTreasury.deposit(bot, "NVDA", PRIZE_KETTLE_FARM, 10n)).ok).toBe(true)
  expect((await mock.prizeTreasury.deposit(bot, "NVDA", PRIZE_KETTLE_MONTH, 10n)).ok).toBe(true)
  const overSlice = await mock.prizeTreasury.slice(signer, "NVDA", PRIZE_KETTLE_FARM, ["player"], [11n])
  expect(overSlice.ok).toBe(false)
  expect((await mock.prizeTreasury.slice("intruder", "NVDA", PRIZE_KETTLE_FARM, ["player"], [1n])).ok).toBe(false)
  expect((await mock.prizeTreasury.slice(signer, "NVDA", PRIZE_KETTLE_FARM, ["player"], [4n])).ok).toBe(true)
  const afterSlice = await mock.prizeTreasury.returnUnsettled(bot, "NVDA", PRIZE_KETTLE_FARM)
  expect(afterSlice.ok).toBe(true)
  expect((await mock.prizeTreasury.claimPrize("player", "NVDA", PRIZE_KETTLE_FARM)).ok).toBe(true)
  expect((await mock.prizeTreasury.claimPrize("player", "NVDA", PRIZE_KETTLE_FARM)).ok).toBe(false)
  expect((await mock.prizeTreasury.claimPrize("player", "NVDA", PRIZE_KETTLE_MONTH)).ok).toBe(false)
  expect((await mock.prizeTreasury.returnUnsettled("intruder", "NVDA", PRIZE_KETTLE_MONTH)).ok).toBe(false)
  expect((await mock.prizeTreasury.returnUnsettled(bot, "NVDA", PRIZE_KETTLE_MONTH)).ok).toBe(true)
}

export async function assertPrizeTreasuryRpcParity(cfg: PortConfig): Promise<void> {
  const bot = cfg.buybackExecutorService
  const signer = cfg.voucherSignerService
  const seed = {
    prizeStocks: TICKERS as readonly string[],
    prizeDepositor: bot,
    prizeSigner: signer,
    prizeBalances: { [bot]: { NVDA: 20n } },
  }
  const mock = createMockPort(cfg, seed)
  const inner = createMockPort(cfg, seed)
  const rpc = createRpcPort(cfg, transportFromPort(inner, "1"))
  expect((await mock.prizeTreasury.deposit(bot, "NVDA", PRIZE_KETTLE_MONTH, 5n)).ok).toBe(true)
  expect((await rpc.prizeTreasury.deposit(bot, "NVDA", PRIZE_KETTLE_MONTH, 5n)).ok).toBe(true)
  expect((await mock.prizeTreasury.slice(signer, "NVDA", PRIZE_KETTLE_MONTH, ["p"], [2n])).ok).toBe(true)
  expect((await rpc.prizeTreasury.slice(signer, "NVDA", PRIZE_KETTLE_MONTH, ["p"], [2n])).ok).toBe(true)
  expect((await mock.prizeTreasury.returnUnsettled(bot, "NVDA", PRIZE_KETTLE_MONTH)).ok).toBe(true)
  expect((await rpc.prizeTreasury.returnUnsettled(bot, "NVDA", PRIZE_KETTLE_MONTH)).ok).toBe(true)
  expect((await mock.prizeTreasury.claimPrize("p", "NVDA", PRIZE_KETTLE_MONTH)).ok).toBe(true)
  expect((await rpc.prizeTreasury.claimPrize("p", "NVDA", PRIZE_KETTLE_MONTH)).ok).toBe(true)
}

export async function assertPrizeTreasurySilence(cfg: PortConfig): Promise<void> {
  const silent = createRpcPort(cfg)
  const dep = await silent.prizeTreasury.deposit("buyback", "NVDA", 0n, 1n)
  expect(dep.ok).toBe(false)
  if (!dep.ok) expect(dep.code).toBe(codes.SERVICE_DEGRADED)
  const sliced = await silent.prizeTreasury.slice("api", "NVDA", 0n, ["p"], [1n])
  expect(sliced.ok).toBe(false)
  if (!sliced.ok) expect(sliced.code).toBe(codes.SERVICE_DEGRADED)
}

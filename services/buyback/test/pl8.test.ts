import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { canonical, type Json } from "@corporator/contentpack"
import { PRIZE_KETTLE_MONTH, createMockPort, type AssetPort, type PortConfig } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import {
  createConveyorSubmit,
  createMockConveyorSource,
  emptyConveyorState,
  liveRpcReady,
  loadBuybackPack,
  runStockConveyor,
  type BuybackPack,
  type ConveyorBatch,
} from "../src/index.ts"
import { hopToken } from "../src/collect.ts"
import { atPath, loadPack } from "@corporator/contentpack"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function cfgOf(bytes: Uint8Array, pack: BuybackPack): PortConfig {
  return {
    voucherTtlS: 1n,
    voucherSignerService: pack.voucherService,
    buybackExecutorService: pack.executorService,
  }
}

function depths(pack: BuybackPack): { [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const ticker of pack.tickers) out[ticker] = pack.depthTenWei
  return out
}

function demand(pack: BuybackPack, ticker: string): { [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const name of pack.tickers) out[name] = name === ticker ? 1n : 0n
  return out
}

function batch(pack: BuybackPack, ticker: string, farmWei: bigint, fill: bigint | undefined): ConveyorBatch {
  return {
    cityTime: pack.cadence,
    fundWei: 0n,
    leaderboardWei: 0n,
    farmWei,
    depthsWei: depths(pack),
    fragmentDemand: demand(pack, ticker),
    hopOk: 1n,
    callerService: pack.executorService,
    ...(fill === undefined ? {} : { farmFills: { [ticker]: fill } }),
  }
}

function silentDeposit(inner: AssetPort): AssetPort {
  return {
    ...inner,
    prizeTreasury: {
      ...inner.prizeTreasury,
      async deposit() {
        return { ok: false, code: codes.SERVICE_DEGRADED }
      },
    },
  }
}

describe("PL8 buyback deposit", () => {
  it("a silent deposit does not feed the same wei back into planFarmHops", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const ticker = pack.tickers[0]
    expect(ticker !== undefined).toBe(true)
    if (ticker === undefined) return
    const port = silentDeposit(
      createMockPort(cfgOf(bytes, pack), {
        prizeStocks: pack.tickers,
        prizeDepositor: pack.executorService,
        prizeSigner: pack.voucherService,
      }),
    )
    const first = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), batch(pack, ticker, 1000n, 5n))
    expect(first.degraded).toBe(1n)
    const second = await runStockConveyor(pack, port, first.next, batch(pack, ticker, 0n, 5n))
    let send = 0n
    for (const hop of second.farmHops) {
      if (hop.ticker === ticker) send += hop.sendWei
    }
    expect(send).toBe(0n)
    expect(second.calls.some((call) => call.op === "deposit")).toBe(true)
  })

  it("fillOf without a ticker key deposits nothing", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const ticker = pack.tickers[0]
    expect(ticker !== undefined).toBe(true)
    if (ticker === undefined) return
    const port = createMockPort(cfgOf(bytes, pack), {
      prizeStocks: pack.tickers,
      prizeDepositor: pack.executorService,
      prizeSigner: pack.voucherService,
      prizeBalances: { [pack.executorService]: { [ticker]: 1_000_000n } },
    })
    const out = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), batch(pack, ticker, 1000n, undefined))
    expect(out.calls.filter((call) => call.op === "deposit").length).toBe(0)
    const bag = await port.prizeTreasury.unsliced(0n, ticker)
    expect(bag.ok && bag.amount).toBe(0n)
  })

  it("a full batch without the frame key does not slice", async () => {
    const previous = process.env.CORPORATOR_BUYBACK_FRAME_KEY
    delete process.env.CORPORATOR_BUYBACK_FRAME_KEY
    try {
      const bytes = packBytes()
      const pack = loadBuybackPack(bytes)
      const ticker = pack.tickers[0]
      expect(ticker !== undefined).toBe(true)
      if (ticker === undefined) return
      const port = createMockPort(cfgOf(bytes, pack), {
        prizeStocks: pack.tickers,
        prizeDepositor: pack.executorService,
        prizeSigner: pack.voucherService,
        prizeBalances: { [pack.executorService]: { [ticker]: 1_000_000n } },
      })
      let sliced = 0
      const wrapped: AssetPort = {
        ...port,
        prizeTreasury: {
          ...port.prizeTreasury,
          async slice(caller, batchId, token, kettle, players, amounts) {
            sliced += 1
            return port.prizeTreasury.slice(caller, batchId, token, kettle, players, amounts)
          },
        },
      }
      const body: { [key: string]: Json } = {
        city_time: pack.cadence,
        fund_wei: 0n,
        leaderboard_wei: 0n,
        farm_wei: 0n,
        depths_wei: {},
        fragment_demand: {},
        hop_ok: 1n,
        caller_service: pack.voucherService,
        slices: [
          {
            batch_id: "0xabc",
            kettle: PRIZE_KETTLE_MONTH,
            token: ticker,
            players: ["0x" + "ab".repeat(20)],
            amounts: [1n],
            caller_service: pack.voucherService,
          },
        ],
      }
      const handler = createConveyorSubmit(pack, wrapped, createMockConveyorSource())
      const row = JSON.parse(new TextDecoder().decode(await handler(canonical(body)))) as { code?: string }
      expect(row.code).toBe(codes.SERVICE_DEGRADED)
      expect(sliced).toBe(0)
      expect(loadPack(bytes).hash.length).toBe(64)
      expect(atPath(loadPack(bytes).pack, ["sections", "meta", "pack_version"])).toBeTypeOf("bigint")
    } finally {
      if (previous === undefined) delete process.env.CORPORATOR_BUYBACK_FRAME_KEY
      else process.env.CORPORATOR_BUYBACK_FRAME_KEY = previous
    }
  })

  it("liveRpcReady rejects a garbage executor address", () => {
    const env = {
      CORPORATOR_RPC_URL: "http://127.0.0.1:9",
      CORPORATOR_CHAIN_ID: "1",
      CORPORATOR_RPC_TIMEOUT_MS: "1",
      CORPORATOR_CORP_TOKEN: "0x" + "11".repeat(20),
      CORPORATOR_VAULT: "0x" + "22".repeat(20),
      CORPORATOR_STAKE_REGISTRY: "0x" + "33".repeat(20),
      CORPORATOR_MERKLE_ROOTS: "0x" + "44".repeat(20),
      CORPORATOR_PRIZE_TREASURY: "0x" + "55".repeat(20),
      CORPORATOR_BUYBACK_EXECUTOR: "0x" + "66".repeat(20),
      CORPORATOR_SIGNER: "0x" + "77".repeat(20),
    }
    expect(liveRpcReady(env)).toBe(true)
    expect(liveRpcReady({ ...env, CORPORATOR_BUYBACK_EXECUTOR: "not-an-address" })).toBe(false)
  })

  it("fund CORP is deposited to the house and is not minted on the vault", async () => {
    const corp = "0x" + "ab".repeat(20)
    const nvda = "0x" + "cd".repeat(20)
    expect(hopToken({ CORPORATOR_CORP_TOKEN: corp, CORPORATOR_STOCK_NVDA: nvda }, "CORP")).toBe(corp)
    expect(hopToken({ CORPORATOR_CORP_TOKEN: corp, CORPORATOR_STOCK_NVDA: nvda }, "NVDA")).toBe(nvda)
    expect(hopToken({ CORPORATOR_CORP_TOKEN: "not-an-address" }, "CORP")).toBe("")
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const ticker = pack.tickers[0]
    expect(ticker !== undefined).toBe(true)
    if (ticker === undefined) return
    const house = "0x" + "44".repeat(20)
    const previous = process.env.CORPORATOR_VAULT_HOUSE
    process.env.CORPORATOR_VAULT_HOUSE = house
    let deposited: readonly [string, bigint] | undefined
    let minted = 0
    const inner = createMockPort(cfgOf(bytes, pack), {
      corp: { [house]: 9n },
      prizeStocks: pack.tickers,
      prizeDepositor: pack.executorService,
      prizeSigner: pack.voucherService,
    })
    const port: AssetPort = {
      ...inner,
      vault: {
        ...inner.vault,
        async deposit(account, amount) {
          deposited = [account, amount]
          return inner.vault.deposit(account, amount)
        },
        async mintCapital() {
          minted += 1
          return { ok: false, code: codes.SERVICE_DEGRADED }
        },
      },
    }
    try {
      const out = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), {
        ...batch(pack, ticker, 0n, undefined),
        hopOk: 0n,
        fundCorpOut: 9n,
      })
      expect(out.degraded).toBe(0n)
      expect(deposited).toEqual([house, 9n])
      expect(minted).toBe(0)
    } finally {
      if (previous === undefined) delete process.env.CORPORATOR_VAULT_HOUSE
      else process.env.CORPORATOR_VAULT_HOUSE = previous
    }
  })
})

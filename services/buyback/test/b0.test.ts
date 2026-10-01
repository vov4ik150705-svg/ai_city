import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, canonical, fromUtf8, loadPack, parseJson, utf8, type Json } from "@corporator/contentpack"
import {
  PRIZE_KETTLE_FARM,
  PRIZE_KETTLE_MONTH,
  createMockPort,
  type AssetPort,
  type PortConfig,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import {
  createBuybackPort,
  createCannedConveyorSource,
  createConveyorSubmit,
  createDefaultConveyorSubmit,
  createMockConveyorSource,
  loadBuybackPack,
  type BuybackPack,
  type ConveyorBatch,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const fill = 7n

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

function portConfig(bytes: Uint8Array, pack: BuybackPack): PortConfig {
  return {
    voucherTtlS: asBig(atPath(loadPack(bytes).pack, ["generated", "api", "voucher_ttl_s"])),
    voucherSignerService: pack.voucherService,
    buybackExecutorService: pack.executorService,
  }
}

function firstTicker(pack: BuybackPack): string {
  const ticker = pack.tickers[0]
  if (ticker === undefined) throw new Error(codes.API_MALFORMED)
  return ticker
}

function depthMap(pack: BuybackPack): { readonly [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const ticker of pack.tickers) out[ticker] = pack.depthTenWei
  return out
}

function demandMap(pack: BuybackPack, ticker: string, demand: bigint): { readonly [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const name of pack.tickers) out[name] = name === ticker ? demand : 0n
  return out
}

function cannedBatch(pack: BuybackPack, ticker: string, hopOk: bigint, caller: string): ConveyorBatch {
  return {
    cityTime: pack.cadence,
    fundWei: 0n,
    leaderboardWei: 0n,
    farmWei: fill,
    depthsWei: depthMap(pack),
    fragmentDemand: demandMap(pack, ticker, 1n),
    hopOk,
    callerService: caller,
    farmFills: { [ticker]: fill },
  }
}

function jsonMap(row: { readonly [key: string]: bigint }): { [key: string]: Json } {
  const out: { [key: string]: Json } = {}
  for (const key of Object.keys(row)) {
    const value = row[key]
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

function batchBody(batch: ConveyorBatch): Uint8Array {
  const body: { [key: string]: Json } = {
    city_time: batch.cityTime,
    fund_wei: batch.fundWei,
    leaderboard_wei: batch.leaderboardWei,
    farm_wei: batch.farmWei,
    depths_wei: jsonMap(batch.depthsWei),
    fragment_demand: jsonMap(batch.fragmentDemand),
    hop_ok: batch.hopOk,
    caller_service: batch.callerService,
  }
  const fills = batch.farmFills
  if (fills !== undefined) body["farm_fills"] = jsonMap(fills)
  return canonical(body)
}

function reply(raw: Uint8Array): { readonly [key: string]: Json } {
  return asObj(parseJson(fromUtf8(raw)))
}

function prizePort(bytes: Uint8Array, pack: BuybackPack, stock: bigint | undefined): AssetPort {
  const ticker = firstTicker(pack)
  const seed = {
    prizeStocks: pack.tickers,
    prizeDepositor: pack.executorService,
    prizeSigner: pack.voucherService,
  }
  if (stock === undefined) return createMockPort(portConfig(bytes, pack), seed)
  return createMockPort(portConfig(bytes, pack), {
    ...seed,
    prizeBalances: { [pack.executorService]: { [ticker]: stock } },
  })
}

async function farmUnsliced(port: AssetPort, pack: BuybackPack, ticker: string): Promise<bigint> {
  let sum = 0n
  for (const name of pack.tickers) {
    const farm = await port.prizeTreasury.unsliced(PRIZE_KETTLE_FARM, name)
    const month = await port.prizeTreasury.unsliced(PRIZE_KETTLE_MONTH, name)
    if (!farm.ok || !month.ok) throw new Error(codes.SERVICE_DEGRADED)
    expect(month.amount).toBe(0n)
    if (name !== ticker) expect(farm.amount).toBe(0n)
    else sum = farm.amount
  }
  return sum
}

describe("B0 buyback hole", () => {
  it("empty and non-batch bodies degrade and deposit nothing", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const ticker = firstTicker(pack)
    const handler = createDefaultConveyorSubmit(bytes, pack)
    for (const body of [new Uint8Array(), utf8("not-json")]) {
      const row = reply(await handler(body))
      expect(asBig(row["ok"])).toBe(0n)
      expect(asText(row["code"])).toBe(codes.SERVICE_DEGRADED)
      expect(asBig(row["degraded"])).toBe(1n)
      expect(row["calls"]).toBe(undefined)
    }
    const port = prizePort(bytes, pack, fill)
    expect(await farmUnsliced(port, pack, ticker)).toBe(0n)
    const twin = createConveyorSubmit(pack, port, createMockConveyorSource())
    const pulled = reply(await twin(new Uint8Array()))
    expect(asText(pulled["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(await farmUnsliced(port, pack, ticker)).toBe(0n)
  })

  it("a canned batch on the funded submit path increases farm unsliced", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const ticker = firstTicker(pack)
    const batch = cannedBatch(pack, ticker, 1n, pack.executorService)
    const pulled = await createCannedConveyorSource(batch).pull()
    expect(pulled.ok).toBe(true)
    if (!pulled.ok) return
    expect(pulled.batch.hopOk).toBe(1n)
    expect(pulled.batch.callerService).toBe(pack.executorService)
    expect(pulled.batch.farmFills?.[ticker]).toBe(fill)
    const port = prizePort(bytes, pack, fill)
    const handler = createConveyorSubmit(pack, port, createMockConveyorSource())
    const row = reply(await handler(batchBody(pulled.batch)))
    expect(asBig(row["ok"])).toBe(1n)
    expect(asBig(row["degraded"])).toBe(0n)
    expect(asBig(row["calls"])).toBe(1n)
    expect(await farmUnsliced(port, pack, ticker)).toBe(fill)
  })

  it("the default submit accepts that batch but the unfunded mock does not deposit", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const ticker = firstTicker(pack)
    expect(createBuybackPort(bytes, pack).kind).toBe("mock")
    const batch = cannedBatch(pack, ticker, 1n, pack.executorService)
    const row = reply(await createDefaultConveyorSubmit(bytes, pack)(batchBody(batch)))
    expect(asBig(row["ok"])).toBe(0n)
    expect(asText(row["code"])).toBe(codes.API_MALFORMED)
    expect(asBig(row["degraded"])).toBe(1n)
    expect(asBig(row["calls"])).toBe(1n)
    const bare = prizePort(bytes, pack, undefined)
    const again = reply(await createConveyorSubmit(pack, bare, createMockConveyorSource())(batchBody(batch)))
    expect(asText(again["code"])).toBe(codes.API_MALFORMED)
    expect(await farmUnsliced(bare, pack, ticker)).toBe(0n)
  })

  it("hopOk 0 and a foreign caller leave unsliced at zero", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const ticker = firstTicker(pack)
    const port = prizePort(bytes, pack, fill)
    const handler = createConveyorSubmit(pack, port, createMockConveyorSource())
    const quiet = cannedBatch(pack, ticker, 0n, pack.executorService)
    const quietRow = reply(await handler(batchBody(quiet)))
    expect(asBig(quietRow["calls"])).toBe(0n)
    expect(await farmUnsliced(port, pack, ticker)).toBe(0n)
    const foreign = cannedBatch(pack, ticker, 1n, "intruder")
    const foreignRow = reply(await handler(batchBody(foreign)))
    expect(asBig(foreignRow["ok"])).toBe(0n)
    expect(asText(foreignRow["code"])).toBe(codes.API_UNAUTHORIZED)
    expect(await farmUnsliced(port, pack, ticker)).toBe(0n)
    const idlePort = prizePort(bytes, pack, fill)
    const idle = createConveyorSubmit(pack, idlePort, createMockConveyorSource())
    const idleBatch = {
      ...cannedBatch(pack, ticker, 1n, pack.executorService),
      fragmentDemand: demandMap(pack, ticker, 0n),
    }
    const idleRow = reply(await idle(batchBody(idleBatch)))
    expect(asBig(idleRow["ok"])).toBe(1n)
    expect(asBig(idleRow["calls"])).toBe(0n)
    expect(await farmUnsliced(idlePort, pack, ticker)).toBe(0n)
  })
})

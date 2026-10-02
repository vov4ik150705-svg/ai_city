import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { keccak256Hex } from "@corporator/engine"
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
  createCollectorSource,
  createConveyorSubmit,
  createDefaultConveyorSubmit,
  emptyConveyorState,
  executorHopFill,
  loadBuybackPack,
  planFarmHops,
  runStockConveyor,
  selectConveyorSource,
  type BuybackPack,
  type CollectorHop,
  type ConveyorBatch,
  type HopLog,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const ticker = "NVDA"
const logged = 7n
const farmWei = 1000n
const executor = "0x" + "ab".repeat(20)
const other = "0x" + "cd".repeat(20)
const token = "0x" + "ef".repeat(20)
const executorKey = "0x" + "11".repeat(32)
const player = "0x" + "12".repeat(20)
const hopTo = "0x" + "33".repeat(20)
const hopData = "0x" + "44".repeat(4)

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

function assertMockEnv(): void {
  const url = process.env.CORPORATOR_RPC_URL
  if (url !== undefined && url.length > 0) throw new Error("B3 requires CORPORATOR_RPC_URL unset")
}

function portConfig(bytes: Uint8Array, pack: BuybackPack): PortConfig {
  return {
    voucherTtlS: asBig(atPath(loadPack(bytes).pack, ["generated", "api", "voucher_ttl_s"])),
    voucherSignerService: pack.voucherService,
    buybackExecutorService: pack.executorService,
  }
}

function funded(bytes: Uint8Array, pack: BuybackPack, stock: bigint): AssetPort {
  return createMockPort(portConfig(bytes, pack), {
    prizeStocks: pack.tickers,
    prizeDepositor: pack.executorService,
    prizeSigner: pack.voucherService,
    prizeBalances: { [pack.executorService]: { [ticker]: stock } },
  })
}

function reply(raw: Uint8Array): { readonly [key: string]: Json } {
  return asObj(parseJson(fromUtf8(raw)))
}

function zeros(pack: BuybackPack): { readonly [key: string]: bigint } {
  const out: { [key: string]: bigint } = {}
  for (const name of pack.tickers) out[name] = 0n
  return out
}

function depthsOf(pack: BuybackPack): { readonly [key: string]: bigint } {
  const out: { [key: string]: bigint } = {}
  for (const name of pack.tickers) out[name] = pack.depthTenWei
  return out
}

function demandOf(pack: BuybackPack, nvda: bigint): { readonly [key: string]: bigint } {
  const out: { [key: string]: bigint } = {}
  for (const name of pack.tickers) out[name] = name === ticker ? nvda : 0n
  return out
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

function frame(
  pack: BuybackPack,
  turnover: bigint,
  nvdaDemand: bigint,
  farm: bigint,
  slices?: readonly Json[],
  leaderboard = 0n,
): Uint8Array {
  const body: { [key: string]: Json } = {
    city_time: pack.cadence,
    turnover_wei: turnover,
    fund_wei: 0n,
    leaderboard_wei: leaderboard,
    farm_wei: farm,
    depths_wei: jsonMap(depthsOf(pack)),
    fragment_demand: jsonMap(demandOf(pack, nvdaDemand)),
  }
  if (slices !== undefined) body["slices"] = slices
  return canonical(body)
}

function fullBatch(pack: BuybackPack): Uint8Array {
  return canonical({
    city_time: pack.cadence,
    fund_wei: 0n,
    leaderboard_wei: 0n,
    farm_wei: 0n,
    depths_wei: jsonMap(depthsOf(pack)),
    fragment_demand: jsonMap(zeros(pack)),
    hop_ok: 0n,
    caller_service: pack.executorService,
  })
}

function transferTopic(): string {
  return "0x" + keccak256Hex(new TextEncoder().encode("Transfer(address,address,uint256)"))
}

function word(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr
  return "0x" + hex.padStart(64, "0")
}

function logOf(to: string, amount: bigint): HopLog {
  return {
    address: token,
    topics: [transferTopic(), word(other), word(to)],
    data: "0x" + amount.toString(16).padStart(64, "0"),
  }
}

function quote(): { readonly ok: true; readonly body: { readonly [key: string]: string } } {
  return { ok: true, body: { stock_out: farmWei.toString(), to: hopTo, data: hopData, value: "0" } }
}

function hopSpy(logs: readonly HopLog[], accept = true): { readonly hop: CollectorHop; readonly calls: { ticker: string; wei: bigint }[] } {
  const calls: { ticker: string; wei: bigint }[] = []
  const hop: CollectorHop = async (name, wei) => {
    calls.push({ ticker: name, wei })
    return executorHopFill({
      poster: async () => quote(),
      ticker: name,
      amount: wei,
      hopQuality: 0n,
      executor,
      executorKey,
      token,
      logs,
      sign: (key) => accept && key === executorKey,
    })
  }
  return { hop, calls }
}

function throwingHop(): { readonly hop: CollectorHop; readonly calls: number } {
  const box = { calls: 0 }
  const hop: CollectorHop = async () => {
    box.calls += 1
    throw new Error("hop down")
  }
  return { hop, get calls() { return box.calls } }
}

function plannedSend(pack: BuybackPack): bigint {
  const plan = planFarmHops(pack, zeros(pack), farmWei, demandOf(pack, 1n), depthsOf(pack), 1n)
  for (const hop of plan.hops) {
    if (hop.ticker === ticker) return hop.sendWei
  }
  return 0n
}

async function bags(port: AssetPort, pack: BuybackPack): Promise<{ readonly farm: bigint; readonly month: bigint }> {
  let farm = 0n
  let month = 0n
  for (const name of pack.tickers) {
    const f = await port.prizeTreasury.unsliced(PRIZE_KETTLE_FARM, name)
    const m = await port.prizeTreasury.unsliced(PRIZE_KETTLE_MONTH, name)
    if (!f.ok || !m.ok) throw new Error(codes.SERVICE_DEGRADED)
    if (name === ticker) {
      farm = f.amount
      month = m.amount
    } else {
      expect(f.amount).toBe(0n)
      expect(m.amount).toBe(0n)
    }
  }
  return { farm, month }
}

function liveEnv(hopUrl: string | undefined): { readonly [key: string]: string } {
  const env: { [key: string]: string } = {
    CORPORATOR_RPC_URL: "http://127.0.0.1:9",
    CORPORATOR_CHAIN_ID: "1",
    CORPORATOR_RPC_TIMEOUT_MS: "1",
    CORPORATOR_CORP_TOKEN: "0x" + "a1".repeat(20),
    CORPORATOR_VAULT: "0x" + "a2".repeat(20),
    CORPORATOR_STAKE_REGISTRY: "0x" + "a3".repeat(20),
    CORPORATOR_MERKLE_ROOTS: "0x" + "a4".repeat(20),
    CORPORATOR_PRIZE_TREASURY: "0x" + "a5".repeat(20),
    CORPORATOR_BUYBACK_EXECUTOR: executor,
    CORPORATOR_SIGNER: "0x" + "a6".repeat(20),
  }
  if (hopUrl !== undefined) env["CORPORATOR_HOP_URL"] = hopUrl
  return env
}

describe("B3 collector", () => {
  it("deposits the Transfer log into farm and nothing more", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    expect(pack.tickers.includes(ticker)).toBe(true)
    expect(pack.minBatchWei > 1n).toBe(true)
    const send = plannedSend(pack)
    expect(send > logged).toBe(true)
    const { hop, calls } = hopSpy([logOf(executor, logged)])
    const port = funded(bytes, pack, send)
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const row = reply(await handler(frame(pack, pack.minBatchWei + 1n, 1n, farmWei)))
    expect(asBig(row["ok"])).toBe(1n)
    expect(asBig(row["degraded"])).toBe(0n)
    expect(calls.length).toBe(1)
    expect(calls[0]?.ticker).toBe(ticker)
    expect(calls[0]?.wei).toBe(send)
    const bag = await bags(port, pack)
    expect(bag.farm).toBe(logged)
    expect(bag.month).toBe(0n)
  })

  it("hops at the minimum and not one wei below it", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const { hop } = hopSpy([logOf(executor, logged)])
    const port = funded(bytes, pack, plannedSend(pack))
    const atMin = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const row = reply(await atMin(frame(pack, pack.minBatchWei, 1n, farmWei)))
    expect(asBig(row["ok"])).toBe(1n)
    expect((await bags(port, pack)).farm).toBe(logged)
    const dust = hopSpy([logOf(executor, logged)])
    const idle = funded(bytes, pack, plannedSend(pack))
    const below = createConveyorSubmit(pack, idle, createCollectorSource(pack, { hop: dust.hop }))
    const skipped = reply(await below(frame(pack, pack.minBatchWei - 1n, 1n, farmWei)))
    expect(dust.calls.length).toBe(0)
    expect(asBig(skipped["calls"])).toBe(0n)
    expect((await bags(idle, pack)).farm).toBe(0n)
  })

  it("leaves farm wei unspent when every ticker demand is zero", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const { hop, calls } = hopSpy([logOf(executor, logged)])
    const source = createCollectorSource(pack, { hop })
    const pulled = await source.pull(frame(pack, pack.minBatchWei + 1n, 0n, farmWei))
    expect(pulled.ok).toBe(true)
    if (!pulled.ok) return
    const port = funded(bytes, pack, farmWei)
    const out = await runStockConveyor(pack, port, emptyConveyorState(pack.tickers), pulled.batch)
    expect(calls.length).toBe(0)
    expect(out.calls.length).toBe(0)
    expect(out.next.farmRemainderWei).toBe(farmWei)
    for (const name of pack.tickers) expect(out.next.farmCarry[name] ?? 0n).toBe(0n)
    expect((await bags(port, pack)).farm).toBe(0n)
  })

  it("does not deposit a Transfer that missed the executor", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const { hop, calls } = hopSpy([logOf(other, logged)])
    const port = funded(bytes, pack, plannedSend(pack))
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const row = reply(await handler(frame(pack, pack.minBatchWei + 1n, 1n, farmWei)))
    expect(calls.length).toBe(1)
    expect(asText(row["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(row["calls"]).toBe(undefined)
    expect((await bags(port, pack)).farm).toBe(0n)
  })

  it("does not deposit a quote that has no Transfer log", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const { hop, calls } = hopSpy([])
    const port = funded(bytes, pack, plannedSend(pack))
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const row = reply(await handler(frame(pack, pack.minBatchWei + 1n, 1n, farmWei)))
    expect(calls.length).toBe(1)
    expect(asBig(row["ok"])).toBe(0n)
    expect(asText(row["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(row["calls"]).toBe(undefined)
    expect((await bags(port, pack)).farm).toBe(0n)
  })

  it("degrades when the hop throws and writes no batch", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const boom = throwingHop()
    const port = funded(bytes, pack, plannedSend(pack))
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop: boom.hop }))
    const row = reply(await handler(frame(pack, pack.minBatchWei + 1n, 1n, farmWei)))
    expect(boom.calls).toBe(1)
    expect(asText(row["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(row["calls"]).toBe(undefined)
    expect((await bags(port, pack)).farm).toBe(0n)
  })

  it("rejects a farm kettle slice and leaves owed at zero", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const { hop } = hopSpy([logOf(executor, logged)])
    const port = funded(bytes, pack, plannedSend(pack))
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const row = reply(
      await handler(
        frame(pack, pack.minBatchWei + 1n, 1n, farmWei, [
          {
            batch_id: "b3",
            kettle: 0n,
            token: ticker,
            players: [player],
            amounts: [1n],
            caller_service: pack.voucherService,
          },
        ]),
      ),
    )
    expect(asBig(row["ok"])).toBe(0n)
    expect(asText(row["code"])).toBe(codes.API_MALFORMED)
    const owed = await port.prizeTreasury.owed(PRIZE_KETTLE_FARM, ticker, player)
    expect(owed.ok).toBe(true)
    if (owed.ok) expect(owed.amount).toBe(0n)
    expect((await bags(port, pack)).farm).toBe(logged)
  })

  it("keeps the default submit on the mock and ignores a full batch in the source", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const { hop, calls } = hopSpy([logOf(executor, logged)])
    const def = createDefaultConveyorSubmit(bytes, pack)
    for (const body of [new Uint8Array(), utf8("not-json"), frame(pack, pack.minBatchWei + 1n, 1n, farmWei)]) {
      const row = reply(await def(body))
      expect(asBig(row["ok"])).toBe(0n)
      expect(asText(row["code"])).toBe(codes.SERVICE_DEGRADED)
      expect(row["calls"]).toBe(undefined)
    }
    const port = funded(bytes, pack, plannedSend(pack))
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const row = reply(await handler(fullBatch(pack)))
    expect(calls.length).toBe(0)
    expect(asText(row["code"])).toBe(codes.SERVICE_DEGRADED)
    expect((await bags(port, pack)).farm).toBe(0n)
    const empty = reply(await handler(new Uint8Array()))
    expect(asText(empty["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(empty["calls"]).toBe(undefined)
  })

  it("selects the collector only when RPC env and the hop url are set", async () => {
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const body = frame(pack, pack.minBatchWei + 1n, 1n, farmWei)
    const off = hopSpy([logOf(executor, logged)])
    const mock = selectConveyorSource({ CORPORATOR_HOP_URL: "http://127.0.0.1:9" }, pack, { hop: off.hop })
    const missed = await mock.pull(body)
    expect(missed.ok).toBe(false)
    expect(off.calls.length).toBe(0)
    const noHop = hopSpy([logOf(executor, logged)])
    const rpcOnly = selectConveyorSource(liveEnv(undefined), pack, { hop: noHop.hop })
    expect((await rpcOnly.pull(body)).ok).toBe(false)
    expect(noHop.calls.length).toBe(0)
    const on = hopSpy([logOf(executor, logged)])
    const live = selectConveyorSource(liveEnv("http://127.0.0.1:9"), pack, { hop: on.hop })
    const hit = await live.pull(body)
    expect(hit.ok).toBe(true)
    expect(on.calls.length).toBe(1)
    if (hit.ok) {
      const fills: ConveyorBatch["farmFills"] = hit.batch.farmFills
      expect(fills?.[ticker]).toBe(logged)
      expect(hit.batch.tokenByTicker).toBe(undefined)
      expect(hit.batch.callerService).toBe(pack.executorService)
    }
  })

  it("adds a sub-min farm wei onto the next hop", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const dust = 5000n
    const next = 1000n
    const { hop, calls } = hopSpy([logOf(executor, logged)])
    const port = funded(bytes, pack, dust + next)
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const quiet = reply(await handler(frame(pack, pack.minBatchWei - 1n, 1n, dust)))
    expect(calls.length).toBe(0)
    expect(asBig(quiet["calls"])).toBe(0n)
    const row = reply(await handler(frame(pack, pack.minBatchWei + 1n, 1n, next)))
    expect(asBig(row["ok"])).toBe(1n)
    const sent = calls.reduce((sum, call) => sum + call.wei, 0n)
    expect(sent).toBe(dust + next)
    expect((await bags(port, pack)).farm).toBe(logged)
  })

  it("adds a zero-demand farm wei onto the next hop", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const dust = 5000n
    const next = 1000n
    const { hop, calls } = hopSpy([logOf(executor, logged)])
    const port = funded(bytes, pack, dust + next)
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const quiet = reply(await handler(frame(pack, pack.minBatchWei + 1n, 0n, dust)))
    expect(calls.length).toBe(0)
    expect(asBig(quiet["calls"])).toBe(0n)
    const row = reply(await handler(frame(pack, pack.minBatchWei + 1n, 1n, next)))
    expect(asBig(row["ok"])).toBe(1n)
    const sent = calls.reduce((sum, call) => sum + call.wei, 0n)
    expect(sent).toBe(dust + next)
  })

  it("adds a sub-min leaderboard wei onto the next month hops", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const dust = 6000n
    const next = 6000n
    const { hop, calls } = hopSpy([logOf(executor, logged)])
    const port = funded(bytes, pack, dust + next)
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    await handler(frame(pack, pack.minBatchWei - 1n, 1n, 0n, undefined, dust))
    expect(calls.length).toBe(0)
    await handler(frame(pack, pack.minBatchWei + 1n, 1n, 0n, undefined, next))
    const sent = calls.reduce((sum, call) => sum + call.wei, 0n)
    expect(sent).toBe(dust + next)
    expect(calls.length).toBe(pack.tickers.length)
  })

  it("deposits the farm fill when a later month hop misses", async () => {
    assertMockEnv()
    const bytes = packBytes()
    const pack = loadBuybackPack(bytes)
    const board = 6000n
    const calls: { ticker: string; wei: bigint }[] = []
    let n = 0
    const hop: CollectorHop = async (name, wei) => {
      n += 1
      calls.push({ ticker: name, wei })
      return executorHopFill({
        poster: async () => quote(),
        ticker: name,
        amount: wei,
        hopQuality: 0n,
        executor,
        executorKey,
        token,
        logs: n === 2 ? [] : [logOf(executor, logged)],
        sign: (key) => key === executorKey,
      })
    }
    const port = funded(bytes, pack, board)
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    const row = reply(await handler(frame(pack, pack.minBatchWei + 1n, 1n, farmWei, undefined, board)))
    expect(asBig(row["ok"])).toBe(1n)
    expect((await bags(port, pack)).farm).toBe(logged)
    const before = calls.length
    await handler(frame(pack, pack.minBatchWei + 1n, 1n, 0n))
    const retried = calls.slice(before).reduce((sum, call) => sum + call.wei, 0n)
    expect(retried).toBe(board)
  })
})

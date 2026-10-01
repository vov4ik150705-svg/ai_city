import { afterEach, describe, expect, it } from "vitest"
import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  createMockPort,
  createRpcPort,
  PRIZE_KETTLE_FARM,
  PRIZE_KETTLE_MONTH,
  transportFromPort,
  type AssetPort,
} from "@corporator/chainport"
import { assertI1, keccak256Hex, type Dict } from "@corporator/engine"
import { codes, listenPorts } from "@corporator/protocol"
import {
  createCollectorSource,
  createConveyorSubmit,
  executorHopFill,
  loadBuybackPack,
  type CollectorHop,
  type HopLog,
} from "../../buyback/src/index.ts"
import { listenReady, type ReadyListen } from "../../buyback/src/ready.ts"
import { publishBuybackFrame, useBuybackPoster } from "../src/buyback_frame.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { applyClaimPrize, prepareClaimPrize, stockAddress } from "../src/commit_prize.ts"
import { prepareClaimFragment } from "../src/commit_fragments.ts"
import { sliceFarm } from "../src/slicer.ts"
import { putBytes } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, bootHost, packBytes } from "./harness.ts"
import { walk } from "../src/values.ts"
import type { PackCtx } from "../src/pack_ctx.ts"

const stockOut = 7n
const farmOwed = 4n
const monthPayout = 3n
const wallet = "0x" + "cd".repeat(20)
const demoWallet = "0x" + "ee".repeat(20)
const executor = "0x" + "ab".repeat(20)
const executorKey = "0x" + "11".repeat(32)
const deployedKeys = ["token", "curve", "pool", "hook", "tx"] as const

afterEach(() => {
  useBuybackPoster(undefined)
})

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function bodyOf(raw: Uint8Array): { readonly [key: string]: Json } {
  return asObj(parseJson(fromUtf8(raw)))
}

function transferTopic(): string {
  return "0x" + keccak256Hex(new TextEncoder().encode("Transfer(address,address,uint256)"))
}

function word(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr
  return "0x" + hex.padStart(64, "0")
}

function logOf(token: string, amount: bigint): HopLog {
  return {
    address: token,
    topics: [transferTopic(), word(wallet), word(executor)],
    data: "0x" + amount.toString(16).padStart(64, "0"),
  }
}

function rememberEnv(names: readonly string[]): Map<string, string | undefined> {
  const prior = new Map<string, string | undefined>()
  for (const name of names) prior.set(name, process.env[name])
  return prior
}

function restoreEnv(prior: ReadonlyMap<string, string | undefined>): void {
  for (const [name, value] of prior) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

function withLaunchFilled(ctx: PackCtx): PackCtx {
  const pack = structuredClone(ctx.pack)
  const deployed = asObj(walk(pack, ["sections", "launch", "deployed"])) as { [key: string]: Json }
  let n = 1n
  for (const key of deployedKeys) {
    n += 1n
    deployed[key] = padAddr(n)
  }
  return { ...ctx, pack }
}

function prizeNames(pack: Json): string[] {
  const raw = walk(pack, ["generated", "seasons", "prize_assets"])
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

describe("B5 buyback fixture", () => {
  it("fills the farm bag from the frame, slices owed, and leaves an empty month and a dead hop alone", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const assets = prizeNames(host.ctx.pack)
    const ticker = assets[0]
    expect(ticker).toBe("NVDA")
    if (ticker === undefined) return
    const names = ["CORPORATOR_PRIZE_TREASURY"]
    for (const asset of assets) names.push("CORPORATOR_STOCK_" + asset)
    const prior = rememberEnv(names)
    const stocks = new Map<string, string>()
    const balances: { [token: string]: bigint } = {}
    let n = 20n
    process.env["CORPORATOR_PRIZE_TREASURY"] = padAddr(4n)
    for (const asset of assets) {
      const addr = padAddr(n)
      n += 1n
      process.env["CORPORATOR_STOCK_" + asset] = addr
      stocks.set(asset, addr)
      balances[addr] = 1000n
    }
    const token = stocks.get(ticker) ?? ""
    expect(token.length > 0).toBe(true)
    const pack = loadBuybackPack(packBytes())
    const portCfg = portCfgFromPack(host.ctx.pack)
    const mock = createMockPort(portCfg, {
      prizeStocks: [...stocks.values()],
      prizeDepositor: portCfg.buybackExecutorService,
      prizeSigner: portCfg.voucherSignerService,
      prizeBalances: { [portCfg.buybackExecutorService]: balances },
    })
    const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
    const rpc = createRpcPort(portCfg, transportFromPort(mock, chain))
    const port: AssetPort = { ...rpc, prizeTreasury: mock.prizeTreasury }
    let logsOn = false
    const hop: CollectorHop = async (name) => {
      const addr = stocks.get(name) ?? ""
      return executorHopFill({
        poster: async () => ({
          ok: true,
          body: { stock_out: stockOut.toString(), to: "0x" + "33".repeat(20), data: "0xabcd", value: "0" },
        }),
        ticker: name,
        amount: stockOut,
        hopQuality: 0n,
        executor,
        executorKey,
        token: addr,
        logs: logsOn ? [logOf(addr, stockOut)] : [],
        sign: (key) => key === executorKey,
      })
    }
    const handler = createConveyorSubmit(pack, port, createCollectorSource(pack, { hop }))
    let ready: ReadyListen | undefined
    const capital = asBigint(host.state["capital_outstanding"])
    const cityTime = asBigint(host.state["city_time"])
    host.state["city_time"] = cityTime
    const eth = asBigint(cfg["eth_usd_8dec"])
    const wei = asBigint(cfg["wei"])
    const min = asBigint(walk(host.ctx.pack, ["sections", "launch", "params", "buyback_min_batch_wei", "v"]))
    expect(wei > min).toBe(true)
    await putBytes(
      host.store,
      "price_samples",
      "b5:" + cityTime.toString(),
      canonical({
        city_time: cityTime,
        eth_usd_8dec: eth,
        corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
        dex_turnover_usd_8dec: eth,
      }),
      undefined,
    )
    const cities = asEngineDict(host.state["cities"])
    const city = asEngineDict(cities["a"])
    city["account_kind"] = "wallet"
    city["wallet"] = wallet
    city["fragment_owed"] = { [ticker]: farmOwed }
    cities["d"] = { id: "d", account_kind: "demo", wallet: demoWallet }
    useBuybackPoster(undefined)
    try {
      ready = await listenReady(host.ctx.hash, listenPorts.buyback, handler)
      expect(await publishBuybackFrame(host)).toBe(0n)
      expect((await port.prizeTreasury.unsliced(PRIZE_KETTLE_FARM, token)).amount).toBe(0n)
      expect((await port.prizeTreasury.unsliced(PRIZE_KETTLE_MONTH, token)).amount).toBe(0n)
      assertI1(cfg, host.state, "a")
      expect(asBigint(host.state["capital_outstanding"])).toBe(capital)
      const pending = await prepareClaimFragment(
        host.ctx,
        host.store,
        host.state,
        city,
        "a",
        "b5-pending",
        cityTime,
        port,
      )
      expect(asText(bodyOf(pending.body)["code"])).toBe(codes.FRAGMENT_SLICE_PENDING)
      const nothing = await prepareClaimPrize(
        withLaunchFilled(host.ctx),
        host.store,
        host.state,
        city,
        "a",
        "b5-nothing",
        cityTime,
        port,
      )
      expect(asText(bodyOf(nothing.body)["code"])).toBe(codes.PRIZE_NOTHING_OWED)
      const demo = await applyClaimPrize(host.ctx, host.state, asEngineDict(cities["d"]), "d")
      expect(asText(bodyOf(demo.body)["code"])).toBe(codes.DEMO_NO_PRIZE)
      assertI1(cfg, host.state, "a")
      expect(asBigint(host.state["capital_outstanding"])).toBe(capital)

      const cadence = asBigint(walk(host.ctx.pack, ["sections", "launch", "params", "buyback_cadence_city_hours", "v"]))
      host.state["city_time"] = cityTime + cadence
      logsOn = true
      expect(await publishBuybackFrame(host)).toBe(1n)
      const farmBag = await port.prizeTreasury.unsliced(PRIZE_KETTLE_FARM, token)
      const monthBag = await port.prizeTreasury.unsliced(PRIZE_KETTLE_MONTH, token)
      expect(farmBag.ok && monthBag.ok).toBe(true)
      expect(farmBag.amount).toBe(stockOut)
      expect(monthBag.amount).toBe(stockOut)
      expect((await port.prizeTreasury.owed(PRIZE_KETTLE_FARM, token, wallet)).amount).toBe(0n)
      expect((await port.prizeTreasury.owed(PRIZE_KETTLE_MONTH, token, wallet)).amount).toBe(0n)
      for (const asset of assets) {
        if (asset === ticker) continue
        const other = stocks.get(asset) ?? ""
        expect((await port.prizeTreasury.unsliced(PRIZE_KETTLE_FARM, other)).amount).toBe(0n)
      }
      assertI1(cfg, host.state, "a")
      expect(asBigint(host.state["capital_outstanding"])).toBe(capital)

      await sliceFarm(host, port)
      expect((await port.prizeTreasury.owed(PRIZE_KETTLE_FARM, token, wallet)).amount).toBe(farmOwed)
      expect(asBigint(asEngineDict(city["fragment_sliced"])[ticker], 0n)).toBe(farmOwed)
      expect(asBigint(asEngineDict(city["fragment_owed"])[ticker], 0n)).toBe(0n)
      assertI1(cfg, host.state, "a")
      expect(asBigint(host.state["capital_outstanding"])).toBe(capital)

      host.state["city_time"] = cityTime + cadence + cadence
      host.state["season_settlement"] = {
        by_asset: {
          [ticker]: { payouts: [{ wallet, payout: monthPayout, city_id: "a" }] },
        },
      }
      expect(await publishBuybackFrame(host)).toBe(1n)
      expect((await port.prizeTreasury.owed(PRIZE_KETTLE_MONTH, token, wallet)).amount).toBe(monthPayout)
      expect((await port.prizeTreasury.owed(PRIZE_KETTLE_MONTH, token, demoWallet)).amount).toBe(0n)
      assertI1(cfg, host.state, "a")
      expect(asBigint(host.state["capital_outstanding"])).toBe(capital)
      const blown: Dict = structuredClone(host.state)
      blown["capital_outstanding"] = 1n
      expect(() => assertI1(cfg, blown, "a")).toThrow()
      expect(stockAddress(ticker)).toBe(token)
    } finally {
      if (ready !== undefined) await ready.close()
      restoreEnv(prior)
    }
  })
})

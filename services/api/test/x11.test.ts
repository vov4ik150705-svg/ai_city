import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { atPath, canonical, fromUtf8, loadPack, parseJson, type Json } from "@corporator/contentpack"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  dataPrizeClaim,
  err,
  PRIZE_KETTLE_FARM,
  PRIZE_KETTLE_MONTH,
  transportFromPort,
  type AssetPort,
  type PortConfig,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { loadBuybackPack } from "../../buyback/src/index.ts"
import { assertConveyorMonthFarmIsolation } from "../../buyback/test/conveyor.cases.ts"
import { handleCommand } from "../src/commands.ts"
import { prepareClaimPrize } from "../src/commit_prize.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { tickOnce, voucherReconcileDone } from "../src/scheduler.ts"
import { sliceFarm } from "../src/slicer.ts"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

const WALLET_A = "0x" + "a".repeat(40)
const WALLET_B = "0x" + "b".repeat(40)
const DEMO = "0x" + "d".repeat(40)

type BookTx = { readonly to: string; readonly data: string; readonly status: bigint; readonly from: string }

type Net = {
  bag: bigint
  slices: number
  players: readonly string[]
  used: Set<string>
  owed: Map<string, bigint>
  book: Map<string, BookTx>
  sliceOk: boolean
}

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function prizeAssetsOf(host: Host): string[] {
  const raw = walk(host.ctx.pack, ["generated", "seasons", "prize_assets"])
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function owedKey(kettle: bigint, token: string, account: string): string {
  return kettle.toString() + "/" + token.toLowerCase() + "/" + account.toLowerCase()
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

function bindStocks(host: Host): { readonly ticker: string; readonly token: string; readonly prior: Map<string, string | undefined> } {
  const assets = prizeAssetsOf(host)
  const ticker = assets[0]
  if (ticker === undefined) throw new Error("prize assets")
  const names = ["CORPORATOR_PRIZE_TREASURY"]
  for (const asset of assets) names.push("CORPORATOR_STOCK_" + asset)
  const prior = rememberEnv(names)
  process.env["CORPORATOR_PRIZE_TREASURY"] = padAddr(4n)
  let n = 20n
  let token = ""
  for (const asset of assets) {
    const addr = padAddr(n)
    n += 1n
    process.env["CORPORATOR_STOCK_" + asset] = addr
    if (asset === ticker) token = addr
  }
  return { ticker, token, prior }
}

function livePort(host: Host, net: Net): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    prizeTreasury: {
      ...rpc.prizeTreasury,
      async owed(kettle, token, account) {
        return amountOk(net.owed.get(owedKey(kettle, token, account)) ?? 0n)
      },
      async unsliced() {
        return amountOk(net.bag)
      },
      async batchUsed(batchId) {
        return amountOk(net.used.has(batchId) ? 1n : 0n)
      },
      async slice(_caller, batchId, _token, _kettle, players) {
        net.slices += 1
        net.players = players
        net.used.add(batchId)
        if (!net.sliceOk) return err(codes.API_INTENT_REPLAY)
        return { ok: true }
      },
    },
    chain: {
      ...rpc.chain,
      async transactionReceipt(hash: string) {
        const tx = net.book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: tx.status, from: tx.from, to: tx.to, input: tx.data }
      },
      async transactionByHash(hash: string) {
        const tx = net.book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: tx.status, from: tx.from, to: tx.to, input: tx.data }
      },
    },
  }
}

function cityA(host: Host): Dict {
  return asEngineDict(asEngineDict(host.state["cities"])["a"])
}

type Dict = { [key: string]: unknown }

function mapAmount(city: Dict, field: string, ticker: string): bigint {
  return asBigint(asEngineDict(city[field])[ticker], 0n)
}

async function walletHeaders(host: Host, sessionId: string) {
  const expires = asBigint(host.state["city_time"]) + host.ctx.sessionTtlCity
  await putJson(
    host.store,
    "sessions",
    sessionId,
    { kind: "session", city_id: "a", account_kind: "wallet", expires_city_time: expires.toString() },
    "wallet",
  )
  return { authorization: "Bearer " + sessionId }
}

function windowMark(host: Host, windowId: string, ticker: string): string {
  return asText(asEngineDict(host.state["fragment_windows"])[windowId + ":" + ticker])
}

describe("X11 farm slice and claim", () => {
  it("slices a wallet batch once and keeps the wallet from write time", async () => {
    const host = await bootHost()
    const bound = bindStocks(host)
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_A
    city["wallet"] = WALLET_B
    city["fragment_owed"] = { [bound.ticker]: 4n }
    city["tokens_held"] = { [bound.ticker]: 2n }
    host.state["day"] = 4n
    const cities = asEngineDict(host.state["cities"])
    cities["d"] = { id: "d", account_kind: "demo", wallet: DEMO, fragment_owed: { [bound.ticker]: 9n } }
    const net: Net = { bag: 4n, slices: 0, players: [], used: new Set(), owed: new Map(), book: new Map(), sliceOk: true }
    const port = livePort(host, net)
    try {
      await sliceFarm(host, port)
      await sliceFarm(host, port)
      expect(net.slices).toBe(1)
      expect(net.players[0]).toBe(WALLET_B)
      expect(mapAmount(city, "fragment_owed", bound.ticker)).toBe(0n)
      expect(mapAmount(city, "fragment_sliced", bound.ticker)).toBe(4n)
      expect(mapAmount(city, "tokens_held", bound.ticker)).toBe(2n)
      expect(mapAmount(asEngineDict(cities["d"]), "fragment_owed", bound.ticker)).toBe(9n)
      expect(windowMark(host, "4", bound.ticker)).toBe("sent")
    } finally {
      restoreEnv(bound.prior)
    }
  })

  it("does not slice when wallet owed exceeds the farm bag", async () => {
    const host = await bootHost()
    const bound = bindStocks(host)
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_B
    city["fragment_owed"] = { [bound.ticker]: 5n }
    city["tokens_held"] = { [bound.ticker]: 2n }
    host.state["day"] = 4n
    const net: Net = { bag: 4n, slices: 0, players: [], used: new Set(), owed: new Map(), book: new Map(), sliceOk: true }
    try {
      await sliceFarm(host, livePort(host, net))
      await sliceFarm(host, livePort(host, net))
      expect(net.slices).toBe(0)
      expect(mapAmount(city, "fragment_owed", bound.ticker)).toBe(5n)
      expect(mapAmount(city, "tokens_held", bound.ticker)).toBe(2n)
      expect(asText(host.state["fragment_slice_alarm"])).toBe(codes.FRAGMENT_POOL_EMPTY)
      const journal = host.state["fragment_slice_journal"]
      expect(Array.isArray(journal) && journal.length === 1).toBe(true)
      expect(host.attestLog.some((row) => row.key === codes.FRAGMENT_POOL_EMPTY)).toBe(true)
      expect(windowMark(host, "4", bound.ticker)).toBe("short")
    } finally {
      restoreEnv(bound.prior)
    }
  })

  it("marks a landed batch sent once when the send result was lost", async () => {
    const host = await bootHost()
    const bound = bindStocks(host)
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_B
    city["fragment_owed"] = { [bound.ticker]: 4n }
    const id = "0x" + "ab".repeat(32)
    host.state["day"] = 4n
    host.state["fragment_batches"] = [
      {
        id,
        token: bound.token,
        ticker: bound.ticker,
        window_id: "4",
        index: 0n,
        city_ids: ["a"],
        players: [WALLET_B],
        amounts: [4n],
        status: "sending",
      },
    ]
    const net: Net = { bag: 4n, slices: 0, players: [], used: new Set([id]), owed: new Map(), book: new Map(), sliceOk: false }
    const port = livePort(host, net)
    try {
      await sliceFarm(host, port)
      await sliceFarm(host, port)
      expect(net.slices).toBe(0)
      expect(mapAmount(city, "fragment_owed", bound.ticker)).toBe(0n)
      expect(mapAmount(city, "fragment_sliced", bound.ticker)).toBe(4n)
    } finally {
      restoreEnv(bound.prior)
    }
  })

  it("refuses claim_fragment until the chain owes the slice", async () => {
    const host = await bootHost()
    const bound = bindStocks(host)
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_B
    city["fragment_owed"] = { [bound.ticker]: 5n }
    city["tokens_held"] = { [bound.ticker]: 0n }
    const net: Net = { bag: 0n, slices: 0, players: [], used: new Set(), owed: new Map(), book: new Map(), sliceOk: true }
    const headers = await walletHeaders(host, "x11-pending")
    try {
      const result = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_fragment",
        canonical({ intent_id: "x11-pending", expected_city_time: asBigint(host.state["city_time"]), phase: "prepare" }),
        headers,
        undefined,
        livePort(host, net),
      )
      expect(asText(bodyOf(result.body)["code"])).toBe(codes.FRAGMENT_SLICE_PENDING)
      expect(mapAmount(city, "tokens_held", bound.ticker)).toBe(0n)
      expect(mapAmount(city, "fragment_owed", bound.ticker)).toBe(5n)
    } finally {
      restoreEnv(bound.prior)
    }
  })

  it("prepares only farm tokens the chain owes and moves sliced to claimed", async () => {
    const host = await bootHost()
    const bound = bindStocks(host)
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_B
    city["fragment_owed"] = { [bound.ticker]: 0n }
    city["fragment_sliced"] = { [bound.ticker]: 5n }
    city["fragment_claimed"] = {}
    city["tokens_held"] = { [bound.ticker]: 0n }
    const net: Net = { bag: 0n, slices: 0, players: [], used: new Set(), owed: new Map(), book: new Map(), sliceOk: true }
    net.owed.set(owedKey(PRIZE_KETTLE_FARM, bound.token, WALLET_B), 5n)
    const assets = prizeAssetsOf(host)
    const second = assets[1]
    if (second !== undefined) {
      const secondToken = process.env["CORPORATOR_STOCK_" + second] ?? ""
      net.owed.set(owedKey(PRIZE_KETTLE_FARM, secondToken, WALLET_B), 0n)
    }
    const port = livePort(host, net)
    const headers = await walletHeaders(host, "x11-claim")
    const t = asBigint(host.state["city_time"])
    try {
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_fragment",
        canonical({ intent_id: "x11-prep", expected_city_time: t, phase: "prepare" }),
        headers,
        undefined,
        port,
      )
      const prep = bodyOf(prepared.body)
      expect(asText(prep["code"])).toBe("")
      const txs = prep["txs"]
      expect(Array.isArray(txs) && txs.length === 1).toBe(true)
      if (!Array.isArray(txs) || txs.length !== 1) return
      const tx = asObj(txs[0])
      const data = dataPrizeClaim(bound.token, PRIZE_KETTLE_FARM)
      expect(asText(tx["data"])).toBe(data)
      expect(asText(tx["ticker"])).toBe(bound.ticker)
      const treasury = process.env["CORPORATOR_PRIZE_TREASURY"] ?? ""
      const dead = "0x" + "11".repeat(32)
      net.book.set(dead, { to: treasury, data, status: 0n, from: WALLET_B })
      const reverted = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_fragment",
        canonical({ intent_id: "x11-dead", expected_city_time: t, phase: "confirm", ticket: "x11-prep", tx_hashes: [dead] }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(reverted.body)["code"])).toBe(codes.CHAIN_TX_UNCONFIRMED)
      expect(bodyOf(reverted.body)["retryable"]).toBeUndefined()
      expect(mapAmount(city, "fragment_sliced", bound.ticker)).toBe(5n)
      const foreign = "0x" + "22".repeat(32)
      net.book.set(foreign, { to: treasury, data, status: 1n, from: WALLET_A })
      const mismatched = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_fragment",
        canonical({ intent_id: "x11-foreign", expected_city_time: t, phase: "confirm", ticket: "x11-prep", tx_hashes: [foreign] }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(mismatched.body)["code"])).toBe(codes.API_MALFORMED)
      expect(mapAmount(city, "fragment_sliced", bound.ticker)).toBe(5n)
      const hash = "0x" + "33".repeat(32)
      net.book.set(hash, { to: treasury, data, status: 1n, from: WALLET_B })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_fragment",
        canonical({ intent_id: "x11-ok", expected_city_time: t, phase: "confirm", ticket: "x11-prep", tx_hashes: [hash] }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(mapAmount(city, "fragment_sliced", bound.ticker)).toBe(0n)
      expect(mapAmount(city, "fragment_claimed", bound.ticker)).toBe(5n)
      expect(mapAmount(city, "fragment_owed", bound.ticker)).toBe(0n)
      expect(mapAmount(city, "tokens_held", bound.ticker)).toBe(0n)
      const again = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_fragment",
        canonical({ intent_id: "x11-again", expected_city_time: t, phase: "confirm", ticket: "x11-prep", tx_hashes: [hash] }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(again.body)["code"])).toBe("")
      expect(mapAmount(city, "fragment_claimed", bound.ticker)).toBe(5n)
    } finally {
      restoreEnv(bound.prior)
    }
  })

  it("mock claim_fragment still pays tokens_held", async () => {
    const host = await bootHost()
    const ticker = prizeAssetsOf(host)[0]
    if (ticker === undefined) throw new Error("prize assets")
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_B
    city["fragment_owed"] = { [ticker]: 4n }
    city["tokens_held"] = {}
    const headers = await walletHeaders(host, "x11-mock")
    const cfg = portCfgFromPack(host.ctx.pack)
    const result = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "claim_fragment",
      canonical({ intent_id: "x11-mock", expected_city_time: asBigint(host.state["city_time"]) }),
      headers,
      undefined,
      createMockPort(cfg),
    )
    expect(asText(bodyOf(result.body)["code"])).toBe("")
    expect(mapAmount(city, "tokens_held", ticker)).toBe(4n)
  })

  it("claim_prize prepares only the month kettle when that owed is positive", async () => {
    const host = await bootHost()
    const bound = bindStocks(host)
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_B
    const pack = structuredClone(host.ctx.pack)
    const deployed = asObj(walk(pack, ["sections", "launch", "deployed"])) as { [key: string]: Json }
    const keys = ["token", "curve", "pool", "hook", "tx"]
    let n = 1n
    for (const key of keys) {
      n += 1n
      deployed[key] = padAddr(n)
    }
    const ctx = { ...host.ctx, pack }
    const net: Net = { bag: 0n, slices: 0, players: [], used: new Set(), owed: new Map(), book: new Map(), sliceOk: true }
    net.owed.set(owedKey(PRIZE_KETTLE_MONTH, bound.token, WALLET_B), 3n)
    net.owed.set(owedKey(PRIZE_KETTLE_FARM, bound.token, WALLET_B), 9n)
    try {
      const result = await prepareClaimPrize(
        ctx,
        host.store,
        host.state,
        city,
        "a",
        "x11-month",
        asBigint(host.state["city_time"]),
        livePort(host, net),
      )
      const body = bodyOf(result.body)
      expect(asText(body["code"])).toBe("")
      const txs = body["txs"]
      expect(Array.isArray(txs) && txs.length === 1).toBe(true)
      if (!Array.isArray(txs) || txs.length !== 1) return
      expect(asText(asObj(txs[0])["data"])).toBe(dataPrizeClaim(bound.token, PRIZE_KETTLE_MONTH))
    } finally {
      restoreEnv(bound.prior)
    }
  })

  it("conveyor rejects a FARM slice and a FARM return without a sent window", async () => {
    const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
    const bytes = new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
    const pack = loadBuybackPack(bytes)
    const root = loadPack(bytes).pack
    const keys = asObj(atPath(root, ["sections", "arch", "keys"]))
    const voucher = asObj(keys["voucher_signer"] ?? null)
    const buy = asObj(keys["buyback_executor"] ?? null)
    const cfg: PortConfig = {
      voucherTtlS: 1n,
      voucherSignerService: asText(voucher["service"]),
      buybackExecutorService: asText(buy["service"]),
    }
    await assertConveyorMonthFarmIsolation(pack, cfg)
  })

  it("the tick schedules a slice without waiting on it", async () => {
    const host = await bootHost()
    const bound = bindStocks(host)
    const city = cityA(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET_B
    city["fragment_owed"] = { [bound.ticker]: 4n }
    host.state["day"] = 4n
    if (asBigint(host.state["vault_corp"], 0n) <= 0n) host.state["vault_corp"] = 1n
    const net: Net = { bag: 4n, slices: 0, players: [], used: new Set(), owed: new Map(), book: new Map(), sliceOk: true }
    try {
      await tickOnce(host, undefined, livePort(host, net))
      await voucherReconcileDone()
      expect(net.slices).toBe(1)
      expect(mapAmount(city, "fragment_sliced", bound.ticker)).toBe(4n)
    } finally {
      restoreEnv(bound.prior)
    }
  })
})

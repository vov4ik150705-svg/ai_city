import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  dataApprove,
  err,
  transportFromPort,
  type AssetPort,
  type TxLog,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

const TRANSFER = "0xddf252ad" + "1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
const WALLET = "0x" + "7".repeat(40)
const HOP = "0x" + "b".repeat(40)
const OTHER = "0x" + "c".repeat(40)
const STOCK = "0x" + "5".repeat(40)
const CORP = "0x" + "1".repeat(40)
const HOP_DATA = "0x" + "ab".repeat(4)

type BookTx = { readonly to: string; readonly data: string; readonly status: bigint; readonly logs: readonly TxLog[] }

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function padWord(addr: string): string {
  return "0x" + addr.slice(2).padStart(64, "0")
}

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function transferLog(token: string, to: string, value: bigint): TxLog {
  return {
    address: token,
    topics: [TRANSFER, padWord(HOP), padWord(to)],
    data: "0x" + value.toString(16).padStart(64, "0"),
  }
}

function cityOf(host: Host) {
  return asEngineDict(asEngineDict(host.state["cities"])["a"])
}

async function headers(host: Host, sessionId: string) {
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

function livePort(host: Host, balance: bigint, allowance: bigint, book: Map<string, BookTx>, silent = false): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    corpToken: {
      ...rpc.corpToken,
      async balanceOf() {
        if (silent) return err(codes.SERVICE_DEGRADED)
        return amountOk(balance)
      },
      async allowance() {
        return amountOk(allowance)
      },
    },
    chain: {
      ...rpc.chain,
      async transactionReceipt(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: tx.status, from: WALLET, to: tx.to, input: tx.data, logs: tx.logs }
      },
      async transactionByHash(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: tx.status, from: WALLET, to: tx.to, input: tx.data, logs: tx.logs }
      },
    },
  }
}

function armHop(stockOut: string): { readonly seen: { readonly [key: string]: Json }[]; readonly restore: () => void } {
  const seen: { readonly [key: string]: Json }[] = []
  const prevHop = process.env.CORPORATOR_HOP_URL
  const prevStock = process.env.CORPORATOR_STOCK_NVDA
  const prevCorp = process.env.CORPORATOR_CORP_TOKEN
  const prevFetch = globalThis.fetch
  process.env.CORPORATOR_HOP_URL = "http://hop.test/quote"
  process.env.CORPORATOR_STOCK_NVDA = STOCK
  process.env.CORPORATOR_CORP_TOKEN = CORP
  globalThis.fetch = async (_url, init) => {
    const raw = typeof init?.body === "string" ? init.body : ""
    const posted = parseJson(fromUtf8(new TextEncoder().encode(raw)))
    if (posted !== null && typeof posted === "object" && !Array.isArray(posted)) seen.push(asObj(posted))
    return new Response(JSON.stringify({ to: HOP, data: HOP_DATA, value: "0", stock_out: stockOut }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  }
  return {
    seen,
    restore() {
      if (prevHop === undefined) delete process.env.CORPORATOR_HOP_URL
      else process.env.CORPORATOR_HOP_URL = prevHop
      if (prevStock === undefined) delete process.env.CORPORATOR_STOCK_NVDA
      else process.env.CORPORATOR_STOCK_NVDA = prevStock
      if (prevCorp === undefined) delete process.env.CORPORATOR_CORP_TOKEN
      else process.env.CORPORATOR_CORP_TOKEN = prevCorp
      globalThis.fetch = prevFetch
    },
  }
}

describe("X10 live buy delivers stock to the wallet", () => {
  it("buys from the wallet balance when corp_held is zero", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
    city["corp_held"] = 0n
    city["tokens_held"] = { NVDA: 3n }
    const amount = asBigint(host.ctx.cfg["wei"])
    const hop = armHop("10000")
    const hdr = await headers(host, "x10-bal")
    const port = livePort(host, amount, amount, new Map())
    try {
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-bal", expected_city_time: asBigint(host.state["city_time"]), phase: "prepare", ticker: "NVDA", amount }),
        hdr,
        undefined,
        port,
      )
      const body = bodyOf(prepared.body)
      expect(asText(body["code"])).toBe("")
      expect(asText(body["phase"])).toBe("prepared")
      expect(asText(hop.seen[0]?.["recipient"])).toBe(WALLET)
      expect(asBigint(city["corp_held"], 0n)).toBe(0n)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(3n)
    } finally {
      hop.restore()
    }
  })

  it("refuses an empty wallet even when corp_held covers the buy", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
    const amount = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = amount
    const hop = armHop("10000")
    const hdr = await headers(host, "x10-empty")
    try {
      const refused = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-empty", expected_city_time: asBigint(host.state["city_time"]), phase: "prepare", ticker: "NVDA", amount }),
        hdr,
        undefined,
        livePort(host, 0n, 0n, new Map()),
      )
      expect(asText(bodyOf(refused.body)["code"])).toBe(codes.NOT_ENOUGH_CORP)
      expect(asBigint(city["corp_held"], 0n)).toBe(amount)
      const silent = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-silent", expected_city_time: asBigint(host.state["city_time"]), phase: "prepare", ticker: "NVDA", amount }),
        hdr,
        undefined,
        livePort(host, amount, amount, new Map(), true),
      )
      expect(asText(bodyOf(silent.body)["code"])).toBe(codes.SERVICE_DEGRADED)
      expect(asBigint(city["corp_held"], 0n)).toBe(amount)
    } finally {
      hop.restore()
    }
  })

  it("rejects a receipt that does not transfer the stock to the wallet", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
    city["corp_held"] = 0n
    city["tokens_held"] = { NVDA: 3n }
    const amount = asBigint(host.ctx.cfg["wei"])
    const hop = armHop("10000")
    const hdr = await headers(host, "x10-log")
    const book = new Map<string, BookTx>()
    const port = livePort(host, amount, amount, book)
    const t = asBigint(host.state["city_time"])
    try {
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-log-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(prepared.body)["phase"])).toBe("prepared")
      const bare = "0x" + "11".repeat(32)
      book.set(bare, { to: HOP, data: HOP_DATA, status: 1n, logs: [] })
      const missing = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-bare", expected_city_time: t, phase: "confirm", ticket: "x10-log-prep", tx_hashes: [bare] }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(missing.body)["code"])).toBe(codes.EXCHANGE_DELIVERY_UNVERIFIED)
      const foreign = "0x" + "22".repeat(32)
      book.set(foreign, { to: HOP, data: HOP_DATA, status: 1n, logs: [transferLog(STOCK, OTHER, amount)] })
      const diverted = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-foreign", expected_city_time: t, phase: "confirm", ticket: "x10-log-prep", tx_hashes: [foreign] }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(diverted.body)["code"])).toBe(codes.EXCHANGE_DELIVERY_UNVERIFIED)
      const hopSelf = "0x" + "33".repeat(32)
      book.set(hopSelf, { to: HOP, data: HOP_DATA, status: 1n, logs: [transferLog(STOCK, HOP, amount)] })
      const kept = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-hop", expected_city_time: t, phase: "confirm", ticket: "x10-log-prep", tx_hashes: [hopSelf] }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(kept.body)["code"])).toBe(codes.EXCHANGE_DELIVERY_UNVERIFIED)
      expect(asBigint(city["corp_held"], 0n)).toBe(0n)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(3n)
    } finally {
      hop.restore()
    }
  })

  it("journals the log amount and leaves the city ledger", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
    city["corp_held"] = 0n
    city["tokens_held"] = { NVDA: 0n }
    const amount = asBigint(host.ctx.cfg["wei"])
    const delivered = amount + 1n
    host.state["pool_eth"] = amount
    host.state["pool_corp"] = amount
    const poolCorp = asBigint(host.state["pool_corp"], 0n)
    const hop = armHop("10000")
    const hdr = await headers(host, "x10-ok")
    const book = new Map<string, BookTx>()
    const port = livePort(host, amount, amount, book)
    const t = asBigint(host.state["city_time"])
    try {
      await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-ok-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount }),
        hdr,
        undefined,
        port,
      )
      const hash = "0x" + "44".repeat(32)
      book.set(hash, { to: HOP, data: HOP_DATA, status: 1n, logs: [transferLog(STOCK, WALLET, delivered)] })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-ok", expected_city_time: t, phase: "confirm", ticket: "x10-ok-prep", tx_hashes: [hash] }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(asBigint(bodyOf(confirmed.body)["stock_out"], 0n)).toBe(delivered)
      expect(asBigint(city["corp_held"], 0n)).toBe(0n)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(0n)
      expect(asBigint(host.state["pool_corp"], 0n) > poolCorp).toBe(true)
      const journal = city["stock_journal"]
      expect(Array.isArray(journal) && journal.length === 1).toBe(true)
      if (!Array.isArray(journal)) return
      expect(asText(asObj(journal[0] ?? null)["code"])).toBe("stock_bought")
      expect(asBigint(asObj(journal[0] ?? null)["amount"], 0n)).toBe(delivered)
      const again = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-again", expected_city_time: t, phase: "confirm", ticket: "x10-ok-prep", tx_hashes: [hash] }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(again.body)["code"])).toBe("")
      expect(Array.isArray(city["stock_journal"]) && city["stock_journal"].length === 1).toBe(true)
    } finally {
      hop.restore()
    }
  })

  it("prepends a CORP approve when the hop allowance is short", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
    city["corp_held"] = 0n
    const amount = asBigint(host.ctx.cfg["wei"])
    const hop = armHop("10000")
    const hdr = await headers(host, "x10-approve")
    try {
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-approve", expected_city_time: asBigint(host.state["city_time"]), phase: "prepare", ticker: "NVDA", amount }),
        hdr,
        undefined,
        livePort(host, amount, 0n, new Map()),
      )
      const txs = bodyOf(prepared.body)["txs"]
      expect(Array.isArray(txs) && txs.length === 2).toBe(true)
      if (!Array.isArray(txs)) return
      const approve = asObj(txs[0] ?? null)
      const buy = asObj(txs[1] ?? null)
      expect(asText(approve["to"])).toBe(CORP)
      expect(asText(approve["data"])).toBe(dataApprove(HOP, amount))
      expect(asText(buy["label"])).toBe("buy")
      expect(asText(buy["data"])).toBe(HOP_DATA)
    } finally {
      hop.restore()
    }
  })

  it("refuses a live buy that skips the phase", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
    const amount = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = amount
    city["tokens_held"] = { NVDA: 3n }
    const hop = armHop("10000")
    const hdr = await headers(host, "x10-nophase")
    try {
      const skipped = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "x10-nophase", expected_city_time: asBigint(host.state["city_time"]), ticker: "NVDA", amount }),
        hdr,
        undefined,
        livePort(host, amount, amount, new Map()),
      )
      expect(asText(bodyOf(skipped.body)["code"])).toBe(codes.API_MALFORMED)
      expect(asBigint(city["corp_held"], 0n)).toBe(amount)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(3n)
    } finally {
      hop.restore()
    }
  })
})

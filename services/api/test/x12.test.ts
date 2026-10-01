import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { amountOk, createMockPort, createRpcPort, err, transportFromPort, type AssetPort, type TxLog } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { putJson } from "../src/store.ts"
import { cityLedgerDirty, liveStartRefusal } from "../src/tick_host.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

const TRANSFER = "0xddf252ad" + "1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
const WALLET = "0x" + "7".repeat(40)
const HOP = "0x" + "b".repeat(40)
const STOCK = "0x" + "5".repeat(40)
const CORP = "0x" + "1".repeat(40)
const HOP_DATA = "0x" + "ab".repeat(4)

const ASSIGNMENTS = [
  'bank.ts city["tokens_held"] = tokens',
  'commit_bank.ts city["corp_held"] = asBigint(city["corp_held"], 0n) + quoted.corp',
  'commit_bank.ts if (live === undefined) city["corp_held"] = held - amount',
  'commit_districts.ts city["tokens_held"] = held',
  'commit_exchange.ts city["corp_held"] = held - amount',
  'commit_exchange.ts city["tokens_held"] = tokens',
  'commit_fragments.ts city["tokens_held"] = held',
  'economy.ts city["corp_held"] = asBig(city["corp_held"]) + (w === 0n ? keep : keep / w)',
  'project.ts city["tokens_held"] = held',
  'project.ts if (live) city["tokens_held"] = before',
]

function assignments(): string[] {
  const root = process.cwd()
  const found: string[] = []
  for (const dir of ["services/api/src", "packages/engine/src"]) {
    for (const name of readdirSync(join(root, dir))) {
      if (!name.endsWith(".ts")) continue
      const lines = readFileSync(join(root, dir, name), "utf8").split("\n")
      for (const line of lines) {
        if (!line.includes('["corp_held"] =') && !line.includes('["tokens_held"] =')) continue
        found.push(name + " " + line.trim())
      }
    }
  }
  found.sort()
  return found
}

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
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

function padWord(addr: string): string {
  return "0x" + addr.slice(2).padStart(64, "0")
}

function transferLog(value: bigint): TxLog {
  return {
    address: STOCK,
    topics: [TRANSFER, padWord(HOP), padWord(WALLET)],
    data: "0x" + value.toString(16).padStart(64, "0"),
  }
}

function livePort(host: Host, balance: bigint, book: Map<string, { readonly to: string; readonly data: string; readonly logs: readonly TxLog[] }>): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = "4663"
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    corpToken: {
      ...rpc.corpToken,
      async balanceOf() {
        return amountOk(balance)
      },
      async allowance() {
        return amountOk(balance)
      },
    },
    chain: {
      ...rpc.chain,
      async transactionReceipt(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: 1n, from: WALLET, to: tx.to, input: tx.data, logs: tx.logs }
      },
      async transactionByHash(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: 1n, from: WALLET, to: tx.to, input: tx.data, logs: tx.logs }
      },
    },
  }
}

function armHop(): () => void {
  const prevHop = process.env.CORPORATOR_HOP_URL
  const prevStock = process.env.CORPORATOR_STOCK_NVDA
  const prevCorp = process.env.CORPORATOR_CORP_TOKEN
  const prevFetch = globalThis.fetch
  process.env.CORPORATOR_HOP_URL = "http://hop.test/quote"
  process.env.CORPORATOR_STOCK_NVDA = STOCK
  process.env.CORPORATOR_CORP_TOKEN = CORP
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ to: HOP, data: HOP_DATA, value: "0", stock_out: "1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  return () => {
    if (prevHop === undefined) delete process.env.CORPORATOR_HOP_URL
    else process.env.CORPORATOR_HOP_URL = prevHop
    if (prevStock === undefined) delete process.env.CORPORATOR_STOCK_NVDA
    else process.env.CORPORATOR_STOCK_NVDA = prevStock
    if (prevCorp === undefined) delete process.env.CORPORATOR_CORP_TOKEN
    else process.env.CORPORATOR_CORP_TOKEN = prevCorp
    globalThis.fetch = prevFetch
  }
}

async function confirmBuy(host: Host, tag: string): Promise<{ readonly code: string; readonly pool: bigint }> {
  cityOf(host)["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
  const amount = asBigint(host.ctx.cfg["wei"])
  host.state["pool_eth"] = amount
  host.state["pool_corp"] = amount
  const pool = asBigint(host.state["pool_corp"], 0n)
  const restore = armHop()
  const hdr = await headers(host, tag)
  const book = new Map<string, { readonly to: string; readonly data: string; readonly logs: readonly TxLog[] }>()
  const port = livePort(host, amount, book)
  const t = asBigint(host.state["city_time"])
  try {
    await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "buy_stock",
      canonical({ intent_id: tag + "-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount }),
      hdr,
      undefined,
      port,
    )
    const hash = "0x" + "44".repeat(32)
    book.set(hash, { to: HOP, data: HOP_DATA, logs: [transferLog(amount)] })
    const confirmed = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "buy_stock",
      canonical({ intent_id: tag + "-ok", expected_city_time: t, phase: "confirm", ticket: tag + "-prep", tx_hashes: [hash] }),
      hdr,
      undefined,
      port,
    )
    return { code: asText(bodyOf(confirmed.body)["code"]), pool }
  } finally {
    restore()
  }
}

describe("X12 live ledger is not custodial", () => {
  it("lists every corp_held and tokens_held assignment", () => {
    expect(assignments()).toEqual(ASSIGNMENTS)
  })

  it("refuses to start a live port when a wallet city keeps a custodial balance", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["corp_held"] = 1n
    expect(liveStartRefusal(host.state, true)).toBe(codes.LEDGER_NOT_EMPTY_LIVE)
    city["corp_held"] = 0n
    city["tokens_held"] = { NVDA: 1n }
    expect(liveStartRefusal(host.state, true)).toBe(codes.LEDGER_NOT_EMPTY_LIVE)
    city["tokens_held"] = {}
    city["stake_settled"] = { NVDA: 2n }
    city["stake_chain"] = { NVDA: 1n }
    expect(liveStartRefusal(host.state, true)).toBe(codes.LEDGER_NOT_EMPTY_LIVE)
    expect(liveStartRefusal(host.state, false)).toBe("")
    city["account_kind"] = "demo"
    expect(liveStartRefusal(host.state, true)).toBe("")
    city["account_kind"] = "wallet"
    city["stake_chain"] = { NVDA: 2n }
    expect(cityLedgerDirty(city)).toBe(false)
    expect(liveStartRefusal(host.state, true)).toBe("")
  })

  it("lets a clean live buy through and rolls a custodial balance back", async () => {
    const host = await bootHost()
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["corp_held"] = 0n
    city["tokens_held"] = {}
    const clean = await confirmBuy(host, "x12-clean")
    expect(clean.code).toBe("")
    expect(asBigint(host.state["pool_corp"], 0n) > clean.pool).toBe(true)
    expect(city["ledger_journal"]).toBeUndefined()

    const again = await bootHost()
    const dirty = cityOf(again)
    dirty["account_kind"] = "wallet"
    dirty["wallet"] = WALLET
    dirty["corp_held"] = 0n
    dirty["tokens_held"] = { NVDA: 1n }
    const tokens = await confirmBuy(again, "x12-tokens")
    const kept = cityOf(again)
    expect(tokens.code).toBe(codes.SERVICE_DEGRADED)
    expect(asBigint(again.state["pool_corp"], 0n)).toBe(tokens.pool)
    expect(asBigint(asEngineDict(kept["tokens_held"])["NVDA"], 0n)).toBe(1n)
    const journal = kept["ledger_journal"]
    expect(Array.isArray(journal) && journal.length === 1).toBe(true)
    if (!Array.isArray(journal)) return
    expect(asText(asObj(journal[0] ?? null)["code"])).toBe(codes.LEDGER_NOT_EMPTY_LIVE)

    const corpHost = await bootHost()
    const corpCity = cityOf(corpHost)
    corpCity["account_kind"] = "wallet"
    corpCity["wallet"] = WALLET
    corpCity["corp_held"] = 4n
    corpCity["tokens_held"] = {}
    const corp = await confirmBuy(corpHost, "x12-corp")
    expect(corp.code).toBe(codes.SERVICE_DEGRADED)
    expect(asBigint(corpHost.state["pool_corp"], 0n)).toBe(corp.pool)
    expect(asBigint(cityOf(corpHost)["corp_held"], 0n)).toBe(4n)

    const stakeHost = await bootHost()
    const stakeCity = cityOf(stakeHost)
    stakeCity["account_kind"] = "wallet"
    stakeCity["wallet"] = WALLET
    stakeCity["corp_held"] = 0n
    stakeCity["tokens_held"] = {}
    stakeCity["stake_settled"] = { NVDA: 5n }
    stakeCity["stake_chain"] = {}
    const stake = await confirmBuy(stakeHost, "x12-stake")
    const stakeKept = cityOf(stakeHost)
    expect(stake.code).toBe(codes.SERVICE_DEGRADED)
    expect(asBigint(stakeHost.state["pool_corp"], 0n)).toBe(stake.pool)
    expect(asBigint(asEngineDict(stakeKept["stake_settled"])["NVDA"], 0n)).toBe(5n)
    expect(asBigint(asEngineDict(stakeKept["stake_chain"])["NVDA"], 0n)).toBe(0n)
  })
})

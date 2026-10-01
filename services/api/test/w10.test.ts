import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { createMockPort, dataApprove, dataStake, err, type AssetPort } from "@corporator/chainport"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { syncStakeSnapshot } from "../src/project.ts"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "../src/values.ts"
import { bootHost } from "./harness.ts"

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function cityOf(host: Awaited<ReturnType<typeof bootHost>>, cityId: string) {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function stakeMinOf(host: Awaited<ReturnType<typeof bootHost>>, ticker: string): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

function opened(city: ReturnType<typeof cityOf>): string[] {
  const raw = city["districts"]
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === "string")
}

async function walletHeaders(host: Awaited<ReturnType<typeof bootHost>>, cityId: string, sessionId: string) {
  const expires = asBigint(host.state["city_time"]) + host.ctx.sessionTtlCity
  await putJson(
    host.store,
    "sessions",
    sessionId,
    { kind: "session", city_id: cityId, account_kind: "wallet", expires_city_time: expires.toString() },
    "wallet",
  )
  return { authorization: "Bearer " + sessionId }
}

describe("W10 ledger and wallet stake", () => {
  it("ledger stake opens offline, wallet stake waits for confirm, and a fallen snapshot does not refill the ledger", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "w10")
    const need = stakeMinOf(host, "NVDA")
    city["tokens_held"] = { NVDA: need }
    let calls = 0
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = []
    const port: AssetPort = {
      ...createMockPort(portCfgFromPack(host.ctx.pack)),
      kind: "rpc",
      corpToken: {
        ...createMockPort(portCfgFromPack(host.ctx.pack)).corpToken,
        async allowance() {
          calls += 1
          return { ok: true, amount: 0n }
        },
      },
      stakeRegistry: {
        ...createMockPort(portCfgFromPack(host.ctx.pack)).stakeRegistry,
        async stake() {
          calls += 1
          return { ok: true }
        },
        async snapshot() {
          calls += 1
          return { ok: true, rows }
        },
      },
      chain: {
        async transactionReceipt(hash: string) {
          calls += 1
          return { ok: true, status: book.has(hash.toLowerCase()) ? 1n : 0n, from: wallet, to: "", input: "" }
        },
        async transactionByHash(hash: string) {
          calls += 1
          const tx = book.get(hash.toLowerCase())
          if (tx === undefined) return err(codes.SERVICE_DEGRADED)
          return { ok: true, status: 1n, from: wallet, to: tx.to, input: tx.data }
        },
        async pendingNonce() {
          return err(codes.SERVICE_DEGRADED)
        },
        async estimateGas() {
          return err(codes.SERVICE_DEGRADED)
        },
        async gasPrice() {
          return err(codes.SERVICE_DEGRADED)
        },
      },
    }
    const t = asBigint(host.state["city_time"])
    const ledger = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "stake",
      canonical({ intent_id: "w10-ledger", expected_city_time: t, source: "ledger", ticker: "NVDA", amount: need }),
      headers,
      undefined,
      createMockPort(portCfgFromPack(host.ctx.pack)),
    )
    expect(ledger.status).toBe(host.ctx.httpOk)
    expect(asText(bodyOf(ledger.body)["code"])).toBe("")
    expect(opened(city)).toContain("compute")
    expect(asBigint(asEngineDict(city["stake_settled"])["NVDA"], 0n)).toBe(need)
    expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(0n)
    expect(calls).toBe(0)

    const token = padAddr(8n)
    const registry = padAddr(9n)
    const prevToken = process.env.CORPORATOR_STOCK_NVDA
    const prevRegistry = process.env.CORPORATOR_STAKE_REGISTRY
    process.env.CORPORATOR_STOCK_NVDA = token
    process.env.CORPORATOR_STAKE_REGISTRY = registry
    try {
      city["tokens_held"] = { NVDA: 0n }
      city["stake_settled"] = {}
      city["districts"] = []
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "w10-prep",
          expected_city_time: t,
          phase: "prepare",
          source: "wallet",
          ticker: "NVDA",
          amount: need,
        }),
        headers,
        undefined,
        port,
      )
      expect(prepared.status).toBe(host.ctx.httpOk)
      const prep = bodyOf(prepared.body)
      expect(asText(prep["phase"])).toBe("prepared")
      const txs = prep["txs"]
      if (!Array.isArray(txs)) throw new Error("txs")
      expect(txs.length).toBe(2)
      expect(asText(asObj(txs[0] ?? null)["data"])).toBe(dataApprove(registry, need))
      expect(asText(asObj(txs[1] ?? null)["data"])).toBe(dataStake(wallet, "NVDA", need))
      expect(opened(city)).not.toContain("compute")
      expect(asBigint(asEngineDict(city["stake_settled"])["NVDA"], 0n)).toBe(0n)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(0n)

      const stakeHash = "0x" + "44".repeat(32)
      const approveHash = "0x" + "55".repeat(32)
      book.set(approveHash, { to: token, data: dataApprove(registry, need) })
      book.set(stakeHash, { to: registry, data: dataStake(wallet, "NVDA", need) })
      rows.push({ ticker: "NVDA", amount: need })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "w10-ok",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "w10-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(confirmed.status).toBe(host.ctx.httpOk)
      expect(opened(city)).toContain("compute")
      expect(asBigint(asEngineDict(city["stake_settled"])["NVDA"], 0n)).toBe(need)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(0n)
      const again = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "w10-again",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "w10-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(fromUtf8(again.body)).toBe(fromUtf8(confirmed.body))
      expect(asBigint(asEngineDict(city["stake_settled"])["NVDA"], 0n)).toBe(need)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(0n)
    } finally {
      if (prevToken === undefined) delete process.env.CORPORATOR_STOCK_NVDA
      else process.env.CORPORATOR_STOCK_NVDA = prevToken
      if (prevRegistry === undefined) delete process.env.CORPORATOR_STAKE_REGISTRY
      else process.env.CORPORATOR_STAKE_REGISTRY = prevRegistry
    }

    const heldBefore = 7n
    city["tokens_held"] = { NVDA: heldBefore }
    city["stake_settled"] = { NVDA: need }
    city["stake_chain"] = { NVDA: need }
    rows.length = 0
    rows.push({ ticker: "NVDA", amount: need - 1n })
    await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
    expect(asBigint(asEngineDict(city["stake_settled"])["NVDA"], 0n)).toBe(need - 1n)
    expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(heldBefore)
    const quote = bodyOf(
      (
        await host.handle(
          "GET",
          "/city/a/state",
          new Uint8Array(),
          headers,
        )
      ).body,
    )
    const sections = asObj(quote["sections"])
    const stocks = asObj(sections["oracle.stock_price"])
    const stockRows = stocks["rows"]
    if (!Array.isArray(stockRows)) throw new Error("rows")
    let nvda = 0n
    for (const item of stockRows) {
      if (item !== null && typeof item === "object" && !Array.isArray(item) && asText(item["ticker"]) === "NVDA") {
        nvda = asBigint(item["stocks"])
      }
    }
    expect(nvda).toBe(heldBefore)
  })
})

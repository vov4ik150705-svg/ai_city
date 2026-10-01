import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { amountOk, createMockPort, err, type AssetPort, type TxLog } from "@corporator/chainport"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { portCfgFromPack } from "../src/custody.ts"
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

function chainFor(
  payer: () => string,
  book: Map<string, { readonly to: string; readonly data: string; readonly logs?: readonly TxLog[] }>,
): AssetPort["chain"] {
  return {
    async transactionReceipt(hash: string) {
      const tx = book.get(hash.toLowerCase())
      const known = tx !== undefined
      return { ok: true, status: known ? 1n : 0n, from: payer(), to: tx?.to ?? "", input: tx?.data ?? "", logs: tx?.logs ?? [] }
    },
    async transactionByHash(hash: string) {
      const tx = book.get(hash.toLowerCase())
      if (tx === undefined) return err(codes.SERVICE_DEGRADED)
      return { ok: true, status: 1n, from: payer(), to: tx.to, input: tx.data }
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
  }
}

describe("W12 player-signed exchange and prize", () => {
  it("a hop transaction prepares, an empty hop does not debit, and an empty launch does not prepare a prize", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
    const amount = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = 0n
    const headers = await walletHeaders(host, cityId, "w12-live")
    const t = asBigint(host.state["city_time"])
    const hopTo = padAddr(11n)
    const hopData = "0x" + "ab".repeat(4)
    const stock = padAddr(9n)
    const prevHop = process.env.CORPORATOR_HOP_URL
    const prevStock = process.env.CORPORATOR_STOCK_NVDA
    const prevFetch = globalThis.fetch
    let mode: "tx" | "empty" = "tx"
    const seen: { readonly [key: string]: Json }[] = []
    process.env.CORPORATOR_HOP_URL = "http://hop.test/quote"
    process.env.CORPORATOR_STOCK_NVDA = stock
    globalThis.fetch = async (_url, init) => {
      const raw = typeof init?.body === "string" ? init.body : ""
      const posted = parseJson(fromUtf8(new TextEncoder().encode(raw)))
      if (posted !== null && typeof posted === "object" && !Array.isArray(posted)) seen.push(asObj(posted))
      if (mode === "empty") return new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
      return new Response(
        JSON.stringify({ to: hopTo, data: hopData, value: "0", stock_out: "10000" }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    }
    const book = new Map<string, { readonly to: string; readonly data: string; readonly logs?: readonly TxLog[] }>()
    const mock = createMockPort(portCfgFromPack(host.ctx.pack))
    const port: AssetPort = {
      ...mock,
      kind: "rpc",
      chain: chainFor(() => wallet, book),
      corpToken: {
        ...mock.corpToken,
        async balanceOf() {
          return amountOk(amount)
        },
        async allowance() {
          return amountOk(amount)
        },
      },
    }
    try {
      const held = asBigint(city["corp_held"])
      const tokensBefore = asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "w12-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount }),
        headers,
        undefined,
        port,
      )
      expect(prepared.status).toBe(host.ctx.httpOk)
      const prep = bodyOf(prepared.body)
      expect(asText(prep["phase"])).toBe("prepared")
      expect(asText(prep["effect"])).toBe("buy_stock")
      const txs = prep["txs"]
      if (!Array.isArray(txs)) throw new Error("txs")
      expect(asText(asObj(txs[0] ?? null)["data"])).toBe(hopData)
      expect(asBigint(city["corp_held"])).toBe(held)
      expect(seen.length).toBe(1)
      expect(asText(seen[0]?.["want"])).toBe("tx")
      expect(asText(seen[0]?.["recipient"])).toBe(wallet)

      const hash = "0x" + "44".repeat(32)
      book.set(hash, { to: hopTo, data: "0x" + "ff".repeat(4) })
      const forged = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({
          intent_id: "w12-forge",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w12-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(forged.body)["code"])).toBe(codes.API_MALFORMED)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(tokensBefore)
      expect(asBigint(city["corp_held"])).toBe(held)

      const good = "0x" + "55".repeat(32)
      const delivered: TxLog = {
        address: stock,
        topics: [
          "0xddf252ad" + "1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
          "0x" + hopTo.slice(2).padStart(64, "0"),
          "0x" + wallet.slice(2).padStart(64, "0"),
        ],
        data: "0x" + 10_000n.toString(16).padStart(64, "0"),
      }
      book.set(good, { to: hopTo, data: hopData, logs: [delivered] })
      const credited = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({
          intent_id: "w12-ok",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w12-prep",
          tx_hashes: [good],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(credited.body)["code"])).toBe("")
      const after = asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)
      expect(after).toBe(tokensBefore)
      expect(asBigint(city["corp_held"])).toBe(held)
      const replay = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({
          intent_id: "w12-replay",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w12-prep",
          tx_hashes: [good],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(replay.body)["code"])).toBe("")
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(after)

      city["corp_held"] = amount
      mode = "empty"
      const empty = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "buy_stock",
        canonical({ intent_id: "w12-empty", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(empty.body)["code"])).toBe(codes.EXCHANGE_HOP_UNAVAILABLE)
      expect(asBigint(city["corp_held"])).toBe(amount)

      const prize = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_prize",
        canonical({ intent_id: "w12-prize", expected_city_time: t, phase: "prepare" }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(prize.body)["phase"])).not.toBe("prepared")
    } finally {
      if (prevHop === undefined) delete process.env.CORPORATOR_HOP_URL
      else process.env.CORPORATOR_HOP_URL = prevHop
      if (prevStock === undefined) delete process.env.CORPORATOR_STOCK_NVDA
      else process.env.CORPORATOR_STOCK_NVDA = prevStock
      globalThis.fetch = prevFetch
    }
  })
})

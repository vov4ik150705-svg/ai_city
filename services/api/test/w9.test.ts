import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes, transportHttp } from "@corporator/protocol"
import { amountOk, createMockPort, dataApprove, dataDeposit, err, type AssetPort } from "@corporator/chainport"
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

function chainFor(payer: () => string, book: Map<string, { readonly to: string; readonly data: string }>): AssetPort["chain"] {
  return {
    async transactionReceipt(hash: string) {
      const known = book.has(hash.toLowerCase())
      return { ok: true, status: known ? 1n : 0n, from: payer(), to: "", input: "" }
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

describe("W9 client-signed deposit", () => {
  it("prepare leaves capital, confirm mints the mock amount, and a confirm without a ticket is refused", async () => {
    const mockHost = await bootHost()
    const cityId = "a"
    const mockCity = cityOf(mockHost, cityId)
    mockCity["account_kind"] = "wallet"
    const amount = asBigint(mockHost.ctx.cfg["wei"])
    mockCity["corp_held"] = amount
    const mockHeaders = await walletHeaders(mockHost, cityId, "w9-mock")
    const tMock = asBigint(mockHost.state["city_time"])
    const mockRes = await mockHost.handle(
      "POST",
      "/command/deposit",
      canonical({ intent_id: "w9-mock", expected_city_time: tMock, amount }),
      mockHeaders,
    )
    expect(mockRes.status).toBe(mockHost.ctx.httpOk)
    const mockBody = bodyOf(mockRes.body)
    expect(asText(mockBody["phase"])).toBe("applied")
    expect(asText(mockBody["code"])).toBe("")
    const mockCapital = asBigint(mockCity["capital"])
    expect(mockCapital > 0n).toBe(true)

    const host = await bootHost()
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    const token = padAddr(8n)
    const vault = padAddr(9n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "w9-live")
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    let payer = wallet
    const port: AssetPort = {
      ...createMockPort(portCfgFromPack(host.ctx.pack), { corp: { [wallet]: amount } }),
      kind: "rpc",
      chain: chainFor(() => payer, book),
    }
    const prevToken = process.env.CORPORATOR_CORP_TOKEN
    const prevVault = process.env.CORPORATOR_VAULT
    process.env.CORPORATOR_CORP_TOKEN = token
    process.env.CORPORATOR_VAULT = vault
    try {
      const vaultBefore = asBigint(host.state["vault_corp"], 0n)
      const capitalBefore = asBigint(city["capital"])
      const t = asBigint(host.state["city_time"])
      const bare = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({
          intent_id: "w9-bare",
          expected_city_time: t,
          phase: "confirm",
          ticket: "missing",
          tx_hashes: ["0x" + "ab".repeat(32)],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(bare.body)["code"])).toBe(codes.API_MALFORMED)
      expect(asBigint(city["capital"])).toBe(capitalBefore)
      expect(asBigint(host.state["vault_corp"], 0n)).toBe(vaultBefore)

      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({ intent_id: "w9-prep", expected_city_time: t, phase: "prepare", amount }),
        headers,
        undefined,
        port,
      )
      expect(prepared.status).toBe(host.ctx.httpOk)
      const prep = bodyOf(prepared.body)
      expect(asText(prep["phase"])).toBe("prepared")
      expect(asText(prep["ticket"])).toBe("w9-prep")
      expect(asText(prep["chain_id"])).toBe(
        asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString(),
      )
      const txs = prep["txs"]
      if (!Array.isArray(txs)) throw new Error("txs")
      expect(txs.length).toBe(2)
      const approve = asObj(txs[0] ?? null)
      const deposit = asObj(txs[1] ?? null)
      expect(asText(approve["label"])).toBe("approve")
      expect(asText(approve["to"])).toBe(token)
      expect(asText(approve["data"])).toBe(dataApprove(vault, amount))
      expect(asText(approve["value"])).toBe("0")
      expect(asText(deposit["label"])).toBe("deposit")
      expect(asText(deposit["to"])).toBe(vault)
      expect(asText(deposit["data"])).toBe(dataDeposit(wallet, amount))
      expect(asBigint(city["capital"])).toBe(capitalBefore)
      expect(asBigint(host.state["vault_corp"], 0n)).toBe(vaultBefore)

      const approveHash = "0x" + "11".repeat(32)
      const depositHash = "0x" + "22".repeat(32)
      book.set(approveHash, { to: token, data: dataApprove(vault, amount) })
      book.set(depositHash, { to: vault, data: dataDeposit(wallet, amount) })
      const unconfirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({
          intent_id: "w9-wait",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w9-prep",
          tx_hashes: ["0x" + "33".repeat(32), depositHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(unconfirmed.body)["code"])).toBe(codes.CHAIN_TX_UNCONFIRMED)
      expect(unconfirmed.status).toBe(transportHttp.CHAIN_TX_UNCONFIRMED)
      expect(asBigint(city["capital"])).toBe(capitalBefore)
      payer = padAddr(4n)
      const foreign = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({
          intent_id: "w9-foreign",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w9-prep",
          tx_hashes: [approveHash, depositHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(foreign.body)["code"])).toBe(codes.API_MALFORMED)
      expect(asBigint(city["capital"])).toBe(capitalBefore)
      payer = wallet
      const swapped = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({
          intent_id: "w9-swap",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w9-prep",
          tx_hashes: [depositHash, approveHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(swapped.body)["code"])).toBe(codes.API_MALFORMED)
      expect(asBigint(city["capital"])).toBe(capitalBefore)

      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({
          intent_id: "w9-ok",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w9-prep",
          tx_hashes: [approveHash, depositHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(confirmed.status).toBe(host.ctx.httpOk)
      expect(asText(bodyOf(confirmed.body)["phase"])).toBe("applied")
      expect(asBigint(city["capital"])).toBe(mockCapital)
      const again = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({
          intent_id: "w9-again",
          expected_city_time: t,
          phase: "confirm",
          ticket: "w9-prep",
          tx_hashes: [approveHash, depositHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(fromUtf8(again.body)).toBe(fromUtf8(confirmed.body))
      expect(asBigint(city["capital"])).toBe(mockCapital)

      const covered: AssetPort = {
        ...port,
        corpToken: {
          ...port.corpToken,
          async allowance() {
            return amountOk(amount)
          },
        },
      }
      const onlyDeposit = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({ intent_id: "w9-allow", expected_city_time: t, phase: "prepare", amount }),
        headers,
        undefined,
        covered,
      )
      const allowBody = bodyOf(onlyDeposit.body)
      const allowTxs = allowBody["txs"]
      if (!Array.isArray(allowTxs)) throw new Error("txs")
      expect(allowTxs.length).toBe(1)
      expect(asText(asObj(allowTxs[0] ?? null)["label"])).toBe("deposit")
      expect(asBigint(city["capital"])).toBe(mockCapital)
    } finally {
      if (prevToken === undefined) delete process.env.CORPORATOR_CORP_TOKEN
      else process.env.CORPORATOR_CORP_TOKEN = prevToken
      if (prevVault === undefined) delete process.env.CORPORATOR_VAULT
      else process.env.CORPORATOR_VAULT = prevVault
    }
  })
})

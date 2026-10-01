import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  dataClaimUnstaked,
  transportFromPort,
  type AssetPort,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { chainTxKey } from "../src/commit_bank.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { getBytes, putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk, type Dict } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>
type Cooling = { ticker: string; amount: bigint; readyAtS: bigint }

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function cityOf(host: Host, cityId: string): Dict {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function claimedOf(city: Dict, ticker: string): bigint {
  const raw = city["unstake_journal"]
  if (!Array.isArray(raw)) return 0n
  let sum = 0n
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as { readonly [key: string]: Json }
    if (asText(row["code"]) !== "unstake_claimed" || asText(row["ticker"]) !== ticker) continue
    sum += asBigint(row["amount"], 0n)
  }
  return sum
}

async function walletHeaders(host: Host, cityId: string, sessionId: string, kind: "wallet" | "demo" = "wallet") {
  const expires = asBigint(host.state["city_time"]) + host.ctx.sessionTtlCity
  await putJson(
    host.store,
    "sessions",
    sessionId,
    { kind: "session", city_id: cityId, account_kind: kind, expires_city_time: expires.toString() },
    kind,
  )
  return { authorization: "Bearer " + sessionId }
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

function livePort(
  host: Host,
  wallet: string,
  book: ReadonlyMap<string, { readonly to: string; readonly data: string }>,
  cooling: readonly Cooling[],
  blockTime: bigint,
): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    stakeRegistry: {
      ...rpc.stakeRegistry,
      async coolingSnapshot() {
        return { ok: true, rows: cooling }
      },
    },
    chain: {
      ...rpc.chain,
      async latestBlockTime() {
        return amountOk(blockTime)
      },
      async transactionReceipt(hash: string) {
        const known = book.has(hash.toLowerCase())
        return { ok: true, status: known ? 1n : 0n, from: wallet, to: "", input: "", logs: [] }
      },
      async transactionByHash(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return { ok: false, code: codes.SERVICE_DEGRADED }
        return { ok: true, status: 1n, from: wallet, to: tx.to, input: tx.data, logs: [] }
      },
    },
  }
}

describe("X6 claim unstaked", () => {
  it("refuses before the network deadline and claims once the bucket is empty", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    host.state["city_time"] = 9_000_000n
    const headers = await walletHeaders(host, cityId, "x6-claim")
    const ready = 5_000n
    const amount = 40n
    city["unstake_cooldown"] = { NVDA: { amount, ready_at_s: ready } }
    city["tokens_held"] = { NVDA: 0n }
    host.state["city_time"] = 9_000_000n
    const registry = padAddr(9n)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const cooling: Cooling[] = [{ ticker: "NVDA", amount, readyAtS: ready }]
    let blockTime = 1_000n
    const port = livePort(host, wallet, book, cooling, 0n)
    const timed = {
      ...port,
      chain: {
        ...port.chain,
        async latestBlockTime() {
          return amountOk(blockTime)
        },
      },
    }
    const prior = rememberEnv(["CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const early = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_unstaked",
        canonical({ intent_id: "x6-early", expected_city_time: 9_000_000n, phase: "prepare", ticker: "NVDA" }),
        headers,
        undefined,
        timed,
      )
      const earlyBody = bodyOf(early.body)
      expect(asText(earlyBody["code"])).toBe(codes.UNSTAKE_COOLING)
      expect(asBigint(earlyBody["ready_at_s"])).toBe(ready)
      expect(earlyBody["txs"]).toBeUndefined()
      expect(asEngineDict(city["unstake_cooldown"])["NVDA"]).toBeDefined()
      blockTime = ready
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_unstaked",
        canonical({ intent_id: "x6-prep", expected_city_time: 9_000_000n, phase: "prepare", ticker: "NVDA" }),
        headers,
        undefined,
        timed,
      )
      const prep = bodyOf(prepared.body)
      expect(asText(prep["phase"])).toBe("prepared")
      const txs = prep["txs"]
      expect(Array.isArray(txs)).toBe(true)
      if (!Array.isArray(txs) || txs.length !== 1) throw new Error("txs")
      const tx = asObj(txs[0])
      const data = dataClaimUnstaked("NVDA")
      expect(asText(tx["data"])).toBe(data)
      expect(asText(tx["to"]).toLowerCase()).toBe(registry)
      const hash = "0x" + "71".repeat(32)
      book.set(hash, { to: registry, data })
      cooling.length = 0
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_unstaked",
        canonical({
          intent_id: "x6-ok",
          expected_city_time: 9_000_000n,
          phase: "confirm",
          ticket: "x6-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        timed,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(asEngineDict(city["unstake_cooldown"])["NVDA"]).toBeUndefined()
      expect(claimedOf(city, "NVDA")).toBe(amount)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(0n)
      const again = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_unstaked",
        canonical({ intent_id: "x6-again", expected_city_time: 9_000_000n, phase: "prepare", ticker: "NVDA" }),
        headers,
        undefined,
        timed,
      )
      expect(asText(bodyOf(again.body)["code"])).toBe(codes.UNSTAKE_NOTHING_PENDING)
      expect(claimedOf(city, "NVDA")).toBe(amount)
    } finally {
      restoreEnv(prior)
    }
  })

  it("a lagged cooling snapshot is retryable and does not drop the row", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    host.state["city_time"] = 9_000_000n
    const headers = await walletHeaders(host, cityId, "x6-lag")
    const ready = 5_000n
    const amount = 40n
    city["unstake_cooldown"] = { NVDA: { amount, ready_at_s: ready } }
    const registry = padAddr(9n)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const cooling: Cooling[] = [{ ticker: "NVDA", amount, readyAtS: ready }]
    const port = livePort(host, wallet, book, cooling, ready)
    const prior = rememberEnv(["CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_unstaked",
        canonical({ intent_id: "x6-lag-prep", expected_city_time: 9_000_000n, phase: "prepare", ticker: "NVDA" }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(prepared.body)["phase"])).toBe("prepared")
      const hash = "0x" + "72".repeat(32)
      book.set(hash, { to: registry, data: dataClaimUnstaked("NVDA") })
      const lagged = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_unstaked",
        canonical({
          intent_id: "x6-lag-ok",
          expected_city_time: 9_000_000n,
          phase: "confirm",
          ticket: "x6-lag-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      const lagBody = bodyOf(lagged.body)
      expect(asText(lagBody["code"])).toBe(codes.CHAIN_TX_UNCONFIRMED)
      expect(asBigint(lagBody["retryable"])).toBe(1n)
      expect(asBigint(asEngineDict(asEngineDict(city["unstake_cooldown"])["NVDA"])["amount"])).toBe(amount)
      expect(await getBytes(host.store, "intents", chainTxKey(hash))).toBeUndefined()
      cooling.length = 0
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "claim_unstaked",
        canonical({
          intent_id: "x6-lag-ok",
          expected_city_time: 9_000_000n,
          phase: "confirm",
          ticket: "x6-lag-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(asEngineDict(city["unstake_cooldown"])["NVDA"]).toBeUndefined()
      expect(claimedOf(city, "NVDA")).toBe(amount)
    } finally {
      restoreEnv(prior)
    }
  })

  it("the mock refuses and a demo city is refused", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    const t = asBigint(host.state["city_time"])
    const demoHeaders = await walletHeaders(host, cityId, "x6-demo", "demo")
    const demo = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "claim_unstaked",
      canonical({ intent_id: "x6-demo", expected_city_time: t, ticker: "NVDA" }),
      demoHeaders,
      undefined,
      createMockPort(portCfgFromPack(host.ctx.pack)),
    )
    expect(asText(bodyOf(demo.body)["code"])).toBe(codes.DEMO_NO_CLAIM)
    city["account_kind"] = "wallet"
    city["wallet"] = padAddr(7n)
    city["unstake_cooldown"] = { NVDA: { amount: 40n, ready_at_s: 5_000n } }
    city["tokens_held"] = { NVDA: 3n }
    const headers = await walletHeaders(host, cityId, "x6-mock")
    const mocked = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "claim_unstaked",
      canonical({ intent_id: "x6-mock", expected_city_time: t, ticker: "NVDA" }),
      headers,
      undefined,
      createMockPort(portCfgFromPack(host.ctx.pack)),
    )
    expect(asText(bodyOf(mocked.body)["code"])).toBe(codes.UNSTAKE_NOTHING_PENDING)
    expect(asBigint(asEngineDict(asEngineDict(city["unstake_cooldown"])["NVDA"])["amount"])).toBe(40n)
    expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(3n)
  })
})

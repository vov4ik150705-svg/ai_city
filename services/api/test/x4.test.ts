import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  dataApprove,
  dataStake,
  err,
  transportFromPort,
  type AssetPort,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { chainTxKey } from "../src/commit_bank.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { applyChainRows, syncStakeSnapshot } from "../src/project.ts"
import { getBytes, putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asText, walk, type Dict } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

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

function stakeMinOf(host: Host, ticker: string): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

function settledOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["stake_settled"])[ticker], 0n)
}

function chainOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["stake_chain"])[ticker], 0n)
}

function heldOf(city: Dict, ticker: string): bigint {
  return asBigint(asEngineDict(city["tokens_held"])[ticker], 0n)
}

function codeCount(city: Dict, code: string): number {
  const raw = city["codes"]
  if (!Array.isArray(raw)) return 0
  let n = 0
  for (const item of raw) if (item === code) n += 1
  return n
}

function opened(city: Dict): string[] {
  const raw = city["districts"]
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === "string")
}

async function walletHeaders(host: Host, cityId: string, sessionId: string) {
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
  rows: readonly { readonly ticker: string; readonly amount: bigint }[],
  snapshotOk = true,
): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    corpToken: {
      ...rpc.corpToken,
      async allowance() {
        return amountOk(0n)
      },
    },
    stakeRegistry: {
      ...rpc.stakeRegistry,
      async snapshot() {
        if (!snapshotOk) return err(codes.SERVICE_DEGRADED)
        return { ok: true, rows }
      },
    },
    chain: {
      ...rpc.chain,
      async transactionReceipt(hash: string) {
        const known = book.has(hash.toLowerCase())
        return { ok: true, status: known ? 1n : 0n, from: wallet, to: "", input: "", logs: [] }
      },
      async transactionByHash(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: 1n, from: wallet, to: tx.to, input: tx.data, logs: [] }
      },
    },
  }
}

async function prepareStake(host: Host, cityId: string, intentId: string, amount: bigint, headers: { authorization: string }, port: AssetPort) {
  const t = asBigint(host.state["city_time"])
  return handleCommand(
    host.ctx,
    host.store,
    host.state,
    "stake",
    canonical({
      intent_id: intentId,
      expected_city_time: t,
      phase: "prepare",
      source: "wallet",
      ticker: "NVDA",
      amount,
    }),
    headers,
    undefined,
    port,
  )
}

describe("X4 stake snapshot", () => {
  it("confirm and a later sync of the same snapshot credit once and open tier 1", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x4-open")
    const need = stakeMinOf(host, "NVDA")
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = []
    const port = livePort(host, wallet, book, rows)
    const prior = rememberEnv(["CORPORATOR_STOCK_NVDA", "CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STOCK_NVDA"] = padAddr(8n)
    process.env["CORPORATOR_STAKE_REGISTRY"] = padAddr(9n)
    try {
      const prepared = await prepareStake(host, cityId, "x4-prep", need, headers, port)
      expect(asText(bodyOf(prepared.body)["phase"])).toBe("prepared")
      const approveHash = "0x" + "11".repeat(32)
      const stakeHash = "0x" + "22".repeat(32)
      book.set(approveHash, { to: padAddr(8n), data: dataApprove(padAddr(9n), need) })
      book.set(stakeHash, { to: padAddr(9n), data: dataStake(wallet, "NVDA", need) })
      rows.push({ ticker: "NVDA", amount: need })
      const t = asBigint(host.state["city_time"])
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "x4-ok",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "x4-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(settledOf(city, "NVDA")).toBe(need)
      expect(chainOf(city, "NVDA")).toBe(need)
      expect(heldOf(city, "NVDA")).toBe(0n)
      expect(opened(city)).toContain("compute")
      expect(asBigint(asEngineDict(city["district_tiers"])["compute"], 0n)).toBe(1n)
      await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
      expect(settledOf(city, "NVDA")).toBe(need)
      expect(chainOf(city, "NVDA")).toBe(need)
    } finally {
      restoreEnv(prior)
    }
  })

  it("a sync between mining and confirm does not credit twice", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x4-between")
    const need = stakeMinOf(host, "NVDA")
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = [{ ticker: "NVDA", amount: need }]
    const port = livePort(host, wallet, book, rows)
    const prior = rememberEnv(["CORPORATOR_STOCK_NVDA", "CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STOCK_NVDA"] = padAddr(8n)
    process.env["CORPORATOR_STAKE_REGISTRY"] = padAddr(9n)
    try {
      expect(asText(bodyOf((await prepareStake(host, cityId, "x4-b-prep", need, headers, port)).body)["phase"])).toBe("prepared")
      await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
      expect(settledOf(city, "NVDA")).toBe(need)
      expect(opened(city)).toContain("compute")
      const approveHash = "0x" + "31".repeat(32)
      const stakeHash = "0x" + "32".repeat(32)
      book.set(approveHash, { to: padAddr(8n), data: dataApprove(padAddr(9n), need) })
      book.set(stakeHash, { to: padAddr(9n), data: dataStake(wallet, "NVDA", need) })
      const t = asBigint(host.state["city_time"])
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "x4-b-ok",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "x4-b-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(settledOf(city, "NVDA")).toBe(need)
      expect(chainOf(city, "NVDA")).toBe(need)
    } finally {
      restoreEnv(prior)
    }
  })

  it("a lagged snapshot is retryable and is not stored, then one credit lands", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x4-lag")
    const need = stakeMinOf(host, "NVDA")
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = []
    const port = livePort(host, wallet, book, rows)
    const prior = rememberEnv(["CORPORATOR_STOCK_NVDA", "CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STOCK_NVDA"] = padAddr(8n)
    process.env["CORPORATOR_STAKE_REGISTRY"] = padAddr(9n)
    try {
      expect(asText(bodyOf((await prepareStake(host, cityId, "x4-lag-prep", need, headers, port)).body)["phase"])).toBe("prepared")
      const approveHash = "0x" + "41".repeat(32)
      const stakeHash = "0x" + "42".repeat(32)
      book.set(approveHash, { to: padAddr(8n), data: dataApprove(padAddr(9n), need) })
      book.set(stakeHash, { to: padAddr(9n), data: dataStake(wallet, "NVDA", need) })
      const t = asBigint(host.state["city_time"])
      const lagged = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "x4-lag-ok",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "x4-lag-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      const lagBody = bodyOf(lagged.body)
      expect(asText(lagBody["code"])).toBe(codes.CHAIN_TX_UNCONFIRMED)
      expect(asBigint(lagBody["retryable"])).toBe(1n)
      expect(settledOf(city, "NVDA")).toBe(0n)
      expect(await getBytes(host.store, "intents", chainTxKey(stakeHash))).toBeUndefined()
      expect(await getBytes(host.store, "intents", cityId + ":x4-lag-ok")).toBeUndefined()
      rows.push({ ticker: "NVDA", amount: need })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "x4-lag-ok",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "x4-lag-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(settledOf(city, "NVDA")).toBe(need)
      expect(chainOf(city, "NVDA")).toBe(need)
      await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
      expect(settledOf(city, "NVDA")).toBe(need)
    } finally {
      restoreEnv(prior)
    }
  })

  it("ledger stake is refused on the live port and still moves tokens on the mock", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    city["wallet"] = padAddr(7n)
    const headers = await walletHeaders(host, cityId, "x4-ledger")
    const need = stakeMinOf(host, "NVDA")
    city["tokens_held"] = {}
    const t = asBigint(host.state["city_time"])
    const live = livePort(host, padAddr(7n), new Map(), [])
    const refused = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "stake",
      canonical({ intent_id: "x4-ledger-live", expected_city_time: t, source: "ledger", ticker: "NVDA", amount: need }),
      headers,
      undefined,
      live,
    )
    expect(asText(bodyOf(refused.body)["code"])).toBe(codes.STAKE_LEDGER_LIVE)
    expect(settledOf(city, "NVDA")).toBe(0n)
    expect(heldOf(city, "NVDA")).toBe(0n)
    const omitted = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "stake",
      canonical({ intent_id: "x4-ledger-empty", expected_city_time: t, ticker: "NVDA", amount: need }),
      headers,
      undefined,
      live,
    )
    expect(asText(bodyOf(omitted.body)["code"])).toBe(codes.STAKE_LEDGER_LIVE)
    expect(heldOf(city, "NVDA")).toBe(0n)
    city["tokens_held"] = { NVDA: need }
    const mock = createMockPort(portCfgFromPack(host.ctx.pack))
    const moved = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "stake",
      canonical({ intent_id: "x4-ledger-mock", expected_city_time: t, source: "ledger", ticker: "NVDA", amount: need }),
      headers,
      undefined,
      mock,
    )
    expect(asText(bodyOf(moved.body)["code"])).toBe("")
    expect(settledOf(city, "NVDA")).toBe(need)
    expect(heldOf(city, "NVDA")).toBe(0n)
    expect(opened(city)).toContain("compute")
  })

  it("a snapshot that falls to zero freezes the district and does not make stake negative", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    city["wallet"] = padAddr(7n)
    const need = stakeMinOf(host, "NVDA")
    const rows: { ticker: string; amount: bigint }[] = [{ ticker: "NVDA", amount: need }]
    const port = livePort(host, padAddr(7n), new Map(), rows)
    await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
    expect(settledOf(city, "NVDA")).toBe(need)
    expect(opened(city)).toContain("compute")
    rows.length = 0
    await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
    expect(settledOf(city, "NVDA")).toBe(0n)
    expect(chainOf(city, "NVDA")).toBe(0n)
    expect(heldOf(city, "NVDA")).toBe(0n)
    const grace = asBigint(host.ctx.cfg["unstake_grace_city_hours"])
    expect(asBigint(asEngineDict(city["district_freeze_until"])["NVDA"], 0n)).toBe(asBigint(host.state["city_time"]) + grace)
  })

  it("an unknown snapshot ticker is skipped and the known row still applies", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    city["wallet"] = padAddr(7n)
    const need = stakeMinOf(host, "NVDA")
    const rows = [
      { ticker: "NOPE", amount: need },
      { ticker: "NVDA", amount: need },
    ]
    const port = livePort(host, padAddr(7n), new Map(), rows)
    await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
    expect(settledOf(city, "NVDA")).toBe(need)
    expect(chainOf(city, "NVDA")).toBe(need)
    expect(settledOf(city, "NOPE")).toBe(0n)
    expect(chainOf(city, "NOPE")).toBe(0n)
  })

  it("a chain drop larger than stake_settled is journaled once and tokens stay on the live port", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["tokens_held"] = { NVDA: 50n }
    city["stake_settled"] = { NVDA: 40n }
    city["stake_chain"] = { NVDA: 100n }
    city["codes"] = []
    applyChainRows(host.ctx, host.state, city, [], false)
    expect(settledOf(city, "NVDA")).toBe(0n)
    expect(chainOf(city, "NVDA")).toBe(0n)
    expect(heldOf(city, "NVDA")).toBe(0n)
    expect(codeCount(city, codes.STAKE_BELOW_THRESHOLD)).toBe(1)
    city["tokens_held"] = { NVDA: 50n }
    city["stake_settled"] = { NVDA: 40n }
    city["stake_chain"] = { NVDA: 100n }
    city["codes"] = []
    applyChainRows(host.ctx, host.state, city, [], true)
    expect(settledOf(city, "NVDA")).toBe(0n)
    expect(heldOf(city, "NVDA")).toBe(50n)
    expect(codeCount(city, codes.STAKE_BELOW_THRESHOLD)).toBe(1)
    applyChainRows(host.ctx, host.state, city, [], true)
    expect(codeCount(city, codes.STAKE_BELOW_THRESHOLD)).toBe(1)
    expect(settledOf(city, "NVDA")).toBe(0n)
  })

  it("snapshot silence is not stored as a stake credit", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x4-silent")
    const need = stakeMinOf(host, "NVDA")
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const port = livePort(host, wallet, book, [], false)
    const prior = rememberEnv(["CORPORATOR_STOCK_NVDA", "CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STOCK_NVDA"] = padAddr(8n)
    process.env["CORPORATOR_STAKE_REGISTRY"] = padAddr(9n)
    try {
      expect(asText(bodyOf((await prepareStake(host, cityId, "x4-s-prep", need, headers, port)).body)["phase"])).toBe("prepared")
      const approveHash = "0x" + "51".repeat(32)
      const stakeHash = "0x" + "52".repeat(32)
      book.set(approveHash, { to: padAddr(8n), data: dataApprove(padAddr(9n), need) })
      book.set(stakeHash, { to: padAddr(9n), data: dataStake(wallet, "NVDA", need) })
      const t = asBigint(host.state["city_time"])
      const silent = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "x4-s-ok",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "x4-s-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(silent.body)["code"])).toBe(codes.SERVICE_DEGRADED)
      expect(settledOf(city, "NVDA")).toBe(0n)
      expect(await getBytes(host.store, "intents", chainTxKey(stakeHash))).toBeUndefined()
    } finally {
      restoreEnv(prior)
    }
  })
})

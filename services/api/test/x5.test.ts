import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  dataRequestUnstake,
  transportFromPort,
  type AssetPort,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { chainTxKey } from "../src/commit_bank.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { projectState, syncStakeSnapshot } from "../src/project.ts"
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
      async snapshot() {
        return { ok: true, rows }
      },
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

describe("X5 unstake recipe", () => {
  it("prepare returns one requestUnstake and confirm freezes the district without touching tokens", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x5-open")
    const need = stakeMinOf(host, "NVDA")
    city["stake_settled"] = { NVDA: need }
    city["stake_chain"] = { NVDA: need }
    city["tokens_held"] = { NVDA: 0n }
    const registry = padAddr(9n)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = [{ ticker: "NVDA", amount: need }]
    const cooling: Cooling[] = []
    const blockTime = 1_000n
    const port = livePort(host, wallet, book, rows, cooling, blockTime)
    const prior = rememberEnv(["CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const t = asBigint(host.state["city_time"])
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({ intent_id: "x5-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount: need }),
        headers,
        undefined,
        port,
      )
      const prep = bodyOf(prepared.body)
      expect(asText(prep["phase"])).toBe("prepared")
      const txs = prep["txs"]
      expect(Array.isArray(txs)).toBe(true)
      if (!Array.isArray(txs) || txs.length !== 1) throw new Error("txs")
      const tx = asObj(txs[0])
      const data = dataRequestUnstake("NVDA", need)
      expect(asText(tx["to"]).toLowerCase()).toBe(registry)
      expect(asText(tx["data"])).toBe(data)
      expect(asBigint(prep["cooldown_s"])).toBe(asBigint(walk(host.ctx.pack, ["generated", "api", "unstake_cooldown_s"])))
      expect(asBigint(prep["cooldown_s"])).toBe(2_700_000n)
      expect(settledOf(city, "NVDA")).toBe(need)
      const hash = "0x" + "61".repeat(32)
      book.set(hash, { to: registry, data })
      rows.length = 0
      cooling.push({ ticker: "NVDA", amount: need, readyAtS: blockTime + 2_700_000n })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({
          intent_id: "x5-ok",
          expected_city_time: t,
          phase: "confirm",
          ticket: "x5-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(settledOf(city, "NVDA")).toBe(0n)
      expect(chainOf(city, "NVDA")).toBe(0n)
      expect(heldOf(city, "NVDA")).toBe(0n)
      const grace = asBigint(host.ctx.cfg["unstake_grace_city_hours"])
      expect(grace).toBe(24n)
      expect(asBigint(asEngineDict(city["district_freeze_until"])["NVDA"], 0n)).toBe(t + grace)
      const cool = asEngineDict(asEngineDict(city["unstake_cooldown"])["NVDA"])
      expect(asBigint(cool["amount"])).toBe(need)
      expect(asBigint(cool["ready_at_s"])).toBe(blockTime + 2_700_000n)
      const again = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({
          intent_id: "x5-ok-2",
          expected_city_time: t,
          phase: "confirm",
          ticket: "x5-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      expect(fromUtf8(again.body)).toBe(fromUtf8(confirmed.body))
      expect(settledOf(city, "NVDA")).toBe(0n)
      expect(heldOf(city, "NVDA")).toBe(0n)
    } finally {
      restoreEnv(prior)
    }
  })

  it("confirm with foreign calldata is refused and stake stays", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x5-bad")
    const need = stakeMinOf(host, "NVDA")
    city["stake_settled"] = { NVDA: need }
    city["stake_chain"] = { NVDA: need }
    const registry = padAddr(9n)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows = [{ ticker: "NVDA", amount: need }]
    const port = livePort(host, wallet, book, rows, [], 1_000n)
    const prior = rememberEnv(["CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const t = asBigint(host.state["city_time"])
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({ intent_id: "x5-bad-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount: need }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(prepared.body)["phase"])).toBe("prepared")
      const hash = "0x" + "62".repeat(32)
      book.set(hash, { to: registry, data: "0xdead" })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({
          intent_id: "x5-bad-ok",
          expected_city_time: t,
          phase: "confirm",
          ticket: "x5-bad-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe(codes.API_MALFORMED)
      expect(settledOf(city, "NVDA")).toBe(need)
      expect(heldOf(city, "NVDA")).toBe(0n)
      expect(await getBytes(host.store, "intents", chainTxKey(hash))).toBeUndefined()
    } finally {
      restoreEnv(prior)
    }
  })

  it("an unripe bucket is announced before the signature and a ripe one is journaled once", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x5-restart")
    const need = stakeMinOf(host, "NVDA")
    city["stake_settled"] = { NVDA: need }
    city["stake_chain"] = { NVDA: need }
    const registry = padAddr(9n)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = [{ ticker: "NVDA", amount: need }]
    const cooling: Cooling[] = [{ ticker: "NVDA", amount: 10n, readyAtS: 5_000n }]
    const blockTime = 1_000n
    const port = livePort(host, wallet, book, rows, cooling, blockTime)
    const prior = rememberEnv(["CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const t = asBigint(host.state["city_time"])
      const take = 5n
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({ intent_id: "x5-re-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount: take }),
        headers,
        undefined,
        port,
      )
      const prep = bodyOf(prepared.body)
      expect(asText(prep["phase"])).toBe("prepared")
      expect(asBigint(prep["restarts_timer"])).toBe(1n)
      expect(asBigint(prep["ready_at_s"])).toBe(5_000n)
      const txs = prep["txs"]
      expect(Array.isArray(txs) && txs.length === 1).toBe(true)
      expect(settledOf(city, "NVDA")).toBe(need)
    } finally {
      restoreEnv(prior)
    }
  })

  it("a ripe bucket paid inside the request is journaled as unstake_claimed", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x5-claim")
    const need = stakeMinOf(host, "NVDA")
    city["stake_settled"] = { NVDA: need }
    city["stake_chain"] = { NVDA: need }
    const registry = padAddr(9n)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = [{ ticker: "NVDA", amount: need }]
    const cooling: Cooling[] = [{ ticker: "NVDA", amount: 10n, readyAtS: 500n }]
    const blockTime = 1_000n
    const port = livePort(host, wallet, book, rows, cooling, blockTime)
    const prior = rememberEnv(["CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const t = asBigint(host.state["city_time"])
      const take = 5n
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({ intent_id: "x5-cl-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount: take }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(prepared.body)["phase"])).toBe("prepared")
      expect(bodyOf(prepared.body)["restarts_timer"]).toBeUndefined()
      const data = dataRequestUnstake("NVDA", take)
      const hash = "0x" + "63".repeat(32)
      book.set(hash, { to: registry, data })
      rows[0] = { ticker: "NVDA", amount: need - take }
      cooling[0] = { ticker: "NVDA", amount: take, readyAtS: blockTime + 2_700_000n }
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({
          intent_id: "x5-cl-ok",
          expected_city_time: t,
          phase: "confirm",
          ticket: "x5-cl-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(claimedOf(city, "NVDA")).toBe(10n)
      expect(asBigint(asEngineDict(asEngineDict(city["unstake_cooldown"])["NVDA"])["amount"])).toBe(take)
      expect(heldOf(city, "NVDA")).toBe(0n)
      expect(settledOf(city, "NVDA")).toBe(need - take)
    } finally {
      restoreEnv(prior)
    }
  })

  it("a direct requestUnstake is reconciled by sync and projected without crediting tokens", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    city["wallet"] = padAddr(7n)
    const need = stakeMinOf(host, "NVDA")
    city["stake_settled"] = { NVDA: need }
    city["stake_chain"] = { NVDA: need }
    city["tokens_held"] = { NVDA: 0n }
    const left = need - 1n
    const rows = [{ ticker: "NVDA", amount: left }, { ticker: "NOPE", amount: 9n }]
    const ready = 9_000n
    const cooling: Cooling[] = [
      { ticker: "NOPE", amount: 9n, readyAtS: ready },
      { ticker: "NVDA", amount: 1n, readyAtS: ready },
    ]
    const port = livePort(host, padAddr(7n), new Map(), rows, cooling, 1_000n)
    await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
    expect(settledOf(city, "NVDA")).toBe(left)
    expect(chainOf(city, "NVDA")).toBe(left)
    expect(heldOf(city, "NVDA")).toBe(0n)
    expect(asBigint(asEngineDict(asEngineDict(city["unstake_cooldown"])["NVDA"])["amount"])).toBe(1n)
    expect(asBigint(asEngineDict(asEngineDict(city["unstake_cooldown"])["NOPE"])["amount"], 0n)).toBe(0n)
    const envelope = asObj(projectState(host.ctx, host.state, cityId, []))
    const buildings = asObj(asObj(envelope["sections"])["tick.building_level"])
    const projected = asObj(asObj(buildings["unstake_cooldown"])["NVDA"])
    expect(asBigint(projected["amount"])).toBe(1n)
    expect(asBigint(projected["ready_at_s"])).toBe(ready)
  })

  it("a lagged snapshot is retryable and is not stored", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x5-lag")
    const need = stakeMinOf(host, "NVDA")
    city["stake_settled"] = { NVDA: need }
    city["stake_chain"] = { NVDA: need }
    const registry = padAddr(9n)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = [{ ticker: "NVDA", amount: need }]
    const cooling: Cooling[] = []
    const port = livePort(host, wallet, book, rows, cooling, 1_000n)
    const prior = rememberEnv(["CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const t = asBigint(host.state["city_time"])
      expect(
        asText(
          bodyOf(
            (
              await handleCommand(
                host.ctx,
                host.store,
                host.state,
                "unstake",
                canonical({ intent_id: "x5-lag-prep", expected_city_time: t, phase: "prepare", ticker: "NVDA", amount: need }),
                headers,
                undefined,
                port,
              )
            ).body,
          )["phase"],
        ),
      ).toBe("prepared")
      const hash = "0x" + "64".repeat(32)
      book.set(hash, { to: registry, data: dataRequestUnstake("NVDA", need) })
      const lagged = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({
          intent_id: "x5-lag-ok",
          expected_city_time: t,
          phase: "confirm",
          ticket: "x5-lag-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      const lagBody = bodyOf(lagged.body)
      expect(asText(lagBody["code"])).toBe(codes.CHAIN_TX_UNCONFIRMED)
      expect(asBigint(lagBody["retryable"])).toBe(1n)
      expect(settledOf(city, "NVDA")).toBe(need)
      expect(await getBytes(host.store, "intents", chainTxKey(hash))).toBeUndefined()
      expect(await getBytes(host.store, "intents", cityId + ":x5-lag-ok")).toBeUndefined()
      rows.length = 0
      cooling.push({ ticker: "NVDA", amount: need, readyAtS: 1_000n + 2_700_000n })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "unstake",
        canonical({
          intent_id: "x5-lag-ok",
          expected_city_time: t,
          phase: "confirm",
          ticket: "x5-lag-prep",
          tx_hashes: [hash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      expect(settledOf(city, "NVDA")).toBe(0n)
      expect(heldOf(city, "NVDA")).toBe(0n)
    } finally {
      restoreEnv(prior)
    }
  })
})

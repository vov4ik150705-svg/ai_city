import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  err,
  transportFromPort,
  type AssetPort,
  type TxLog,
} from "@corporator/chainport"
import { assertI1 } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { reconcileChainCredits } from "../src/reorg.ts"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk, type Dict } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>
type Mined = {
  readonly status: bigint
  readonly from: string
  readonly to: string
  readonly input: string
  readonly logs: readonly TxLog[]
}

const WALLET = "0x" + "7".repeat(40)
const CORP = "0x" + "1".repeat(40)
const VAULT = "0x" + "2".repeat(40)

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function cityOf(host: Host): Dict {
  return asEngineDict(asEngineDict(host.state["cities"])["a"])
}

let hashN = 0
function nextHash(): string {
  hashN += 1
  return "0x" + hashN.toString(16).padStart(64, "0")
}

function mine(book: Map<string, Mined>, from: string, to: string, data: string): string {
  const hash = nextHash()
  book.set(hash, { status: 1n, from, to, input: data, logs: [] })
  return hash
}

function txRows(body: { readonly [key: string]: Json }): { readonly to: string; readonly data: string }[] {
  const raw = body["txs"]
  if (!Array.isArray(raw)) throw new Error("txs")
  const out: { readonly to: string; readonly data: string }[] = []
  for (const item of raw) {
    const row = asObj(item)
    out.push({ to: asText(row["to"]), data: asText(row["data"]) })
  }
  return out
}

function sawReorg(city: Dict): boolean {
  const raw = city["ledger_journal"]
  if (!Array.isArray(raw)) return false
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    if (asText(asObj(item)["code"]) === "CHAIN_REORG") return true
  }
  return false
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

function fixture(host: Host, corp: bigint): {
  readonly port: AssetPort
  readonly book: Map<string, Mined>
  readonly gone: Set<string>
  readonly floor: { amount: bigint }
} {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const inner = createMockPort(cfg, { corp: { [WALLET]: corp } })
  const book = new Map<string, Mined>()
  const gone = new Set<string>()
  const floor = { amount: 0n }
  const wrapped: AssetPort = {
    ...inner,
    vault: {
      ...inner.vault,
      async backingOf(account: string) {
        if (floor.amount > 0n) return amountOk(floor.amount)
        return inner.vault.backingOf(account)
      },
    },
    chain: {
      ...inner.chain,
      async latestBlockTime() {
        return amountOk(1_000_000n)
      },
      async transactionReceipt(hash: string) {
        const key = hash.toLowerCase()
        if (gone.has(key)) return err(codes.CHAIN_TX_UNCONFIRMED)
        const tx = book.get(key)
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, ...tx }
      },
      async transactionByHash(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, ...tx }
      },
    },
  }
  return { port: createRpcPort(cfg, transportFromPort(wrapped, chain)), book, gone, floor }
}

async function walletHeaders(host: Host, sessionId: string) {
  const city = cityOf(host)
  city["account_kind"] = "wallet"
  city["wallet"] = WALLET
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

async function command(
  host: Host,
  port: AssetPort,
  intentId: string,
  extra: { readonly [key: string]: Json },
): Promise<{ readonly [key: string]: Json }> {
  const headers = await walletHeaders(host, intentId)
  const res = await handleCommand(
    host.ctx,
    host.store,
    host.state,
    "deposit",
    canonical({ intent_id: intentId, expected_city_time: asBigint(host.state["city_time"]), ...extra }),
    headers,
    undefined,
    port,
  )
  return bodyOf(res.body)
}

async function armDeposit(host: Host, port: AssetPort, book: Map<string, Mined>, tag: string): Promise<{
  readonly hashes: string[]
  readonly before: bigint
  readonly vaultBefore: bigint
}> {
  const before = asBigint(cityOf(host)["capital"], 0n)
  const vaultBefore = asBigint(host.state["vault_corp"], 0n)
  const amount = asBigint(host.ctx.cfg["wei"])
  const prepared = await command(host, port, tag, { phase: "prepare", amount })
  expect(asText(prepared["code"])).toBe("")
  const hashes: string[] = []
  for (const tx of txRows(prepared)) hashes.push(mine(book, WALLET, tx.to, tx.data))
  return { hashes, before, vaultBefore }
}

describe("PL11 chain reorg", () => {
  it("a vanished deposit receipt removes Capital and blocks the same hash", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_CORP_TOKEN", "CORPORATOR_VAULT"])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    const built = fixture(host, asBigint(host.ctx.cfg["wei"]) * 4n)
    try {
      const armed = await armDeposit(host, built.port, built.book, "pl11-vanish")
      const deposited = await command(host, built.port, "pl11-vanish-ok", {
        phase: "confirm",
        ticket: "pl11-vanish",
        tx_hashes: armed.hashes,
      })
      expect(asText(deposited["code"])).toBe("")
      const minted = asBigint(cityOf(host)["capital"], 0n)
      expect(minted > armed.before).toBe(true)
      const last = armed.hashes.at(armed.hashes.length - 1)
      if (last === undefined) throw new Error("hash")
      built.gone.add(last.toLowerCase())
      await reconcileChainCredits(host, built.port)
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(armed.before)
      expect(asBigint(host.state["vault_corp"], 0n)).toBe(armed.vaultBefore)
      expect(sawReorg(cityOf(host))).toBe(true)
      assertI1(host.ctx.cfg, host.state, "a")
      const again = await command(host, built.port, "pl11-vanish-again", {
        phase: "confirm",
        ticket: "pl11-vanish",
        tx_hashes: armed.hashes,
      })
      expect(asText(again["code"])).toBe("CHAIN_REORG")
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(armed.before)
      built.gone.delete(last.toLowerCase())
      await reconcileChainCredits(host, built.port)
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(minted)
      await reconcileChainCredits(host, built.port)
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(minted)
      assertI1(host.ctx.cfg, host.state, "a")
    } finally {
      restoreEnv(prior)
    }
  })

  it("a deposit receipt that stays is counted once", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_CORP_TOKEN", "CORPORATOR_VAULT"])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    const built = fixture(host, asBigint(host.ctx.cfg["wei"]) * 4n)
    try {
      expect(asBigint(walk(host.ctx.pack, ["sections", "api", "params", "chain_min_confirmations", "v"]))).toBe(1n)
      const armed = await armDeposit(host, built.port, built.book, "pl11-stay")
      const deposited = await command(host, built.port, "pl11-stay-ok", {
        phase: "confirm",
        ticket: "pl11-stay",
        tx_hashes: armed.hashes,
      })
      expect(asText(deposited["code"])).toBe("")
      const minted = asBigint(cityOf(host)["capital"], 0n)
      await reconcileChainCredits(host, built.port)
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(minted)
      const again = await command(host, built.port, "pl11-stay-again", {
        phase: "confirm",
        ticket: "pl11-stay",
        tx_hashes: armed.hashes,
      })
      expect(asText(again["code"])).toBe("")
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(minted)
      assertI1(host.ctx.cfg, host.state, "a")
    } finally {
      restoreEnv(prior)
    }
  })

  it("two deposit confirms with status 1 do not mint twice", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_CORP_TOKEN", "CORPORATOR_VAULT"])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    const built = fixture(host, asBigint(host.ctx.cfg["wei"]) * 4n)
    try {
      const armed = await armDeposit(host, built.port, built.book, "pl11-twice")
      const first = await command(host, built.port, "pl11-twice-ok", {
        phase: "confirm",
        ticket: "pl11-twice",
        tx_hashes: armed.hashes,
      })
      expect(asText(first["code"])).toBe("")
      const minted = asBigint(cityOf(host)["capital"], 0n)
      const second = await command(host, built.port, "pl11-twice-replay", {
        phase: "confirm",
        ticket: "pl11-twice",
        tx_hashes: armed.hashes,
      })
      expect(asText(second["code"])).toBe("")
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(minted)
      expect(minted > armed.before).toBe(true)
    } finally {
      restoreEnv(prior)
    }
  })

  it("a silent receipt does not remove Capital", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_CORP_TOKEN", "CORPORATOR_VAULT"])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    const built = fixture(host, asBigint(host.ctx.cfg["wei"]) * 4n)
    try {
      const armed = await armDeposit(host, built.port, built.book, "pl11-silence")
      const deposited = await command(host, built.port, "pl11-silence-ok", {
        phase: "confirm",
        ticket: "pl11-silence",
        tx_hashes: armed.hashes,
      })
      expect(asText(deposited["code"])).toBe("")
      const minted = asBigint(cityOf(host)["capital"], 0n)
      const last = armed.hashes.at(armed.hashes.length - 1)
      if (last === undefined) throw new Error("hash")
      built.book.delete(last.toLowerCase())
      await reconcileChainCredits(host, built.port)
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(minted)
      expect(sawReorg(cityOf(host))).toBe(false)
      assertI1(host.ctx.cfg, host.state, "a")
    } finally {
      restoreEnv(prior)
    }
  })

  it("a vanished receipt does not burn vault below chain backing", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_CORP_TOKEN", "CORPORATOR_VAULT"])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    const built = fixture(host, asBigint(host.ctx.cfg["wei"]) * 4n)
    try {
      const armed = await armDeposit(host, built.port, built.book, "pl11-floor")
      const deposited = await command(host, built.port, "pl11-floor-ok", {
        phase: "confirm",
        ticket: "pl11-floor",
        tx_hashes: armed.hashes,
      })
      expect(asText(deposited["code"])).toBe("")
      const minted = asBigint(cityOf(host)["capital"], 0n)
      const vault = asBigint(host.state["vault_corp"], 0n)
      built.floor.amount = vault
      const last = armed.hashes.at(armed.hashes.length - 1)
      if (last === undefined) throw new Error("hash")
      built.gone.add(last.toLowerCase())
      await reconcileChainCredits(host, built.port)
      expect(asBigint(host.state["vault_corp"], 0n) >= built.floor.amount).toBe(true)
      expect(asBigint(cityOf(host)["capital"], 0n)).toBe(minted)
      expect(sawReorg(cityOf(host))).toBe(false)
      assertI1(host.ctx.cfg, host.state, "a")
    } finally {
      restoreEnv(prior)
    }
  })
})

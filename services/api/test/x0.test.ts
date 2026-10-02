import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { bankOpen, cityClock } from "@corporator/engine"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  dataApprove,
  dataPrizeClaim,
  dataStake,
  err,
  PRIZE_KETTLE_FARM,
  PRIZE_KETTLE_MONTH,
  transportFromPort,
  type AssetPort,
} from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { launchDeployed, prepareClaimPrize } from "../src/commit_prize.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { type PackCtx } from "../src/pack_ctx.ts"
import { syncStakeSnapshot } from "../src/project.ts"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { bootHost, seedPlayerCapital } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

const DEPLOYED_KEYS = ["token", "curve", "pool", "hook", "tx"] as const

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function cityOf(host: Host, cityId: string) {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function stakeMinOf(host: Host, ticker: string): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

function openBankTick(host: Host): bigint {
  const closed = asBigint(host.ctx.cfg["bank_closed_weekday"])
  let i = 0n
  while (i < 2000n) {
    const clock = cityClock(host.ctx.cfg, i)
    const hour = clock[1]
    const weekday = clock[2]
    if (weekday !== closed && bankOpen(host.ctx.cfg, hour, weekday) !== 0n) return i
    i += 1n
  }
  return 0n
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

/** Fixture RPC port. Chain substitution is the w10 book/rows pattern. */
function livePort(
  host: Host,
  wallet: string,
  book: ReadonlyMap<string, { readonly to: string; readonly data: string }>,
  rows: readonly { readonly ticker: string; readonly amount: bigint }[],
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
        return { ok: true, rows }
      },
    },
    chain: {
      async transactionReceipt(hash: string) {
        const known = book.has(hash.toLowerCase())
        return { ok: true, status: known ? 1n : 0n, from: wallet, to: "", input: "" }
      },
      async transactionByHash(hash: string) {
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
      async latestBlockTime() {
        return amountOk(1000n)
      },
    },
  }
}

function withLaunchFilled(ctx: PackCtx): PackCtx {
  const pack = structuredClone(ctx.pack)
  const deployed = asObj(walk(pack, ["sections", "launch", "deployed"])) as { [key: string]: Json }
  let n = 1n
  for (const key of DEPLOYED_KEYS) {
    n += 1n
    deployed[key] = padAddr(n)
  }
  return { ...ctx, pack }
}

function prizeAssetsOf(pack: Json): string[] {
  const raw = walk(pack, ["generated", "seasons", "prize_assets"])
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

type OwedPair = { readonly token: string; readonly kettle: bigint; readonly owed: bigint }

function zeroOwedClaims(txs: Json | undefined, pairs: readonly OwedPair[]): number {
  if (!Array.isArray(txs)) return 0
  let bad = 0
  for (const item of txs) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    if (asText(item["label"]) !== "claim") continue
    const data = asText(item["data"]).toLowerCase()
    let matched = false
    for (const pair of pairs) {
      const want = dataPrizeClaim(pair.token, pair.kettle).toLowerCase()
      if (want.length === 0 || data !== want) continue
      matched = true
      if (pair.owed === 0n) bad += 1
    }
    if (!matched) bad += 1
  }
  return bad
}

describe("X0 withdraw diagnosis", () => {
  it("live withdraw does not increase corp_held", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    host.state["tick_index"] = openBankTick(host)
    const capital = seedPlayerCapital(host, cityId, 50n)
    expect(capital >= 50n).toBe(true)
    const headers = await walletHeaders(host, cityId, "x0-withdraw")
    const port = livePort(host, wallet, new Map(), [])
    expect(port.kind).toBe("rpc")
    const before = asBigint(city["corp_held"], 0n)
    const t = asBigint(host.state["city_time"])
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      canonical({ intent_id: "x0-withdraw", expected_city_time: t, amount: 10n }),
      headers,
      undefined,
      port,
    )
    const body = bodyOf(res.body)
    expect(asText(body["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(asBigint(city["corp_held"], 0n)).toBe(before)
  })

  // X4: the caught-up snapshot is visible at confirm; a later sync of the same rows does not credit twice.
  it("wallet stake confirm then the same snapshot keeps stake_settled", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    const wallet = padAddr(7n)
    city["wallet"] = wallet
    const headers = await walletHeaders(host, cityId, "x0-stake")
    const need = stakeMinOf(host, "NVDA")
    expect(need > 0n).toBe(true)
    const book = new Map<string, { readonly to: string; readonly data: string }>()
    const rows: { ticker: string; amount: bigint }[] = []
    const port = livePort(host, wallet, book, rows)
    expect(port.kind).toBe("rpc")
    const token = padAddr(8n)
    const registry = padAddr(9n)
    const prior = rememberEnv(["CORPORATOR_STOCK_NVDA", "CORPORATOR_STAKE_REGISTRY"])
    process.env["CORPORATOR_STOCK_NVDA"] = token
    process.env["CORPORATOR_STAKE_REGISTRY"] = registry
    try {
      const t = asBigint(host.state["city_time"])
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "x0-prep",
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
      expect(asText(bodyOf(prepared.body)["phase"]), asText(bodyOf(prepared.body)["code"])).toBe("prepared")
      const approveHash = "0x" + "55".repeat(32)
      const stakeHash = "0x" + "44".repeat(32)
      book.set(approveHash, { to: token, data: dataApprove(registry, need) })
      book.set(stakeHash, { to: registry, data: dataStake(wallet, "NVDA", need) })
      rows.push({ ticker: "NVDA", amount: need })
      const confirmed = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "stake",
        canonical({
          intent_id: "x0-ok",
          expected_city_time: t,
          phase: "confirm",
          source: "wallet",
          ticket: "x0-prep",
          tx_hashes: [approveHash, stakeHash],
        }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(confirmed.body)["code"]), "stake confirm refused").toBe("")
      expect(asBigint(asEngineDict(city["stake_settled"])["NVDA"], 0n)).toBe(need)
      await syncStakeSnapshot(host.ctx, host.store, host.state, cityId, port)
      expect(asBigint(asEngineDict(city["stake_settled"])["NVDA"], 0n)).toBe(need)
    } finally {
      restoreEnv(prior)
    }
  })

  it("prepareClaimPrize skips a claim when owed is zero", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    city["wallet"] = padAddr(7n)
    city["prize_owed"] = {}
    const ctx = withLaunchFilled(host.ctx)
    expect(launchDeployed(ctx)).toBe(true)
    const assets = prizeAssetsOf(ctx.pack)
    expect(assets.length > 0).toBe(true)
    const names = ["CORPORATOR_PRIZE_TREASURY"]
    for (const asset of assets) names.push("CORPORATOR_STOCK_" + asset)
    const prior = rememberEnv(names)
    const pairs: OwedPair[] = []
    let n = 20n
    process.env["CORPORATOR_PRIZE_TREASURY"] = padAddr(4n)
    for (const asset of assets) {
      const token = padAddr(n)
      n += 1n
      process.env["CORPORATOR_STOCK_" + asset] = token
      pairs.push({ token, kettle: PRIZE_KETTLE_FARM, owed: 0n })
      pairs.push({ token, kettle: PRIZE_KETTLE_MONTH, owed: 0n })
    }
    const base = livePort(host, padAddr(7n), new Map(), [])
    const port: AssetPort = {
      ...base,
      prizeTreasury: {
        ...base.prizeTreasury,
        async owed(kettle, token) {
          for (const pair of pairs) {
            if (pair.kettle === kettle && pair.token.toLowerCase() === token.toLowerCase()) return amountOk(pair.owed)
          }
          return amountOk(0n)
        },
      },
    }
    try {
      const result = await prepareClaimPrize(
        ctx,
        host.store,
        host.state,
        city,
        cityId,
        "x0-prize",
        asBigint(host.state["city_time"]),
        port,
      )
      const body = bodyOf(result.body)
      expect(asText(body["code"])).toBe(codes.PRIZE_NOTHING_OWED)
      expect(body["phase"]).toBeUndefined()
      expect(zeroOwedClaims(body["txs"], pairs)).toBe(0)
    } finally {
      restoreEnv(prior)
    }
  })
})

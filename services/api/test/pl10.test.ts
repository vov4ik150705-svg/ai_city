import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import {
  amountOk,
  createMockPort,
  createRpcPort,
  err,
  transportFromPort,
  type AssetPort,
} from "@corporator/chainport"
import { bankOpen, cityClock, keccak256Hex } from "@corporator/engine"
import { codes, listenBind, wsTemplate } from "@corporator/protocol"
import { afterEach, describe, expect, it } from "vitest"
import { withWorldLock } from "../src/city_lock.ts"
import { handleCommand } from "../src/commands.ts"
import { chainTxKey, verifyDepositConfirm } from "../src/commit_bank.ts"
import { applyLiveBuy, verifyBuyConfirm } from "../src/commit_exchange.ts"
import { confirmClaimFragment } from "../src/commit_fragments.ts"
import { prizeAssets } from "../src/commit_prize.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { listenApi } from "../src/listen.ts"
import { applyTemplate } from "../src/pack_ctx.ts"
import { projectState } from "../src/project.ts"
import { getBytes, putBytes, putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk, type Dict } from "../src/values.ts"
import { bootHost, demoAuth, seedPlayerCapital } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

const WALLET = "0x" + "7".repeat(40)
const CORP = "0x" + "1".repeat(40)
const VAULT = "0x" + "2".repeat(40)
const STOCK = "0x" + "5".repeat(40)
const HOP = "0x" + "3".repeat(40)
const BUY_DATA = "0xabc"
const TRANSFER = "0x" + keccak256Hex(new TextEncoder().encode("Transfer(address,address,uint256)"))

const closers: { close(): Promise<void> }[] = []

afterEach(async () => {
  while (closers.length > 0) {
    const row = closers.pop()
    if (row === undefined) continue
    await row.close()
  }
})

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function cityOf(host: Host, cityId: string): Dict {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
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

function rpcPort(host: Host): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  return createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
}

async function walletSession(host: Host, cityId: string, sessionId: string) {
  const city = cityOf(host, cityId)
  city["account_kind"] = "wallet"
  city["wallet"] = WALLET
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

function openBank(host: Host): void {
  const closed = asBigint(host.ctx.cfg["bank_closed_weekday"])
  let i = 0n
  while (i < 2000n) {
    const clock = cityClock(host.ctx.cfg, i)
    if (clock[2] !== closed && bankOpen(host.ctx.cfg, clock[1], clock[2]) !== 0n) {
      host.state["tick_index"] = i
      return
    }
    i += 1n
  }
}

function stakeMin(host: Host, ticker: string): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

describe("PL10 api leftovers", () => {
  it("a deposit ticket survives the tick rollback", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_CORP_TOKEN", "CORPORATOR_VAULT"])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      const headers = await walletSession(host, "a", "pl10-dep-session")
      const port = rpcPort(host)
      const amount = asBigint(host.ctx.cfg["wei"])
      let release: () => void = () => {}
      const hold = new Promise<void>((resolve) => {
        release = resolve
      })
      let started: () => void = () => {}
      const ready = new Promise<void>((resolve) => {
        started = resolve
      })
      const holder = withWorldLock(async () => {
        await host.store.exec("BEGIN")
        started()
        await hold
        await host.store.exec("ROLLBACK")
      })
      await ready
      const pending = handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({
          intent_id: "pl10-dep",
          expected_city_time: asBigint(host.state["city_time"]),
          phase: "prepare",
          amount,
        }),
        headers,
        undefined,
        port,
      )
      await new Promise((resolve) => setTimeout(resolve, 150))
      release()
      const res = await pending
      await holder
      expect(asText(bodyOf(res.body)["phase"])).toBe("prepared")
      const ticket = await getBytes(host.store, "intents", "a:pl10-dep")
      expect(ticket).toBeDefined()
    } finally {
      restoreEnv(prior)
    }
  })

  it("issue silence does not store the card and the retry sends issueVoucher again", async () => {
    const host = await bootHost()
    openBank(host)
    seedPlayerCapital(host, "a", 50n)
    const headers = await walletSession(host, "a", "pl10-silence-session")
    const issues = { n: 0 }
    const port = rpcPort(host)
    const silent: AssetPort = {
      ...port,
      chain: {
        ...port.chain,
        async latestBlockTime() {
          return amountOk(1000n)
        },
      },
      vault: {
        ...port.vault,
        async issueVoucher() {
          issues.n += 1
          return { ok: true }
        },
        async issued() {
          return err(codes.SERVICE_DEGRADED)
        },
      },
    }
    const t = asBigint(host.state["city_time"])
    const before = asBigint(cityOf(host, "a")["capital"], 0n)
    const once = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      canonical({ intent_id: "pl10-silence", expected_city_time: t, amount: 10n }),
      headers,
      undefined,
      silent,
    )
    expect(asText(bodyOf(once.body)["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(asBigint(cityOf(host, "a")["capital"], 0n)).toBe(before - 10n)
    const vouchers = cityOf(host, "a")["vouchers"]
    expect(Array.isArray(vouchers)).toBe(true)
    if (!Array.isArray(vouchers)) return
    const row = asObj(vouchers[0])
    expect(asText(row["status"])).toBe("signing")
    expect(await getBytes(host.store, "intents", "a:pl10-silence")).toBeUndefined()
    const again = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      canonical({ intent_id: "pl10-silence", expected_city_time: t, amount: 10n }),
      headers,
      undefined,
      silent,
    )
    expect(asText(bodyOf(again.body)["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(issues.n).toBe(2)
    expect(asBigint(cityOf(host, "a")["capital"], 0n)).toBe(before - 10n)
  })

  it("claim_prize with an empty launch answers DEMO_NO_PRIZE", async () => {
    const host = await bootHost()
    const headers = await walletSession(host, "a", "pl10-prize-session")
    const assets = prizeAssets(host.ctx)
    expect(assets.length > 0).toBe(true)
    const owed: { [key: string]: bigint } = {}
    const first = assets[0]
    if (first === undefined) return
    owed[first] = 5n
    cityOf(host, "a")["prize_owed"] = owed
    let claims = 0
    const port = rpcPort(host)
    const spy: AssetPort = {
      ...port,
      prizeTreasury: {
        ...port.prizeTreasury,
        async claimPrize() {
          claims += 1
          return { ok: true }
        },
      },
    }
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "claim_prize",
      canonical({ intent_id: "pl10-prize", expected_city_time: asBigint(host.state["city_time"]) }),
      headers,
      undefined,
      spy,
    )
    expect(asText(bodyOf(res.body)["code"])).toBe(codes.DEMO_NO_PRIZE)
    expect(claims).toBe(0)
  })

  it("a fragment confirm with sliced 0 does not mark the hash paid", async () => {
    const host = await bootHost()
    const city = cityOf(host, "a")
    city["account_kind"] = "wallet"
    city["wallet"] = WALLET
    city["fragment_sliced"] = {}
    const hash = "0x" + "11".repeat(32)
    const res = await confirmClaimFragment(
      host.ctx,
      host.store,
      host.state,
      "a",
      "pl10-frag",
      asBigint(host.state["city_time"]),
      [{ ticker: "NVDA", amount: 5n }],
      [hash],
      undefined,
      false,
    )
    expect(asText(bodyOf(res.body)["code"])).toBe(codes.FRAGMENT_SLICE_PENDING)
    expect(asText(bodyOf(res.body)["phase"])).not.toBe("applied")
    expect(await getBytes(host.store, "intents", chainTxKey(hash))).toBeUndefined()
  })

  it("a one wei buy log does not move the pool", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_STOCK_NVDA"])
    process.env["CORPORATOR_STOCK_NVDA"] = STOCK
    try {
      const city = cityOf(host, "a")
      city["account_kind"] = "wallet"
      city["wallet"] = WALLET
      city["corp_held"] = 0n
      city["tokens_held"] = {}
      host.state["pool_eth"] = 10n ** 18n
      host.state["pool_corp"] = 10n ** 18n
      const pool = asBigint(host.state["pool_corp"])
      const ticket = "pl10-buy"
      const body = canonical({
        phase: "prepared",
        effect: "buy_stock",
        ticket,
        ticker: "NVDA",
        amount: (10n ** 18n).toString(),
        stock_out: "1000",
        txs: [{ to: HOP, data: BUY_DATA, value: "0", label: "buy" }],
      })
      await putBytes(host.store, "intents", "a:" + ticket, body, "wallet")
      const hash = "0x" + "22".repeat(32)
      const topicWallet = "0x" + WALLET.slice(2).padStart(64, "0")
      const port = rpcPort(host)
      const wrapped: AssetPort = {
        ...port,
        chain: {
          ...port.chain,
          async transactionReceipt() {
            return {
              ok: true,
              status: 1n,
              from: WALLET,
              to: HOP,
              input: BUY_DATA,
              logs: [
                {
                  address: STOCK,
                  topics: [TRANSFER, "0x" + "0".repeat(64), topicWallet],
                  data: "0x" + "1".padStart(64, "0"),
                },
              ],
            }
          },
          async transactionByHash() {
            return { ok: true, status: 1n, from: WALLET, to: HOP, input: BUY_DATA, logs: [] }
          },
        },
      }
      const checked = await verifyBuyConfirm(
        host.ctx,
        host.store,
        host.state,
        city,
        { ticket, tx_hashes: [hash] },
        "a",
        wrapped,
        true,
      )
      if (checked.ok) applyLiveBuy(host.ctx, host.state, city, checked.ticker, checked.amount, checked.delivered)
      expect(checked.ok).toBe(false)
      if (!checked.ok) expect(asText(bodyOf(checked.result.body)["code"])).toBe(codes.EXCHANGE_DELIVERY_UNVERIFIED)
      expect(asBigint(host.state["pool_corp"])).toBe(pool)
      expect(asBigint(city["corp_held"], 0n)).toBe(0n)
      expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(0n)
    } finally {
      restoreEnv(prior)
    }
  })

  it("a foreign hash does not return the other city deposit", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const copy = structuredClone(cityOf(host, "a"))
    copy["id"] = "b"
    copy["wallet"] = "0x" + "8".repeat(40)
    copy["account_kind"] = "wallet"
    copy["capital"] = 3n
    cities["b"] = copy
    const hash = "0x" + "33".repeat(32)
    const secret = canonical({ effect: "deposit", phase: "applied", amount: "999" })
    await putBytes(host.store, "intents", chainTxKey(hash), secret, "wallet")
    const city = cityOf(host, "b")
    const checked = await verifyDepositConfirm(
      host.ctx,
      host.store,
      host.state,
      city,
      { ticket: "pl10-foreign", tx_hashes: [hash] },
      "b",
      rpcPort(host),
    )
    expect(checked.ok).toBe(false)
    if (!checked.ok) {
      const body = bodyOf(checked.result.body)
      expect(asText(body["code"])).toBe(codes.API_UNAUTHORIZED)
      expect(asText(body["amount"])).not.toBe("999")
    }
    expect(asBigint(city["capital"], 0n)).toBe(3n)
  })

  it("a dirty live ledger closes the store and exits", async () => {
    const main = await import("../src/main.ts")
    const stop = main.stopDirtyLedger
    expect(typeof stop).toBe("function")
    if (typeof stop !== "function") return
    const host = await bootHost()
    const city = cityOf(host, "a")
    city["account_kind"] = "wallet"
    city["corp_held"] = 1n
    let closed = 0
    const store = {
      async close() {
        closed += 1
      },
    }
    const prior = process.exit
    let code = -1
    process.exit = ((status?: number) => {
      code = status ?? 0
      throw new Error("exit")
    }) as typeof process.exit
    try {
      await expect(stop(host.state, true, store)).rejects.toThrow("exit")
      expect(code).toBe(1)
      expect(closed).toBe(1)
    } finally {
      process.exit = prior
    }
  })

  it("mock wallet stake does not credit stake_settled", async () => {
    const host = await bootHost()
    const headers = await walletSession(host, "a", "pl10-stake-session")
    const need = stakeMin(host, "NVDA")
    expect(need > 0n).toBe(true)
    const t = asBigint(host.state["city_time"])
    const wallet = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "stake",
      canonical({ intent_id: "pl10-wallet-stake", expected_city_time: t, source: "wallet", ticker: "NVDA", amount: need }),
      headers,
    )
    expect(asText(bodyOf(wallet.body)["code"])).toBe(codes.API_MALFORMED)
    expect(asBigint(asEngineDict(cityOf(host, "a")["stake_settled"])["NVDA"], 0n)).toBe(0n)
    const held = asEngineDict(cityOf(host, "a")["tokens_held"])
    held["NVDA"] = need
    cityOf(host, "a")["tokens_held"] = held
    const ledger = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "stake",
      canonical({ intent_id: "pl10-ledger-stake", expected_city_time: t, source: "ledger", ticker: "NVDA", amount: need }),
      headers,
    )
    expect(asText(bodyOf(ledger.body)["code"])).toBe("")
    expect(asBigint(asEngineDict(cityOf(host, "a")["stake_settled"])["NVDA"], 0n)).toBe(need)
    expect(asBigint(asEngineDict(cityOf(host, "a")["tokens_held"])["NVDA"], 0n)).toBe(0n)
  })

  it("two prepares past the rate limit are refused", async () => {
    const host = await bootHost()
    const prior = rememberEnv(["CORPORATOR_CORP_TOKEN", "CORPORATOR_VAULT"])
    process.env["CORPORATOR_CORP_TOKEN"] = CORP
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      const headers = await walletSession(host, "a", "pl10-rate-session")
      const port = rpcPort(host)
      const amount = asBigint(host.ctx.cfg["wei"])
      const limit = Number(host.ctx.rateLimit)
      expect(limit > 2).toBe(true)
      const t = asBigint(host.state["city_time"])
      let i = 0
      while (i < limit) {
        const res = await handleCommand(
          host.ctx,
          host.store,
          host.state,
          "deposit",
          canonical({ intent_id: "pl10-rate-" + i.toString(), expected_city_time: t, phase: "prepare", amount }),
          headers,
          undefined,
          port,
        )
        expect(asText(bodyOf(res.body)["phase"]), "prepare " + i.toString()).toBe("prepared")
        i += 1
      }
      const overA = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({ intent_id: "pl10-rate-over-a", expected_city_time: t, phase: "prepare", amount }),
        headers,
        undefined,
        port,
      )
      const overB = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "deposit",
        canonical({ intent_id: "pl10-rate-over-b", expected_city_time: t, phase: "prepare", amount }),
        headers,
        undefined,
        port,
      )
      expect(asText(bodyOf(overA.body)["code"])).toBe(codes.API_RATE_LIMITED)
      expect(asText(bodyOf(overB.body)["code"])).toBe(codes.API_RATE_LIMITED)
      expect(await getBytes(host.store, "intents", "a:pl10-rate-over-a")).toBeUndefined()
      expect(await getBytes(host.store, "intents", "a:pl10-rate-over-b")).toBeUndefined()
    } finally {
      restoreEnv(prior)
    }
  })

  it("a socket frame omits the other city attest log and a dead session closes", async () => {
    const host = await bootHost()
    const projected = projectState(host.ctx, host.state, "a", [
      { id: "a:1", key: "UI_ATTEST_LOGGED", badge: "logged", root: "aa", cid: "ca" },
      { id: "b:1", key: "UI_ATTEST_DEGRADED", badge: "degraded", root: "bb", cid: "cb" },
    ])
    const envelope = asObj(projected)
    const sections = asObj(envelope["sections"])
    const events = asObj(sections["log.events"])
    const rows = events["rows"]
    expect(Array.isArray(rows)).toBe(true)
    if (!Array.isArray(rows)) return
    expect(rows.length).toBe(1)
    expect(asText(asObj(rows[0])["id"])).toBe("a:1")
    const auth = await demoAuth(host)
    const api = await listenApi(host, 0n)
    closers.push(api)
    const ws = new WebSocket(
      "ws://" + listenBind + ":" + api.port.toString() + applyTemplate(wsTemplate, "city_id", auth.cityId),
      { headers: { authorization: auth.headers.authorization } },
    )
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve())
      ws.addEventListener("error", () => reject(new Error("ws error")))
    })
    const closed = new Promise<void>((resolve) => {
      ws.addEventListener("close", () => resolve())
    })
    host.state["city_time"] = asBigint(host.state["city_time"]) + host.ctx.sessionTtlCity + 1n
    api.pulse()
    const done = await Promise.race([
      closed.then(() => "closed"),
      new Promise<string>((resolve) => setTimeout(() => resolve("open"), 500)),
    ])
    expect(done).toBe("closed")
    ws.close()
  })
})

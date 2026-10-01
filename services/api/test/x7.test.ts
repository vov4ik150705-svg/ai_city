import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { assertI1, bankOpen, bytesToHex, cityClock, keccak256, type Dict } from "@corporator/engine"
import { amountOk, createMockPort, createRpcPort, err, transportFromPort, type AssetPort } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { projectState } from "../src/project.ts"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { bootHost, makeInputs, seedPlayerCapital } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>
type IssueMode = "open" | "silence" | "empty" | "cover" | "deaf"

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

function openBankTick(host: Host): bigint {
  const closed = asBigint(host.ctx.cfg["bank_closed_weekday"])
  let i = 0n
  while (i < 2000n) {
    const clock = cityClock(host.ctx.cfg, i)
    if (clock[2] !== closed && bankOpen(host.ctx.cfg, clock[1], clock[2]) !== 0n) return i
    i += 1n
  }
  return 0n
}

function sundayTick(host: Host): bigint {
  const closed = asBigint(host.ctx.cfg["bank_closed_weekday"])
  let i = 0n
  while (i < 2000n) {
    if (cityClock(host.ctx.cfg, i)[2] === closed) return i
    i += 1n
  }
  return 0n
}

function nonceOf(cityId: string, intentId: string): string {
  return "0x" + bytesToHex(keccak256(new TextEncoder().encode(cityId + ":" + intentId)))
}

function ttlOf(host: Host): bigint {
  return asBigint(walk(host.ctx.pack, ["generated", "api", "voucher_ttl_s"]))
}

function books(host: Host, cityId: string) {
  const city = cityOf(host, cityId)
  return {
    capital: asBigint(city["capital"], 0n),
    corp: asBigint(city["corp_held"], 0n),
    vault: asBigint(host.state["vault_corp"], 0n),
    outstanding: asBigint(host.state["capital_outstanding"], 0n),
    withdrawn: asBigint(city["withdrawn_capital"], 0n),
    reserved: asBigint(city["reserved_day"], 0n),
  }
}

function voucherCount(host: Host, cityId: string): number {
  const raw = cityOf(host, cityId)["vouchers"]
  return Array.isArray(raw) ? raw.length : 0
}

async function session(
  host: Host,
  cityId: string,
  sessionId: string,
  kind: "wallet" | "demo",
): Promise<{ readonly authorization: string }> {
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

function scriptedPort(host: Host, blockTime: bigint, mode: IssueMode, issues: { n: number }): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    chain: {
      ...rpc.chain,
      async latestBlockTime() {
        if (mode === "deaf") return err(codes.SERVICE_DEGRADED)
        return amountOk(blockTime)
      },
    },
    vault: {
      ...rpc.vault,
      async issueVoucher() {
        issues.n += 1
        if (mode === "open") return { ok: true }
        if (mode === "cover") return err(codes.VAULT_EXIT_UNCOVERED)
        if (mode === "empty") return err(codes.API_MALFORMED)
        return err(codes.SERVICE_DEGRADED)
      },
      async issued() {
        if (mode === "open") return { ok: true, account: padAddr(7n), corpAmount: 1n, issuedAtS: blockTime }
        if (mode === "empty" || mode === "cover") {
          return { ok: true, account: "0x" + "0".repeat(40), corpAmount: 0n, issuedAtS: 0n }
        }
        return err(codes.SERVICE_DEGRADED)
      },
    },
  }
}

async function armWallet(host: Host, cityId: string, sessionId: string) {
  const city = cityOf(host, cityId)
  city["account_kind"] = "wallet"
  city["wallet"] = padAddr(7n)
  host.state["tick_index"] = openBankTick(host)
  seedPlayerCapital(host, cityId, 50n)
  const headers = await session(host, cityId, sessionId, "wallet")
  return { headers, t: asBigint(host.state["city_time"]) }
}

function withdrawBody(intentId: string, t: bigint, amount: bigint): Uint8Array {
  return canonical({ intent_id: intentId, expected_city_time: t, amount })
}

describe("X7 live withdraw voucher", () => {
  it("issues an open voucher without moving vault balances", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-open")
    const before = books(host, cityId)
    const issues = { n: 0 }
    const block = 4242n
    const port = scriptedPort(host, block, "open", issues)
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-open", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    const body = bodyOf(res.body)
    expect(asText(body["code"])).toBe("")
    expect(asText(body["phase"])).toBe("voucher")
    const card = asObj(body["voucher"])
    expect(asText(card["status"])).toBe("open")
    expect(asBigint(card["expires_at_s"])).toBe(block + ttlOf(host))
    const after = books(host, cityId)
    expect(after.capital).toBe(before.capital - 10n)
    expect(after.corp).toBe(before.corp)
    expect(after.vault).toBe(before.vault)
    expect(after.outstanding).toBe(before.outstanding)
    expect(after.withdrawn).toBe(before.withdrawn)
    expect(after.reserved > before.reserved).toBe(true)
    expect(issues.n).toBe(1)
    assertI1(host.ctx.cfg, host.state, cityId)
    const projected = asObj(projectState(host.ctx, host.state, cityId, []))
    const level = asObj(asObj(projected["sections"])["tick.building_level"])
    const rows = level["vouchers"]
    expect(Array.isArray(rows)).toBe(true)
    if (!Array.isArray(rows)) return
    const first = rows[0]
    expect(first !== undefined && typeof first === "object").toBe(true)
    if (first === null || typeof first !== "object" || Array.isArray(first)) return
    expect(asText(asObj(first)["status"])).toBe("open")
    expect(asText(asObj(first)["nonce"])).toBe(nonceOf(cityId, "x7-open"))
  })

  it("silence leaves signing and a replay does not debit twice", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-silence")
    const before = books(host, cityId)
    const issues = { n: 0 }
    const port = scriptedPort(host, 1000n, "silence", issues)
    const once = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-silence", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    const body = bodyOf(once.body)
    expect(asText(body["code"])).toBe("")
    expect(asText(asObj(body["voucher"])["status"])).toBe("signing")
    const mid = books(host, cityId)
    expect(mid.capital).toBe(before.capital - 10n)
    expect(mid.corp).toBe(before.corp)
    expect(mid.vault).toBe(before.vault)
    expect(mid.outstanding).toBe(before.outstanding)
    const again = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-silence", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(asObj(bodyOf(again.body)["voucher"])["status"])).toBe("signing")
    expect(books(host, cityId).capital).toBe(mid.capital)
    expect(books(host, cityId).reserved).toBe(mid.reserved)
    expect(issues.n).toBe(1)
    await host.store.query("DELETE FROM intents WHERE id = $1", [cityId + ":x7-silence"])
    await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-silence", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(books(host, cityId).capital).toBe(mid.capital)
    expect(books(host, cityId).reserved).toBe(mid.reserved)
    expect(voucherCount(host, cityId)).toBe(1)
  })

  it("an empty issued voucher returns capital and the reservation once", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-cover")
    const before = books(host, cityId)
    const issues = { n: 0 }
    const port = scriptedPort(host, 1000n, "cover", issues)
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-cover", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    const body = bodyOf(res.body)
    expect(asText(body["code"])).toBe(codes.VAULT_EXIT_UNCOVERED)
    const after = books(host, cityId)
    expect(after.capital).toBe(before.capital)
    expect(after.reserved).toBe(before.reserved)
    expect(after.corp).toBe(before.corp)
    expect(after.vault).toBe(before.vault)
    expect(after.outstanding).toBe(before.outstanding)
    expect(after.withdrawn).toBe(before.withdrawn)
    const replay = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-cover", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(bodyOf(replay.body)["code"])).toBe(codes.VAULT_EXIT_UNCOVERED)
    expect(books(host, cityId).capital).toBe(before.capital)
    await host.store.query("DELETE FROM intents WHERE id = $1", [cityId + ":x7-cover"])
    const third = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-cover", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(bodyOf(third.body)["code"])).toBe(codes.VOUCHER_REJECTED)
    expect(books(host, cityId).capital).toBe(before.capital)
    expect(issues.n).toBe(1)
  })

  it("a reverted issue that is not cover is VOUCHER_REJECTED and refunds once", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-empty")
    const before = books(host, cityId)
    const issues = { n: 0 }
    const port = scriptedPort(host, 1000n, "empty", issues)
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-empty", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(bodyOf(res.body)["code"])).toBe(codes.VOUCHER_REJECTED)
    expect(books(host, cityId).capital).toBe(before.capital)
    expect(books(host, cityId).reserved).toBe(before.reserved)
    expect(issues.n).toBe(1)
  })

  it("two cities with one intent id get different nonces", async () => {
    const host = await bootHost()
    const armed = await armWallet(host, "a", "x7-a")
    const cities = asEngineDict(host.state["cities"])
    const copy = structuredClone(cityOf(host, "a"))
    copy["id"] = "b"
    copy["wallet"] = padAddr(9n)
    copy["vouchers"] = []
    cities["b"] = copy
    seedPlayerCapital(host, "b", 50n)
    const headersB = await session(host, "b", "x7-b", "wallet")
    const issues = { n: 0 }
    const port = scriptedPort(host, 1000n, "open", issues)
    const intent = "shared-intent"
    await handleCommand(host.ctx, host.store, host.state, "withdraw", withdrawBody(intent, armed.t, 10n), armed.headers, undefined, port)
    await handleCommand(host.ctx, host.store, host.state, "withdraw", withdrawBody(intent, armed.t, 10n), headersB, undefined, port)
    const rawA = cityOf(host, "a")["vouchers"]
    const rawB = cityOf(host, "b")["vouchers"]
    expect(Array.isArray(rawA) && Array.isArray(rawB)).toBe(true)
    if (!Array.isArray(rawA) || !Array.isArray(rawB)) return
    const rowA = asEngineDict(rawA[0])
    const rowB = asEngineDict(rawB[0])
    expect(asText(rowA["nonce"])).toBe(nonceOf("a", intent))
    expect(asText(rowB["nonce"])).toBe(nonceOf("b", intent))
    expect(asText(rowA["nonce"]) === asText(rowB["nonce"])).toBe(false)
  })

  it("issued_at_s is the block time, not city_time", async () => {
    const host = await bootHost()
    const cityId = "a"
    const city = cityOf(host, cityId)
    city["account_kind"] = "wallet"
    city["wallet"] = padAddr(7n)
    host.state["tick_index"] = openBankTick(host)
    host.state["city_time"] = 9_000_000n
    seedPlayerCapital(host, cityId, 50n)
    const headers = await session(host, cityId, "x7-clock", "wallet")
    const block = 4242n
    const issues = { n: 0 }
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-clock", 9_000_000n, 10n),
      headers,
      undefined,
      scriptedPort(host, block, "open", issues),
    )
    const card = asObj(bodyOf(res.body)["voucher"])
    expect(asBigint(card["expires_at_s"])).toBe(block + ttlOf(host))
    expect(asBigint(card["expires_at_s"]) === 9_000_000n + ttlOf(host)).toBe(false)
    const row = asEngineDict((cityOf(host, cityId)["vouchers"] as unknown[])[0])
    expect(asBigint(row["issued_at_s"])).toBe(block)
  })

  it("a second withdraw while one voucher is open is VOUCHER_PENDING", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-pending")
    const issues = { n: 0 }
    const port = scriptedPort(host, 1000n, "open", issues)
    await handleCommand(host.ctx, host.store, host.state, "withdraw", withdrawBody("x7-first", armed.t, 10n), armed.headers, undefined, port)
    const mid = books(host, cityId)
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-second", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(bodyOf(res.body)["code"])).toBe(codes.VOUCHER_PENDING)
    expect(books(host, cityId).capital).toBe(mid.capital)
    expect(issues.n).toBe(1)
    expect(voucherCount(host, cityId)).toBe(1)
  })

  it("the expire ceiling refuses before any debit", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-limit")
    const max = asBigint(walk(host.ctx.pack, ["sections", "api", "params", "voucher_expired_per_city_day_max", "v"]))
    const day = cityClock(host.ctx.cfg, asBigint(host.state["tick_index"]))[0]
    host.state["bank_day"] = day
    cityOf(host, cityId)["vouchers_expired_day"] = max
    const before = books(host, cityId)
    const issues = { n: 0 }
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-limit", armed.t, 10n),
      armed.headers,
      undefined,
      scriptedPort(host, 1000n, "open", issues),
    )
    expect(asText(bodyOf(res.body)["code"])).toBe(codes.VOUCHER_EXPIRE_LIMIT)
    expect(books(host, cityId).capital).toBe(before.capital)
    expect(asBigint(cityOf(host, cityId)["vouchers_expired_day"])).toBe(max)
    expect(issues.n).toBe(0)
  })

  it("a silent block clock debits nothing", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-deaf")
    const before = books(host, cityId)
    const issues = { n: 0 }
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-deaf", armed.t, 10n),
      armed.headers,
      undefined,
      scriptedPort(host, 1000n, "deaf", issues),
    )
    expect(asText(bodyOf(res.body)["code"])).toBe(codes.SERVICE_DEGRADED)
    expect(books(host, cityId).capital).toBe(before.capital)
    expect(issues.n).toBe(0)
  })

  it("sunday, over-capital, and an empty vault send no issue", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-refuse")
    const issues = { n: 0 }
    const port = scriptedPort(host, 1000n, "open", issues)
    host.state["tick_index"] = sundayTick(host)
    const sundayBefore = books(host, cityId)
    const sunday = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-sunday", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(bodyOf(sunday.body)["code"])).toBe(codes.BANK_SUNDAY)
    expect(books(host, cityId).capital).toBe(sundayBefore.capital)
    host.state["tick_index"] = openBankTick(host)
    const tooMuch = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-too-much", armed.t, books(host, cityId).capital + 1n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(bodyOf(tooMuch.body)["code"])).toBe(codes.NOT_ENOUGH_CAPITAL)
    expect(books(host, cityId).capital).toBe(sundayBefore.capital)
    host.state["vault_corp"] = 0n
    const empty = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-empty-vault", armed.t, 10n),
      armed.headers,
      undefined,
      port,
    )
    expect(asText(bodyOf(empty.body)["code"])).toBe(codes.VAULT_EXIT_UNCOVERED)
    expect(books(host, cityId).capital).toBe(sundayBefore.capital)
    expect(issues.n).toBe(0)
    expect(voucherCount(host, cityId)).toBe(0)
  })

  it("demo on the live port is DEMO_NO_WITHDRAW", async () => {
    const host = await bootHost()
    const cityId = "a"
    host.state["tick_index"] = openBankTick(host)
    const headers = await session(host, cityId, "x7-demo", "demo")
    const before = asBigint(cityOf(host, cityId)["capital"], 0n)
    const issues = { n: 0 }
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-demo", asBigint(host.state["city_time"]), 10n),
      headers,
      undefined,
      scriptedPort(host, 1000n, "open", issues),
    )
    expect(asText(bodyOf(res.body)["code"])).toBe(codes.DEMO_NO_WITHDRAW)
    expect(asBigint(cityOf(host, cityId)["capital"], 0n)).toBe(before)
    expect(issues.n).toBe(0)
  })

  it("holds I1 across 100 ticks with a deposit and a live withdraw", async () => {
    const host = await bootHost()
    const cityId = "a"
    const armed = await armWallet(host, cityId, "x7-i1")
    const issues = { n: 0 }
    const res = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "withdraw",
      withdrawBody("x7-i1", armed.t, 10n),
      armed.headers,
      undefined,
      scriptedPort(host, 1000n, "open", issues),
    )
    expect(asText(bodyOf(res.body)["code"])).toBe("")
    assertI1(host.ctx.cfg, host.state, cityId)
    const start = asBigint(host.state["tick_index"])
    let n = 1n
    while (n <= 100n) {
      if (n % 10n === 0n) seedPlayerCapital(host, cityId, 1n)
      await host.stepTick(makeInputs(host.ctx.cfg, start + n))
      assertI1(host.ctx.cfg, host.state, cityId)
      n += 1n
    }
    expect(issues.n).toBe(1)
    expect(asBigint(host.state["capital_outstanding"]) > 0n).toBe(true)
  })
})

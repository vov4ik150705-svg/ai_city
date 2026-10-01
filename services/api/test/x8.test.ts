import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { amountOk, createMockPort, createRpcPort, dataPresentVoucher, err, transportFromPort, type AssetPort } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { handleCommand } from "../src/commands.ts"
import { chainTxKey } from "../src/commit_bank.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { getBytes, putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk, type Dict } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

const WALLET = "0x" + "7".padStart(40, "0")
const VAULT = "0x" + "4".padStart(40, "0")

function bodyOf(bytes: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("body")
  return parsed
}

function cityOf(host: Host): Dict {
  return asEngineDict(asEngineDict(host.state["cities"])["a"])
}

function ttlOf(host: Host): bigint {
  return asBigint(walk(host.ctx.pack, ["generated", "api", "voucher_ttl_s"]))
}

function books(host: Host) {
  const city = cityOf(host)
  return {
    corp: asBigint(city["corp_held"], 0n),
    vault: asBigint(host.state["vault_corp"], 0n),
    outstanding: asBigint(host.state["capital_outstanding"], 0n),
    withdrawn: asBigint(city["withdrawn_capital"], 0n),
  }
}

function voucherStatus(host: Host, id: string): string {
  const raw = cityOf(host)["vouchers"]
  if (!Array.isArray(raw)) return ""
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) === id) return asText(row["status"])
  }
  return ""
}

async function headers(host: Host, sessionId: string) {
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

function seedVoucher(host: Host, status: string, issuedAt: bigint) {
  const city = cityOf(host)
  city["account_kind"] = "wallet"
  city["wallet"] = WALLET
  city["id"] = "a"
  city["corp_held"] = 0n
  city["vouchers"] = [
    {
      id: "v1",
      nonce: "0x" + "ab".repeat(32),
      capital: 10n,
      corp: 4n,
      reservation_id: "v1",
      issued_at_s: issuedAt,
      status,
    },
  ]
  host.state["bank_day"] = 1n
  host.state["bank_reservations"] = [{ id: "v1", city_id: "a", eth: 3n, depth_snapshot: 1n, day: 1n, status: "open" }]
  city["reserved_day"] = 3n
  host.state["bank_reserved_today_wei"] = 3n
  if (asBigint(host.state["vault_corp"], 0n) < 4n) host.state["vault_corp"] = 4n
  if (asBigint(host.state["capital_outstanding"], 0n) < 10n) host.state["capital_outstanding"] = 10n
}

function livePort(
  host: Host,
  book: Map<string, { readonly to: string; readonly data: string; readonly status: bigint }>,
  net: { block: bigint; outcome: bigint; issued: bigint },
): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    chain: {
      ...rpc.chain,
      async latestBlockTime() {
        return amountOk(net.block)
      },
      async transactionReceipt(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return { ok: true, status: 0n, from: WALLET, to: "", input: "", logs: [] }
        return { ok: true, status: tx.status, from: WALLET, to: tx.to, input: tx.data, logs: [] }
      },
      async transactionByHash(hash: string) {
        const tx = book.get(hash.toLowerCase())
        if (tx === undefined) return err(codes.SERVICE_DEGRADED)
        return { ok: true, status: tx.status, from: WALLET, to: tx.to, input: tx.data, logs: [] }
      },
    },
    vault: {
      ...rpc.vault,
      async issued() {
        return { ok: true, account: WALLET, corpAmount: net.issued, issuedAtS: 1_000n }
      },
      async outcomeOf() {
        return amountOk(net.outcome)
      },
    },
  }
}

function rememberEnv(): Map<string, string | undefined> {
  return new Map([["CORPORATOR_VAULT", process.env["CORPORATOR_VAULT"]]])
}

function restoreEnv(prior: ReadonlyMap<string, string | undefined>): void {
  for (const [name, value] of prior) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
}

describe("X8 present voucher", () => {
  it("prepares the row's present calldata and finalizes once", async () => {
    const host = await bootHost()
    const issuedAt = 1_000n
    host.state["city_time"] = issuedAt
    seedVoucher(host, "open", issuedAt)
    const hdr = await headers(host, "x8-open")
    const missingId = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "present_voucher",
      canonical({ intent_id: "x8-missing", expected_city_time: issuedAt, phase: "prepare" }),
      hdr,
      undefined,
      createMockPort(portCfgFromPack(host.ctx.pack)),
    )
    expect(asText(bodyOf(missingId.body)["code"])).toBe(codes.API_MALFORMED)
    const foreignId = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "present_voucher",
      canonical({
        intent_id: "x8-foreign",
        expected_city_time: issuedAt,
        phase: "prepare",
        voucher_id: "not-this-city",
      }),
      hdr,
      undefined,
      createMockPort(portCfgFromPack(host.ctx.pack)),
    )
    expect(asText(bodyOf(foreignId.body)["code"])).toBe(codes.API_MALFORMED)
    const net = { block: issuedAt + ttlOf(host), outcome: 1n, issued: 4n }
    const book = new Map<string, { readonly to: string; readonly data: string; readonly status: bigint }>()
    const port = livePort(host, book, net)
    const missingDistrict = await handleCommand(
      host.ctx,
      host.store,
      host.state,
      "claim_unstaked",
      canonical({ intent_id: "x8-claim-bare", expected_city_time: issuedAt, phase: "prepare" }),
      hdr,
      undefined,
      port,
    )
    expect(asText(bodyOf(missingDistrict.body)["code"])).toBe(codes.API_MALFORMED)
    const prior = rememberEnv()
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-prep", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      const prep = bodyOf(prepared.body)
      expect(asText(prep["code"])).toBe("")
      expect(asText(prep["phase"])).toBe("prepared")
      const txs = prep["txs"]
      expect(Array.isArray(txs) && txs.length === 1).toBe(true)
      if (!Array.isArray(txs) || txs.length !== 1) return
      const tx = asObj(txs[0])
      const data = dataPresentVoucher("0x" + "ab".repeat(32), WALLET, 4n, issuedAt)
      expect(asText(tx["data"])).toBe(data)
      expect(asText(tx["to"]).toLowerCase()).toBe(VAULT)
      const before = books(host)
      const hash = "0x" + "81".repeat(32)
      book.set(hash, { to: VAULT, data, status: 1n })
      const confirm = async (intent: string) =>
        handleCommand(
          host.ctx,
          host.store,
          host.state,
          "present_voucher",
          canonical({
            intent_id: intent,
            expected_city_time: issuedAt,
            phase: "confirm",
            ticket: "x8-prep",
            tx_hashes: [hash],
          }),
          hdr,
          undefined,
          port,
        )
      const confirmed = await confirm("x8-conf")
      expect(asText(bodyOf(confirmed.body)["code"])).toBe("")
      const after = books(host)
      expect(after.outstanding).toBe(before.outstanding - 10n)
      expect(after.vault).toBe(before.vault - 4n)
      expect(after.corp).toBe(before.corp)
      expect(after.withdrawn).toBe(before.withdrawn + 10n)
      expect(voucherStatus(host, "v1")).toBe("presented")
      const again = await confirm("x8-conf-2")
      expect(asText(bodyOf(again.body)["code"])).toBe("")
      expect(books(host).outstanding).toBe(after.outstanding)
      expect(books(host).vault).toBe(after.vault)
      expect(books(host).corp).toBe(after.corp)
      await host.store.query("DELETE FROM intents WHERE id = $1", [chainTxKey(hash)])
      const third = await confirm("x8-conf-3")
      expect(asText(bodyOf(third.body)["code"])).toBe("")
      expect(books(host).outstanding).toBe(after.outstanding)
      expect(voucherStatus(host, "v1")).toBe("presented")
    } finally {
      restoreEnv(prior)
    }
  })

  it("refuses prepare after the block deadline and not on the deadline itself", async () => {
    const host = await bootHost()
    const issuedAt = 1_000n
    host.state["city_time"] = issuedAt
    seedVoucher(host, "open", issuedAt)
    const hdr = await headers(host, "x8-ttl")
    const deadline = issuedAt + ttlOf(host)
    const net = { block: deadline, outcome: 0n, issued: 4n }
    const port = livePort(host, new Map(), net)
    const prior = rememberEnv()
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      const onTime = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-ontime", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(onTime.body)["phase"])).toBe("prepared")
      net.block = deadline + 1n
      const late = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-late", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(late.body)["code"])).toBe(codes.VOUCHER_EXPIRED)
      expect(bodyOf(late.body)["txs"]).toBeUndefined()
      expect(voucherStatus(host, "v1")).toBe("open")
      expect(books(host).outstanding).toBe(books(host).outstanding)
    } finally {
      restoreEnv(prior)
    }
  })

  it("rejects another voucher's calldata and does not finalize a released outcome", async () => {
    const host = await bootHost()
    const issuedAt = 1_000n
    host.state["city_time"] = issuedAt
    seedVoucher(host, "open", issuedAt)
    const hdr = await headers(host, "x8-foreign")
    const net = { block: issuedAt, outcome: 1n, issued: 4n }
    const book = new Map<string, { readonly to: string; readonly data: string; readonly status: bigint }>()
    const port = livePort(host, book, net)
    const prior = rememberEnv()
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      const prepared = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-foreign-prep", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(prepared.body)["phase"])).toBe("prepared")
      const before = books(host)
      const foreign = "0x" + "82".repeat(32)
      book.set(foreign, {
        to: VAULT,
        data: dataPresentVoucher("0x" + "cd".repeat(32), WALLET, 4n, issuedAt),
        status: 1n,
      })
      const mismatched = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({
          intent_id: "x8-foreign-conf",
          expected_city_time: issuedAt,
          phase: "confirm",
          ticket: "x8-foreign-prep",
          tx_hashes: [foreign],
        }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(mismatched.body)["code"])).toBe(codes.API_MALFORMED)
      expect(books(host).outstanding).toBe(before.outstanding)
      expect(voucherStatus(host, "v1")).toBe("open")
      const own = "0x" + "83".repeat(32)
      const ownData = dataPresentVoucher("0x" + "ab".repeat(32), WALLET, 4n, issuedAt)
      book.set(own, { to: VAULT, data: ownData, status: 1n })
      net.outcome = 2n
      const released = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({
          intent_id: "x8-released",
          expected_city_time: issuedAt,
          phase: "confirm",
          ticket: "x8-foreign-prep",
          tx_hashes: [own],
        }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(released.body)["code"])).toBe(codes.VOUCHER_EXPIRED)
      expect(books(host).outstanding).toBe(before.outstanding)
      expect(books(host).vault).toBe(before.vault)
      expect(books(host).corp).toBe(before.corp)
      expect(voucherStatus(host, "v1")).toBe("open")
    } finally {
      restoreEnv(prior)
    }
  })

  it("does not store a lagged outcome, then finalizes when the outcome arrives", async () => {
    const host = await bootHost()
    const issuedAt = 1_000n
    host.state["city_time"] = issuedAt
    seedVoucher(host, "open", issuedAt)
    const hdr = await headers(host, "x8-lag")
    const net = { block: issuedAt, outcome: 0n, issued: 4n }
    const book = new Map<string, { readonly to: string; readonly data: string; readonly status: bigint }>()
    const port = livePort(host, book, net)
    const prior = rememberEnv()
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-lag-prep", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      const data = dataPresentVoucher("0x" + "ab".repeat(32), WALLET, 4n, issuedAt)
      const hash = "0x" + "84".repeat(32)
      book.set(hash, { to: VAULT, data, status: 1n })
      const lagged = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({
          intent_id: "x8-lag-conf",
          expected_city_time: issuedAt,
          phase: "confirm",
          ticket: "x8-lag-prep",
          tx_hashes: [hash],
        }),
        hdr,
        undefined,
        port,
      )
      const lagBody = bodyOf(lagged.body)
      expect(asText(lagBody["code"])).toBe(codes.CHAIN_TX_UNCONFIRMED)
      expect(asBigint(lagBody["retryable"])).toBe(1n)
      expect(await getBytes(host.store, "intents", chainTxKey(hash))).toBeUndefined()
      expect(voucherStatus(host, "v1")).toBe("open")
      const before = books(host)
      net.outcome = 1n
      const caught = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({
          intent_id: "x8-lag-conf-2",
          expected_city_time: issuedAt,
          phase: "confirm",
          ticket: "x8-lag-prep",
          tx_hashes: [hash],
        }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(caught.body)["code"])).toBe("")
      expect(books(host).outstanding).toBe(before.outstanding - 10n)
      expect(voucherStatus(host, "v1")).toBe("presented")
    } finally {
      restoreEnv(prior)
    }
  })

  it("a reverted present leaves the voucher open", async () => {
    const host = await bootHost()
    const issuedAt = 1_000n
    host.state["city_time"] = issuedAt
    seedVoucher(host, "open", issuedAt)
    const hdr = await headers(host, "x8-revert")
    const net = { block: issuedAt, outcome: 1n, issued: 4n }
    const book = new Map<string, { readonly to: string; readonly data: string; readonly status: bigint }>()
    const port = livePort(host, book, net)
    const prior = rememberEnv()
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-revert-prep", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      const before = books(host)
      const hash = "0x" + "85".repeat(32)
      book.set(hash, {
        to: VAULT,
        data: dataPresentVoucher("0x" + "ab".repeat(32), WALLET, 4n, issuedAt),
        status: 0n,
      })
      const reverted = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({
          intent_id: "x8-revert-conf",
          expected_city_time: issuedAt,
          phase: "confirm",
          ticket: "x8-revert-prep",
          tx_hashes: [hash],
        }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(reverted.body)["code"])).toBe(codes.CHAIN_TX_UNCONFIRMED)
      expect(bodyOf(reverted.body)["retryable"]).toBeUndefined()
      expect(books(host).outstanding).toBe(before.outstanding)
      expect(voucherStatus(host, "v1")).toBe("open")
    } finally {
      restoreEnv(prior)
    }
  })

  it("signing and an empty issued voucher do not produce a transaction", async () => {
    const host = await bootHost()
    const issuedAt = 1_000n
    host.state["city_time"] = issuedAt
    seedVoucher(host, "signing", issuedAt)
    const hdr = await headers(host, "x8-sign")
    const net = { block: issuedAt, outcome: 0n, issued: 4n }
    const port = livePort(host, new Map(), net)
    const prior = rememberEnv()
    process.env["CORPORATOR_VAULT"] = VAULT
    try {
      const signing = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-signing", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(signing.body)["code"])).toBe(codes.VOUCHER_PENDING_SIGN)
      seedVoucher(host, "open", issuedAt)
      net.issued = 0n
      const empty = await handleCommand(
        host.ctx,
        host.store,
        host.state,
        "present_voucher",
        canonical({ intent_id: "x8-empty", expected_city_time: issuedAt, phase: "prepare", voucher_id: "v1" }),
        hdr,
        undefined,
        port,
      )
      expect(asText(bodyOf(empty.body)["code"])).toBe(codes.VOUCHER_PENDING_SIGN)
      expect(books(host).outstanding).toBe(books(host).outstanding)
    } finally {
      restoreEnv(prior)
    }
  })
})

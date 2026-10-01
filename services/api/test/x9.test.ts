import { fromUtf8 } from "@corporator/contentpack"
import { amountOk, createMockPort, createRpcPort, err, transportFromPort, type AssetPort } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { reconcileVouchers } from "../src/commit_bank.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { tickOnce, voucherReconcileDone } from "../src/scheduler.ts"
import { getBytes } from "../src/store.ts"
import { asBigint, asEngineDict, asText, walk, type Dict } from "../src/values.ts"
import { bootHost } from "./harness.ts"

type Host = Awaited<ReturnType<typeof bootHost>>

const WALLET = "0x" + "7".padStart(40, "0")
const ISSUED_AT = 1_000n

type Net = {
  block: bigint
  outcome: bigint
  issued: bigint
  silent: boolean
  afterRelease: bigint
  releases: number
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
    capital: asBigint(city["capital"], 0n),
    corp: asBigint(city["corp_held"], 0n),
    vault: asBigint(host.state["vault_corp"], 0n),
    outstanding: asBigint(host.state["capital_outstanding"], 0n),
    reserved: asBigint(city["reserved_day"], 0n),
    expired: asBigint(city["vouchers_expired_day"], 0n),
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

function seedVoucher(host: Host, status: string, issuedAt: bigint = ISSUED_AT) {
  const city = cityOf(host)
  city["account_kind"] = "wallet"
  city["wallet"] = WALLET
  city["id"] = "a"
  city["capital"] = 50n
  city["corp_held"] = 0n
  city["vouchers_expired_day"] = 0n
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
  if (asBigint(host.state["vault_corp"], 0n) <= 0n) host.state["vault_corp"] = 1n
}

function livePort(host: Host, net: Net): AssetPort {
  const cfg = portCfgFromPack(host.ctx.pack)
  const chain = asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "snapshot", "chain_id"])).toString()
  const rpc = createRpcPort(cfg, transportFromPort(createMockPort(cfg), chain))
  return {
    ...rpc,
    chain: {
      ...rpc.chain,
      async latestBlockTime() {
        if (net.silent) return err(codes.SERVICE_DEGRADED)
        return amountOk(net.block)
      },
    },
    vault: {
      ...rpc.vault,
      async issued() {
        if (net.silent) return err(codes.SERVICE_DEGRADED)
        return { ok: true, account: WALLET, corpAmount: net.issued, issuedAtS: ISSUED_AT }
      },
      async outcomeOf() {
        if (net.silent) return err(codes.SERVICE_DEGRADED)
        return amountOk(net.outcome)
      },
      async releaseExpiredVoucher() {
        net.releases += 1
        net.outcome = net.afterRelease
        net.issued = 0n
        return { ok: true }
      },
    },
  }
}

async function worldText(host: Host): Promise<string> {
  const row = await getBytes(host.store, "cities", "world")
  if (row === undefined) return ""
  return fromUtf8(row)
}

describe("X9 voucher reconciler", () => {
  it("finalizes a presented voucher once when confirm never arrived", async () => {
    const host = await bootHost()
    seedVoucher(host, "open")
    const before = books(host)
    const net: Net = { block: ISSUED_AT, outcome: 1n, issued: 0n, silent: false, afterRelease: 2n, releases: 0 }
    const port = livePort(host, net)
    await reconcileVouchers(host, port)
    const after = books(host)
    expect(voucherStatus(host, "v1")).toBe("presented")
    expect(after.outstanding).toBe(before.outstanding - 10n)
    expect(after.vault).toBe(before.vault - 4n)
    expect(after.corp).toBe(before.corp)
    expect(after.capital).toBe(before.capital)
    expect(after.reserved).toBe(0n)
    expect(net.releases).toBe(0)
    expect(await worldText(host)).toContain("presented")
    await reconcileVouchers(host, port)
    expect(books(host).outstanding).toBe(after.outstanding)
    expect(books(host).vault).toBe(after.vault)
    expect(books(host).capital).toBe(after.capital)
  })

  it("returns capital once after a released expiry and not on the deadline itself", async () => {
    const host = await bootHost()
    seedVoucher(host, "open")
    const ttl = ttlOf(host)
    const net: Net = { block: ISSUED_AT + ttl, outcome: 0n, issued: 4n, silent: false, afterRelease: 2n, releases: 0 }
    const port = livePort(host, net)
    const before = books(host)
    await reconcileVouchers(host, port)
    expect(net.releases).toBe(0)
    expect(voucherStatus(host, "v1")).toBe("open")
    expect(books(host).capital).toBe(before.capital)
    net.block = ISSUED_AT + ttl + 1n
    await reconcileVouchers(host, port)
    const after = books(host)
    expect(net.releases).toBe(1)
    expect(voucherStatus(host, "v1")).toBe("expired")
    expect(after.capital).toBe(before.capital + 10n)
    expect(after.outstanding).toBe(before.outstanding)
    expect(after.vault).toBe(before.vault)
    expect(after.corp).toBe(before.corp)
    expect(after.reserved).toBe(0n)
    expect(after.expired).toBe(1n)
    await reconcileVouchers(host, port)
    expect(books(host).capital).toBe(after.capital)
    expect(books(host).expired).toBe(1n)
    expect(net.releases).toBe(1)
  })

  it("finalizes when release loses the race to a present", async () => {
    const host = await bootHost()
    seedVoucher(host, "open")
    const ttl = ttlOf(host)
    const net: Net = { block: ISSUED_AT + ttl + 1n, outcome: 0n, issued: 4n, silent: false, afterRelease: 1n, releases: 0 }
    const port = livePort(host, net)
    const before = books(host)
    await reconcileVouchers(host, port)
    expect(net.releases).toBe(1)
    expect(voucherStatus(host, "v1")).toBe("presented")
    expect(books(host).capital).toBe(before.capital)
    expect(books(host).outstanding).toBe(before.outstanding - 10n)
    expect(books(host).vault).toBe(before.vault - 4n)
    expect(books(host).corp).toBe(before.corp)
    await reconcileVouchers(host, port)
    expect(books(host).capital).toBe(before.capital)
    expect(books(host).outstanding).toBe(before.outstanding - 10n)
  })

  it("leaves the row through three silent ticks, then finishes when the network returns", async () => {
    const host = await bootHost()
    seedVoucher(host, "open")
    const net: Net = { block: ISSUED_AT, outcome: 1n, issued: 4n, silent: true, afterRelease: 2n, releases: 0 }
    const port = livePort(host, net)
    const started = asBigint(host.state["city_time"])
    let n = 0
    while (n < 3) {
      await tickOnce(host, undefined, port)
      await voucherReconcileDone()
      n += 1
    }
    expect(voucherStatus(host, "v1")).toBe("open")
    expect(asBigint(host.state["city_time"]) > started).toBe(true)
    net.silent = false
    await tickOnce(host, undefined, port)
    await voucherReconcileDone()
    expect(voucherStatus(host, "v1")).toBe("presented")
  })

  it("does not move a mock-port voucher", async () => {
    const host = await bootHost()
    seedVoucher(host, "signing")
    const ttl = ttlOf(host)
    const cfg = portCfgFromPack(host.ctx.pack)
    const mock = createMockPort(cfg)
    const port: AssetPort = {
      ...mock,
      chain: {
        ...mock.chain,
        async latestBlockTime() {
          return amountOk(ISSUED_AT + ttl + 1n)
        },
      },
      vault: {
        ...mock.vault,
        async issued() {
          return { ok: true, account: WALLET, corpAmount: 0n, issuedAtS: ISSUED_AT }
        },
        async outcomeOf() {
          return amountOk(0n)
        },
      },
    }
    const before = books(host)
    await reconcileVouchers(host, port)
    expect(voucherStatus(host, "v1")).toBe("signing")
    expect(books(host).capital).toBe(before.capital)
  })

  it("opens a signed voucher, and a release that stays empty does not return capital", async () => {
    const host = await bootHost()
    seedVoucher(host, "signing")
    const ttl = ttlOf(host)
    const net: Net = { block: ISSUED_AT + ttl + 1n, outcome: 0n, issued: 4n, silent: false, afterRelease: 2n, releases: 0 }
    const port = livePort(host, net)
    const before = books(host)
    await reconcileVouchers(host, port)
    expect(voucherStatus(host, "v1")).toBe("open")
    expect(books(host).capital).toBe(before.capital)
    expect(net.releases).toBe(0)
    net.afterRelease = 0n
    await reconcileVouchers(host, port)
    expect(net.releases).toBe(1)
    expect(voucherStatus(host, "v1")).toBe("open")
    expect(books(host).capital).toBe(before.capital)
    expect(books(host).outstanding).toBe(before.outstanding)
  })

  it("rejects an unsigned voucher after the deadline and still ticks when the clock throws", async () => {
    const host = await bootHost()
    seedVoucher(host, "signing")
    const ttl = ttlOf(host)
    const net: Net = { block: ISSUED_AT + ttl + 1n, outcome: 0n, issued: 0n, silent: false, afterRelease: 2n, releases: 0 }
    const port = livePort(host, net)
    const before = books(host)
    await reconcileVouchers(host, port)
    expect(voucherStatus(host, "v1")).toBe("rejected")
    expect(books(host).capital).toBe(before.capital + 10n)
    expect(books(host).expired).toBe(0n)
    expect(books(host).outstanding).toBe(before.outstanding)
    expect(net.releases).toBe(0)
    await reconcileVouchers(host, port)
    expect(books(host).capital).toBe(before.capital + 10n)
    const started = asBigint(host.state["city_time"])
    const boom = livePort(host, net)
    const throwing: AssetPort = {
      ...boom,
      chain: {
        ...boom.chain,
        async latestBlockTime() {
          throw new Error("clock down")
        },
      },
    }
    await tickOnce(host, undefined, throwing)
    await voucherReconcileDone()
    expect(voucherStatus(host, "v1")).toBe("rejected")
    expect(asBigint(host.state["city_time"]) > started).toBe(true)
  })
})

import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, utf8, type Json } from "@corporator/contentpack"
import { bytesToHex, leafPrefixes, loadConfig, merkleRoot, newState, tick, tickHeader, type Dict } from "@corporator/engine"
import { channelMap, codes } from "@corporator/protocol"
import {
  createMockPort,
  createRpcPort,
  lyingTransport,
  readWalletPrice,
  recordedStakeSnapshot,
  submitMinuteRoot,
  transportFromPort,
  type PortAmount,
  type PortConfig,
  type PortResult,
  type RootResult,
  type SnapshotResult,
  type Voucher,
} from "../src/index.ts"
import { assertPrizeTreasuryRpcParity, assertPrizeTreasurySilence } from "./prize_treasury.cases.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const over253 = 2n ** 53n + 1n

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function asObj(value: Json): { readonly [key: string]: Json } {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(codes.API_MALFORMED)
  }
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error(codes.API_MALFORMED)
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value !== "bigint") throw new Error(codes.API_MALFORMED)
  return value
}

function cfgFromPack(pack: Json): PortConfig {
  const keys = asObj(atPath(pack, ["sections", "arch", "keys"]))
  const voucher = asObj(keys["voucher_signer"] ?? null)
  const buy = asObj(keys["buyback_executor"] ?? null)
  return {
    voucherTtlS: asBig(atPath(pack, ["generated", "api", "voucher_ttl_s"])),
    voucherSignerService: asText(voucher["service"]),
    buybackExecutorService: asText(buy["service"]),
  }
}

function packDict(pack: Json): Dict {
  if (pack === null || typeof pack !== "object" || Array.isArray(pack)) {
    throw new Error(codes.API_MALFORMED)
  }
  return pack
}

function makeInputs(cfg: Dict, tickIndex: bigint, extra: Dict = {}): Dict {
  const length = cfg["tick_length_city_hours"]
  const hours = typeof length === "bigint" ? length : 0n
  const anchor = cfg["anchor_hour"]
  const start = typeof anchor === "bigint" ? anchor : 0n
  return {
    tick_index: tickIndex,
    city_time: start + tickIndex * hours,
    eth_usd_8dec: cfg["eth_usd_8dec"],
    corp_eth_wei_per_whole: cfg["seed_corp_wei"],
    feed_live: 1n,
    pack_hash: cfg["pack_hash"],
    dex_turnover_usd_8dec: 0n,
    ...extra,
  }
}

function amountOf(row: PortAmount): bigint {
  if (!row.ok) throw new Error(row.code)
  return row.amount
}

function expectEq(left: PortResult | PortAmount | SnapshotResult | RootResult, right: PortResult | PortAmount | SnapshotResult | RootResult): void {
  expect(left.ok).toBe(right.ok)
  if (!left.ok && !right.ok) {
    expect(left.code).toBe(right.code)
    return
  }
  if (left.ok && right.ok) {
    if ("amount" in left && "amount" in right) expect(left.amount).toBe(right.amount)
    if ("root" in left && "root" in right) expect(left.root).toBe(right.root)
    if ("rows" in left && "rows" in right) {
      expect(left.rows.length).toBe(right.rows.length)
      for (let i = 0; i < left.rows.length; i += 1) {
        const a = left.rows[i]
        const b = right.rows[i]
        if (a === undefined || b === undefined) continue
        expect(a.ticker).toBe(b.ticker)
        expect(a.amount).toBe(b.amount)
      }
    }
  }
}

describe.sequential("C10 construction", () => {
  it("rpc_parity_with_mock", async () => {
    const loaded = loadPack(packBytes())
    const cfg = cfgFromPack(loaded.pack)
    const layout = asBig(atPath(loaded.pack, ["sections", "tick", "params", "layout_version", "v"]))
    expect(layout).toBe(1n)
    const account = "a"
    const seed = { corp: { [account]: over253, b: 1n } }
    const mock = createMockPort(cfg, seed)
    const inner = createMockPort(cfg, seed)
    const rpc = createRpcPort(cfg, transportFromPort(inner, "1"))
    expectEq(await mock.corpToken.balanceOf(account), await rpc.corpToken.balanceOf(account))
    expectEq(await mock.corpToken.transfer(account, "b", over253), await rpc.corpToken.transfer(account, "b", over253))
    expectEq(await mock.corpToken.balanceOf("b"), await rpc.corpToken.balanceOf("b"))
    expectEq(await mock.vault.mintCapital(account, 1n), await rpc.vault.mintCapital(account, 1n))
    expectEq(await mock.vault.deposit("b", 1n), await rpc.vault.deposit("b", 1n))
    expectEq(await mock.vault.vaultCorp(), await rpc.vault.vaultCorp())
    expectEq(await mock.vault.mintCapital("b", 1n), await rpc.vault.mintCapital("b", 1n))
    expectEq(await mock.vault.capitalOf("b"), await rpc.vault.capitalOf("b"))
    const voucher: Voucher = { nonce: "n1", account: "b", corpAmount: 1n, issuedAtS: 0n }
    expectEq(await mock.vault.issueVoucher(voucher), await rpc.vault.issueVoucher(voucher))
    expectEq(await mock.vault.presentVoucher(voucher, 0n), await rpc.vault.presentVoucher(voucher, 0n))
    expectEq(await mock.vault.presentVoucher(voucher, 0n), await rpc.vault.presentVoucher(voucher, 0n))
    expectEq(await mock.stakeRegistry.stake(account, "NVDA", over253), await rpc.stakeRegistry.stake(account, "NVDA", over253))
    expectEq(await mock.stakeRegistry.unstake(account, "NVDA", 1n), await rpc.stakeRegistry.unstake(account, "NVDA", 1n))
    expectEq(await mock.stakeRegistry.snapshot(account), await rpc.stakeRegistry.snapshot(account))
    const prefixes = leafPrefixes(loadConfig(packDict(loaded.pack)))
    const leafP = prefixes[0]
    const nodeP = prefixes[1]
    if (leafP === undefined || nodeP === undefined) throw new Error(codes.API_MALFORMED)
    const leaf = utf8("one-leaf")
    const rootHex = bytesToHex(merkleRoot([leaf], leafP, nodeP))
    expectEq(await mock.merkleRoots.putRoot("c", 0n, rootHex), await rpc.merkleRoots.putRoot("c", 0n, rootHex))
    expectEq(await mock.merkleRoots.getRoot("c", 0n), await rpc.merkleRoots.getRoot("c", 0n))
    const submitted = await submitMinuteRoot(rpc, "c", 1n, rootHex)
    expect(submitted.ok).toBe(true)
    const stored = await rpc.merkleRoots.getRoot("c", 1n)
    expect(stored.ok).toBe(true)
    if (stored.ok) expect(stored.root).toBe(rootHex)
    const wallet = await readWalletPrice(rpc, "b", transportFromPort(inner, "1"), undefined)
    expect(wallet.chain).toBe("1")
    expect(wallet.corp === amountOf(await rpc.corpToken.balanceOf("b"))).toBe(true)
    expect(channelMap["wallet.chain"]).toBe("price")
    expect(channelMap["wallet.corp_balance"]).toBe("price")
    expect(channelMap["wallet.stake_tokens"]).toBe("tick")
    await assertPrizeTreasuryRpcParity(cfg)
  })

  it("rpc_silence_is_open", async () => {
    const loaded = loadPack(packBytes())
    const cfg = cfgFromPack(loaded.pack)
    const silent = createRpcPort(cfg)
    const bal = await silent.corpToken.balanceOf("a")
    expect(bal.ok).toBe(false)
    if (!bal.ok) expect(bal.code).toBe(codes.SERVICE_DEGRADED)
    const dep = await silent.vault.deposit("a", 1n)
    expect(dep.ok).toBe(false)
    if (!dep.ok) expect(dep.code).toBe(codes.SERVICE_DEGRADED)
    const snap = await silent.stakeRegistry.snapshot("a")
    expect(snap.ok).toBe(false)
    if (!snap.ok) expect(snap.code).toBe(codes.SERVICE_DEGRADED)
    const put = await silent.merkleRoots.putRoot("c", 0n, "ab")
    expect(put.ok).toBe(false)
    if (!put.ok) expect(put.code).toBe(codes.SERVICE_DEGRADED)
    const liar = createRpcPort(cfg, lyingTransport('{"ok":true,"amount":1}'))
    const lied = await liar.vault.vaultCorp()
    expect(lied.ok).toBe(false)
    if (!lied.ok) expect(lied.code).toBe(codes.SERVICE_DEGRADED)
    const garbage = createRpcPort(cfg, lyingTransport("not-json"))
    const bad = await garbage.vault.mintCapital("a", 1n)
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.code).toBe(codes.SERVICE_DEGRADED)
    const numbered = createRpcPort(cfg, {
      async call() {
        return { status: "ok", body: '{"ok":true,"amount":1}' }
      },
    })
    const numAmt = await numbered.vault.vaultCorp()
    expect(numAmt.ok).toBe(false)
    if (!numAmt.ok) expect(numAmt.code).toBe(codes.SERVICE_DEGRADED)
    const hexed = createRpcPort(cfg, {
      async call() {
        return { status: "ok", body: '{"ok":true,"amount":"0x10"}' }
      },
    })
    const hexAmt = await hexed.vault.vaultCorp()
    expect(hexAmt.ok).toBe(false)
    if (!hexAmt.ok) expect(hexAmt.code).toBe(codes.SERVICE_DEGRADED)
    const fakeOk = createRpcPort(cfg, lyingTransport('{"ok":true}'))
    expect((await fakeOk.vault.deposit("a", 1n)).ok).toBe(false)
    expect((await fakeOk.vault.mintCapital("a", 1n)).ok).toBe(false)
    const inner = createMockPort(cfg, { corp: { a: 10n } })
    expect(amountOf(await inner.vault.capitalOf("a"))).toBe(0n)
    const cfgEngine = loadConfig(packDict(loaded.pack))
    tick(newState(cfgEngine, {}, {}), makeInputs(cfgEngine, 0n, { stake_snapshot: 0n }))
    const last = await readWalletPrice(silent, "a", undefined, { chain: "1", corp: 7n })
    expect(last.chain).toBe("1")
    expect(last.corp).toBe(7n)
    await assertPrizeTreasurySilence(cfg)
  })

  it("stake_snapshot_is_recorded_input", async () => {
    const loaded = loadPack(packBytes())
    const cfg = cfgFromPack(loaded.pack)
    const mock = createMockPort(cfg)
    expect((await mock.stakeRegistry.stake("a", "NVDA", 3n)).ok).toBe(true)
    const first = await mock.stakeRegistry.snapshot("a")
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const frozen = recordedStakeSnapshot(first.rows)
    expect((await mock.stakeRegistry.stake("a", "NVDA", 9n)).ok).toBe(true)
    const later = await mock.stakeRegistry.snapshot("a")
    expect(later.ok).toBe(true)
    if (!later.ok) return
    expect(recordedStakeSnapshot(later.rows) === frozen).toBe(false)
    const cfgEngine = loadConfig(packDict(loaded.pack))
    const state = newState(cfgEngine, {}, {})
    const hdr = tickHeader(tick(state, makeInputs(cfgEngine, 0n, { stake_snapshot: frozen }))[0], makeInputs(cfgEngine, 0n, { stake_snapshot: frozen }))
    expect(hdr["stake_snapshot"]).toBe(frozen)
    expect(hdr["layout_version"]).toBe(1n)
    expect("wallet.chain" in hdr).toBe(false)
    expect("wallet.corp_balance" in hdr).toBe(false)
    const engineTick = readFileSync(join(repo, "packages/engine/src/tick.ts"), "utf8")
    expect(engineTick.includes("@corporator/chainport")).toBe(false)
    expect(engineTick.includes("createRpcPort")).toBe(false)
    expect(engineTick.includes("fetch(")).toBe(false)
    expect(channelMap["wallet.chain"]).toBe("price")
    expect(channelMap["wallet.corp_balance"]).toBe("price")
  })
})

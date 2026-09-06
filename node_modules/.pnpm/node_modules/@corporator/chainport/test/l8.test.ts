import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { loadConfig, newState, tick, type Dict } from "@corporator/engine"
import { codes, wsHeartbeatMs } from "@corporator/protocol"
import {
  createLiveTransport,
  createRpcPort,
  readPlayerReady,
  readWalletPrice,
  type JsonRpcPost,
  type PortConfig,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const PRIVKEY = /0x[0-9a-fA-F]{64}/
const ADDR = /^0x[0-9a-fA-F]{40}$/

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

function encodeUint256(value: bigint): string {
  let hex = value.toString(16)
  while (hex.length < 64) hex = "0" + hex
  return `0x${hex}`
}

function padAddr(n: bigint): `0x${string}` {
  const hex = n.toString(16)
  let out = hex
  while (out.length < 40) out = "0" + out
  return (`0x${out}`) as `0x${string}`
}

function walkSrc(dir: string, acc: string[]): string[] {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name)
    if (name.isDirectory()) {
      walkSrc(p, acc)
      continue
    }
    if (name.name.endsWith(".ts") || name.name.endsWith(".tsx")) acc.push(p)
  }
  return acc
}

describe.sequential("L8 construction", () => {
  it("rpc_http_eth_methods", async () => {
    const loaded = loadPack(packBytes())
    const cfg = cfgFromPack(loaded.pack)
    const snapshot = asObj(atPath(loaded.pack, ["sections", "districts", "stake", "snapshot"]))
    const url = asText(snapshot["rpc"])
    const chainId = asBig(snapshot["chain_id"])
    const corp = padAddr(1n)
    const vault = padAddr(2n)
    const stake = padAddr(3n)
    const roots = padAddr(4n)
    const account = padAddr(5n)
    expect(ADDR.test(corp)).toBe(true)
    const methods: string[] = []
    const post: JsonRpcPost = async (body: string) => {
      const row = JSON.parse(body) as { readonly method?: unknown }
      if (typeof row.method !== "string") return undefined
      methods.push(row.method)
      if (row.method === "eth_chainId") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: `0x${chainId.toString(16)}` })
      }
      if (row.method === "eth_call") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: encodeUint256(7n) })
      }
      if (row.method === "eth_sendTransaction") {
        return JSON.stringify({ jsonrpc: "2.0", id: "0", result: encodeUint256(1n) })
      }
      return undefined
    }
    const live = createLiveTransport(
      { url, chainId, timeoutMs: wsHeartbeatMs, contracts: { corpToken: corp, vault, stakeRegistry: stake, merkleRoots: roots } },
      post,
    )
    const rpc = createRpcPort(cfg, live)
    const bal = await rpc.corpToken.balanceOf(account)
    expect(bal.ok).toBe(true)
    if (bal.ok) expect(bal.amount).toBe(7n)
    expect(methods.includes("eth_call")).toBe(true)
    const wallet = await readWalletPrice(rpc, account, live, undefined)
    expect(wallet.chain).toBe(chainId.toString())
    expect(methods.includes("eth_chainId")).toBe(true)
    expect(methods.includes("corp_token_balanceOf")).toBe(false)
    const numbered: JsonRpcPost = async () => JSON.stringify({ jsonrpc: "2.0", id: "0", result: Number(chainId) })
    const liar = createRpcPort(
      cfg,
      createLiveTransport(
        { url, chainId, timeoutMs: wsHeartbeatMs, contracts: { corpToken: corp, vault, stakeRegistry: stake, merkleRoots: roots } },
        numbered,
      ),
    )
    const lied = await liar.corpToken.balanceOf(account)
    expect(lied.ok).toBe(false)
    if (!lied.ok) expect(lied.code).toBe(codes.SERVICE_DEGRADED)
    const silent = createRpcPort(cfg)
    const cfgEngine = loadConfig(packDict(loaded.pack))
    tick(newState(cfgEngine, {}, {}), makeInputs(cfgEngine, 0n, { stake_snapshot: 0n }))
    const last = await readWalletPrice(silent, account, undefined, { chain: chainId.toString(), corp: 7n })
    expect(last.chain).toBe(chainId.toString())
    expect(last.corp).toBe(7n)
    expect(url.includes("robinhood")).toBe(true)
    const emptyReady = readPlayerReady({})
    expect(emptyReady.depositsOpen).toBe(false)
    expect(emptyReady.contracts).toBeUndefined()
    const flaggedOnly = readPlayerReady({
      CORPORATOR_DEPOSITS_OPEN: "1",
      CORPORATOR_CORP_TOKEN: corp,
    })
    expect(flaggedOnly.depositsOpen).toBe(false)
    const prizes = padAddr(6n)
    const allAddrs = {
      CORPORATOR_CORP_TOKEN: corp,
      CORPORATOR_VAULT: vault,
      CORPORATOR_STAKE_REGISTRY: stake,
      CORPORATOR_MERKLE_ROOTS: roots,
      CORPORATOR_PRIZE_TREASURY: prizes,
    }
    const closed = readPlayerReady(allAddrs)
    expect(closed.depositsOpen).toBe(false)
    expect(closed.contracts !== undefined).toBe(true)
    const opened = readPlayerReady({ ...allAddrs, CORPORATOR_DEPOSITS_OPEN: "1" })
    expect(opened.depositsOpen).toBe(true)
    expect(opened.prizeTreasury).toBe(prizes)
    if (opened.contracts === undefined) {
      expect(opened.contracts).toBeDefined()
      return
    }
    expect(opened.contracts.vault).toBe(vault)
    expect(opened.contracts.corpToken).toBe(corp)
  })

  it("client_bundle_has_no_keys", () => {
    const loaded = loadPack(packBytes())
    const keys = asObj(atPath(loaded.pack, ["sections", "arch", "keys"]))
    for (const name of Object.keys(keys)) {
      const row = asObj(keys[name] ?? null)
      expect(asBig(row["client"])).toBe(0n)
    }
    const srcFiles = walkSrc(join(repo, "apps", "client", "src"), [])
    expect(srcFiles.length === 0).toBe(false)
    for (const path of srcFiles) {
      const text = readFileSync(path, "utf8")
      expect(PRIVKEY.test(text)).toBe(false)
      expect(text.includes("@corporator/chainport")).toBe(false)
      expect(text.includes('from "viem"') || text.includes("from 'viem'")).toBe(false)
    }
  })
})

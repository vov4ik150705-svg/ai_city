import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, utf8, type Json } from "@corporator/contentpack"
import { loadConfig, newState, tick, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { createMockPort, createRpcPort, type PortConfig } from "@corporator/chainport"
import {
  drainRootOutbox,
  emptyAttestorState,
  loadAttestorPack,
  memoryRootStore,
  stepAttestor,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

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

describe.sequential("L8 construction", () => {
  it("attestor_putroot_retries", async () => {
    const bytes = packBytes()
    const pack = loadAttestorPack(bytes)
    const loaded = loadPack(bytes)
    const cfg = cfgFromPack(loaded.pack)
    const store = memoryRootStore()
    const ticks = [{ cityId: "a", cityTime: 0n, leaves: [utf8("one-leaf")] }]
    const down = { ipfs: false, rpc: false }
    const first = stepAttestor(pack, store, emptyAttestorState(), ticks, pack.rootPeriodS, down)
    expect(first.next.rootJobs.length === 0).toBe(false)
    const silent = createRpcPort(cfg)
    const failed = await drainRootOutbox(silent, first.next.rootJobs)
    expect(failed.rest.length).toBe(first.next.rootJobs.length)
    expect(failed.degraded).toBe(codes.SERVICE_DEGRADED)
    const cfgEngine = loadConfig(packDict(loaded.pack))
    tick(newState(cfgEngine, {}, {}), makeInputs(cfgEngine, 0n))
    const mock = createMockPort(cfg)
    const ok = await drainRootOutbox(mock, first.next.rootJobs)
    expect(ok.rest.length).toBe(0)
    expect(ok.degraded).toBe("")
    const again = await drainRootOutbox(silent, ok.rest)
    expect(again.rest.length).toBe(0)
  })
})

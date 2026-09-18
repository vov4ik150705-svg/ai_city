import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { loadConfig, newState, tick, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import {
  createMockPort,
  createRpcPort,
  lyingTransport,
  silentTransport,
  submitMinuteRoot,
  type PortConfig,
  type Voucher,
} from "../src/index.ts"
import { postEth } from "../src/rpc/jsonrpc.ts"

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

describe.sequential("P5 construction", () => {
  it("chain_silence_does_not_block_tick", async () => {
    const loaded = loadPack(packBytes())
    const cfg = cfgFromPack(loaded.pack)
    const silent = createRpcPort(cfg, silentTransport())
    const silenced = await silent.corpToken.balanceOf("a")
    expect(silenced.ok).toBe(false)
    if (silenced.ok) return
    expect(silenced.code).toBe(codes.SERVICE_DEGRADED)

    const lie = createRpcPort(cfg, lyingTransport('{"ok":true,"amount":1}'))
    const lied = await lie.corpToken.balanceOf("a")
    expect(lied.ok).toBe(false)
    if (lied.ok) return
    expect(lied.code).toBe(codes.SERVICE_DEGRADED)

    const numberLie = await postEth(
      async () => JSON.stringify({ jsonrpc: "2.0", id: "0", result: 1 }),
      "eth_chainId",
      [],
    )
    expect(numberLie.status).toBe("silence")

    const outOfGas = await postEth(
      async () => JSON.stringify({ jsonrpc: "2.0", id: "0", error: { code: -32000, message: "out of gas" } }),
      "eth_sendRawTransaction",
      [],
    )
    expect(outOfGas.status).toBe("silence")

    const pinned = await submitMinuteRoot(silent, "c", 1n, "aa")
    expect(pinned.ok).toBe(false)
    if (pinned.ok) return
    expect(pinned.code).toBe(codes.SERVICE_DEGRADED)

    const mock = createMockPort(cfg, { corp: { a: 100n } })
    expect((await mock.vault.deposit("a", 10n)).ok).toBe(true)
    expect((await mock.vault.mintCapital("a", 1n)).ok).toBe(true)
    const voucher: Voucher = { nonce: "hop-tx-1", account: "a", corpAmount: 1n, issuedAtS: 0n }
    expect((await mock.vault.issueVoucher(voucher)).ok).toBe(true)
    const issuedTwice = await mock.vault.issueVoucher(voucher)
    expect(issuedTwice.ok).toBe(false)
    if (issuedTwice.ok) return
    expect(issuedTwice.code).toBe(codes.API_INTENT_REPLAY)
    expect((await mock.vault.presentVoucher(voucher, 0n)).ok).toBe(true)
    const replay = await mock.vault.presentVoucher(voucher, 0n)
    expect(replay.ok).toBe(false)
    if (replay.ok) return
    expect(replay.code).toBe(codes.API_INTENT_REPLAY)

    expect((await mock.merkleRoots.putRoot("c", 1n, "root-1")).ok).toBe(true)
    expect((await mock.merkleRoots.putRoot("c", 1n, "root-1")).ok).toBe(true)
    const got = await mock.merkleRoots.getRoot("c", 1n)
    expect(got.ok).toBe(true)
    if (!got.ok) return
    expect(got.root).toBe("root-1")

    const cfgEngine = loadConfig(packDict(loaded.pack))
    const [st] = tick(newState(cfgEngine, {}, {}), makeInputs(cfgEngine, 0n, { feed_live: 0n }))
    expect(st["tick_index"]).toBe(0n)
    expect(typeof st["mint_rate"] === "bigint").toBe(true)

    const services = asObj(atPath(loaded.pack, ["sections", "arch", "services"]))
    for (const sid of ["attestor", "llm", "sampler", "buyback"]) {
      const row = asObj(services[sid] ?? null)
      expect(asText(row["fail_mode"])).toBe("open")
      expect(asBig(row["blocks_tick"])).toBe(0n)
    }
  })
})

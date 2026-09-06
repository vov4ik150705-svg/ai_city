import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { bytesEq, loadPack, parseJson, utf8, fromUtf8, type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import {
  hexToBytes,
  leafHash,
  loadConfig,
  merkleRoot,
  newState,
  tick,
  TickError,
  type Dict,
} from "@corporator/engine"
import {
  cidV1,
  cityDayCid,
  cityDayOf,
  cityDayPayload,
  domainsDiffer,
  emptyAttestorState,
  keyIsCityDay,
  loadAttestorPack,
  memoryRootStore,
  rootPeriodOk,
  stepAttestor,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function vectorJson(id: string): Json {
  return parseJson(fromUtf8(new Uint8Array(readFileSync(join(repo, "content/out/vectors", `${id}.json`)))))
}

function asObj(value: Json | undefined): { readonly [key: string]: Json } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(codes.API_MALFORMED)
  }
  return value
}

function asText(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error(codes.API_MALFORMED)
  return value
}

function asBig(value: Json | undefined): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "string" && value.length > 0) return BigInt(value)
  throw new Error(codes.API_MALFORMED)
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

describe.sequential("C8 construction", () => {
  it("cid_matches_oracle", () => {
    const pack = loadAttestorPack(packBytes())
    const vec = asObj(vectorJson("cid_city_day"))
    const cityId = asText(vec["city_id"])
    const cityTime = asBig(vec["city_time"])
    const cityDay = asBig(vec["city_day"])
    const root = hexToBytes(asText(vec["root_hex"]))
    const payload = hexToBytes(asText(vec["payload_hex"]))
    const cid = hexToBytes(asText(vec["cid_hex"]))
    const leafHex = asText(vec["one_leaf_hash_hex"])
    const one = utf8("one-leaf")
    expect(bytesEq(leafHash(one, pack.leafPrefix), hexToBytes(leafHex))).toBe(true)
    expect(bytesEq(merkleRoot([one], pack.leafPrefix, pack.nodePrefix), root)).toBe(true)
    expect(bytesEq(merkleRoot([one], pack.leafPrefix, pack.nodePrefix), leafHash(one, pack.leafPrefix))).toBe(true)
    expect(bytesEq(cityDayPayload(cityId, cityDay, root), payload)).toBe(true)
    expect(bytesEq(cidV1(pack, payload), cid)).toBe(true)
    expect(bytesEq(cityDayCid(pack, cityId, cityTime, root), cid)).toBe(true)
    expect(cityDayOf(pack, cityTime)).toBe(cityDay)
    expect(keyIsCityDay(pack)).toBe(true)
    expect(domainsDiffer(pack)).toBe(true)
    expect(rootPeriodOk(pack)).toBe(true)
    expect(BigInt(cid.length)).toBe(pack.cidMhLength + 1n + 1n + 1n + 1n)
    const shapes = asObj(vectorJson("merkle_shapes"))
    const body = asObj(parseJson(fromUtf8(hexToBytes(asText(shapes["body_hex"])))))
    const odd = [utf8("odd-0"), utf8("odd-1"), utf8("odd-2")]
    expect(bytesEq(merkleRoot(odd, pack.leafPrefix, pack.nodePrefix), hexToBytes(asText(body["odd_root_hex"])))).toBe(
      true,
    )
    const four = [utf8("a"), utf8("b"), utf8("c"), utf8("c")]
    const three = [utf8("a"), utf8("b"), utf8("c")]
    expect(bytesEq(merkleRoot(three, pack.leafPrefix, pack.nodePrefix), merkleRoot(four, pack.leafPrefix, pack.nodePrefix))).toBe(
      false,
    )
  })

  it("attestor_down_pay_continues", () => {
    const bytes = packBytes()
    const pack = loadAttestorPack(bytes)
    expect(pack.blocksTick).toBe(0n)
    expect(pack.failMode).toBe("open")
    const store = memoryRootStore()
    const ticks = [{ cityId: "a", cityTime: 0n, leaves: [utf8("one-leaf")] }]
    const down = { ipfs: false, rpc: false }
    const first = stepAttestor(pack, store, emptyAttestorState(), ticks, pack.rootPeriodS, down)
    expect(first.root === undefined).toBe(false)
    expect(first.next.outbox.length === 0).toBe(false)
    expect(first.next.lagTicks).toBe(1n)
    expect(first.next.degraded).toBe("")
    const second = stepAttestor(
      pack,
      store,
      first.next,
      ticks,
      pack.rootPeriodS + pack.rootPeriodS,
      down,
    )
    expect(second.next.lagTicks).toBe(1n + 1n)
    expect(second.next.degraded).toBe(codes.SERVICE_DEGRADED)
    expect(second.next.outbox.length > first.next.outbox.length).toBe(true)
    const loaded = loadPack(bytes)
    const cfg = loadConfig(packDict(loaded.pack))
    tick(newState(cfg, {}, {}), makeInputs(cfg, 0n))
    let halted = false
    try {
      tick(newState(cfg, {}, {}), makeInputs(cfg, 0n, { pack_hash: "deadbeef" }))
    } catch (err) {
      halted = true
      expect(err instanceof TickError).toBe(true)
      if (err instanceof TickError) expect(err.code).toBe("PACK_HASH")
    }
    expect(halted).toBe(true)
  })
})

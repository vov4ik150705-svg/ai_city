import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { canonical, fromUtf8, loadPack, parseJson, utf8 } from "@corporator/contentpack"
import { keccak256 } from "@corporator/engine"
import type { JsonRpcPost } from "@corporator/chainport"
import { describe, expect, it } from "vitest"
import {
  emptySamplerState,
  loadSamplerPack,
  memoryPriceStore,
  priceSampleStore,
  publishOnce,
  sampleCityTime,
  type SqlRunner,
} from "../src/index.ts"
import { startMain } from "../src/main.ts"
import { asBig, asObj } from "../src/values.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function selector(sig: string): string {
  let hex = ""
  for (const b of keccak256(new TextEncoder().encode(sig))) hex += b.toString(16).padStart(2, "0")
  return hex.slice(0, 8)
}

function u256(n: bigint): string {
  return n.toString(16).padStart(64, "0")
}

function rpc(result: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id: "0", result })
}

type Logs = "fill" | "empty" | "fail"

function chainPost(packWei: bigint, ethUsd: bigint, logs: Logs): { readonly post: JsonRpcPost; readonly methods: string[] } {
  const corp = "0x" + "ab".repeat(20)
  const methods: string[] = []
  const round = "0x" + u256(1n) + u256(ethUsd) + u256(0n) + u256(0n) + u256(0n)
  const token = "0x" + u256(BigInt(corp))
  const reserves = "0x" + u256(packWei) + u256(packWei * 2n) + u256(1n)
  const swap = "0x" + u256(0n) + u256(packWei) + u256(0n) + u256(0n)
  const post: JsonRpcPost = async (body) => {
    const req = JSON.parse(body) as { readonly method?: unknown; readonly params?: unknown }
    const method = typeof req.method === "string" ? req.method : ""
    methods.push(method)
    if (method === "eth_blockNumber") return rpc("0x10")
    if (method === "eth_getBlockByNumber") {
      const old = BigInt(Math.floor(Date.now() / 1000)) - 120n
      return rpc({ timestamp: "0x" + old.toString(16) })
    }
    if (method === "eth_getLogs") {
      if (logs === "fail") return JSON.stringify({ jsonrpc: "2.0", id: "0", error: { code: "1", message: "down" } })
      if (logs === "empty") return rpc([])
      return rpc([{ data: swap }])
    }
    if (method !== "eth_call") return undefined
    const params = req.params
    const first = Array.isArray(params) ? params[0] : undefined
    const data =
      first !== null && typeof first === "object" && "data" in first && typeof first.data === "string" ? first.data : ""
    if (data === "0x" + selector("latestRoundData()")) return rpc(round)
    if (data === "0x" + selector("token0()")) return rpc(token)
    if (data === "0x" + selector("getReserves()")) return rpc(reserves)
    return undefined
  }
  return { post, methods }
}

const env = {
  CORPORATOR_FEED_ETH_USD: "0x" + "11".repeat(20),
  CORPORATOR_POOL_ADDRESS: "0x" + "22".repeat(20),
  CORPORATOR_POOL_KIND: "v2",
  CORPORATOR_CORP_TOKEN: "0x" + "ab".repeat(20),
}

describe("PL6 chain silence", () => {
  it("eth_getLogs silence does not write a live zero-turnover sample", async () => {
    const pack = loadSamplerPack(packBytes())
    const ethUsd = 300000000000n
    const scripted = chainPost(pack.wei, ethUsd, "fail")
    const store = memoryPriceStore(pack.stalenessMaxCityHours)
    await publishOnce(pack, emptySamplerState(), "chain", store, scripted.post, env)
    expect(scripted.methods.includes("eth_getLogs")).toBe(true)
    expect(store.rows.length).toBe(0)
  })

  it("an empty swap list writes turnover 0", async () => {
    const pack = loadSamplerPack(packBytes())
    const ethUsd = 300000000000n
    const scripted = chainPost(pack.wei, ethUsd, "empty")
    const store = memoryPriceStore(1n)
    await publishOnce(pack, emptySamplerState(), "chain", store, scripted.post, env)
    expect(scripted.methods.includes("eth_getLogs")).toBe(true)
    expect(store.rows.length).toBe(1)
    const row = store.rows[0]
    expect(row === undefined).toBe(false)
    if (row === undefined) return
    expect(row.dexTurnoverUsd8dec).toBe(0n)
    expect(row.feedLive).toBe(1n)
  })

  it("city time is the last tick or the pack anchor", () => {
    const pack = loadSamplerPack(packBytes())
    expect(sampleCityTime(pack, { tickIndex: undefined, cityTime: undefined })).toBe(pack.anchorHour)
    expect(sampleCityTime(pack, { tickIndex: 4n, cityTime: undefined })).toBe(
      pack.anchorHour + 4n * pack.tickLengthCityHours,
    )
    expect(sampleCityTime(pack, { tickIndex: 4n, cityTime: 20n })).toBe(20n)
  })

  it("the store stamps the world clock and writes the sample row", async () => {
    const pack = loadSamplerPack(packBytes())
    let world: Uint8Array | undefined
    const saved = new Map<string, Uint8Array>()
    const sql: SqlRunner = {
      async query(statement: string, params: readonly unknown[]): Promise<readonly { readonly [key: string]: unknown }[]> {
        if (statement.includes("FROM cities")) {
          if (world === undefined) return []
          return [{ payload: world }]
        }
        if (statement.includes("INSERT INTO price_samples")) {
          const id = params[0]
          const payload = params[1]
          if (typeof id === "string" && payload instanceof Uint8Array) saved.set(id, payload)
          return []
        }
        return []
      },
    }
    const store = priceSampleStore(sql, pack)
    expect(await store.cityTime()).toBe(pack.anchorHour)
    world = canonical({ tick_index: 4n })
    expect(await store.cityTime()).toBe(pack.anchorHour + 4n * pack.tickLengthCityHours)
    world = canonical({ tick_index: 4n, city_time: 20n })
    expect(await store.cityTime()).toBe(20n)
    await store.putSample({
      cityTime: 20n,
      ethUsd8dec: 3n,
      corpEthWeiPerWhole: 4n,
      dexTurnoverUsd8dec: 9n,
      feedLive: 1n,
    })
    const raw = saved.get("20")
    expect(raw === undefined).toBe(false)
    if (raw === undefined) return
    const body = asObj(parseJson(fromUtf8(raw)))
    expect(asBig(body["city_time"])).toBe(20n)
    expect(asBig(body["eth_usd_8dec"])).toBe(3n)
    expect(asBig(body["corp_eth_wei_per_whole"])).toBe(4n)
    expect(asBig(body["dex_turnover_usd_8dec"])).toBe(9n)
  })

  it("a corrupt world clock does not write a sample", async () => {
    const pack = loadSamplerPack(packBytes())
    let inserts = 0
    const sql: SqlRunner = {
      async query(statement: string): Promise<readonly { readonly [key: string]: unknown }[]> {
        if (statement.includes("INSERT INTO price_samples")) {
          inserts += 1
          return []
        }
        return [{ payload: utf8("nope") }]
      },
    }
    const scripted = chainPost(pack.wei, 300000000000n, "fill")
    await publishOnce(pack, emptySamplerState(), "chain", priceSampleStore(sql, pack), scripted.post, env)
    expect(scripted.methods.includes("eth_getLogs")).toBe(true)
    expect(inserts).toBe(0)
  })

  it("startMain without DATABASE_URL does not listen", async () => {
    const prevUrl = process.env.DATABASE_URL
    const prevHash = process.env.PACK_HASH
    const prevOpen = process.env.CORPORATOR_DEPOSITS_OPEN
    const prevRpc = process.env.CORPORATOR_RPC_URL
    const prevCode = process.exitCode
    delete process.env.DATABASE_URL
    delete process.env.CORPORATOR_DEPOSITS_OPEN
    delete process.env.CORPORATOR_RPC_URL
    process.env.PACK_HASH = loadPack(packBytes()).hash
    try {
      await startMain()
      expect(process.exitCode).toBe(1)
    } finally {
      if (prevUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = prevUrl
      if (prevHash === undefined) delete process.env.PACK_HASH
      else process.env.PACK_HASH = prevHash
      if (prevOpen === undefined) delete process.env.CORPORATOR_DEPOSITS_OPEN
      else process.env.CORPORATOR_DEPOSITS_OPEN = prevOpen
      if (prevRpc === undefined) delete process.env.CORPORATOR_RPC_URL
      else process.env.CORPORATOR_RPC_URL = prevRpc
      process.exitCode = prevCode
    }
  })
})

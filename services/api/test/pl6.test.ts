import { readFileSync } from "node:fs"
import { join } from "node:path"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { keccak256 } from "@corporator/engine"
import type { JsonRpcPost } from "@corporator/chainport"
import { describe, expect, it } from "vitest"
import { emptySamplerState, loadSamplerPack, priceSampleStore, publishOnce } from "../../sampler/src/index.ts"
import { inputsAhead, lastCityTimeOf, tickOnce } from "../src/scheduler.ts"
import { listBytes, putBytes, type Store } from "../src/store.ts"
import { asBigint, asObj, bootHost, repo } from "./harness.ts"

describe("PL6 sampler feeds the tick", () => {
  it("empty price_samples is not a live feed", async () => {
    const host = await bootHost()
    const inputs = await inputsAhead(host.ctx, host.state, "a", 1n, host.store)
    expect(asBigint(inputs["feed_live"])).toBe(0n)
    expect(asBigint(inputs["dex_turnover_usd_8dec"])).toBe(0n)
  })

  it("a read error is not a live feed", async () => {
    const host = await bootHost()
    const broken: Store = {
      async exec(): Promise<void> {
        throw new Error("price_samples down")
      },
      async query(): Promise<readonly { readonly [key: string]: unknown }[]> {
        throw new Error("price_samples down")
      },
      async close(): Promise<void> {},
    }
    const inputs = await inputsAhead(host.ctx, host.state, "a", 1n, broken)
    expect(asBigint(inputs["feed_live"])).toBe(0n)
    expect(asBigint(inputs["dex_turnover_usd_8dec"])).toBe(0n)
  })

  it("the tick takes the latest sample by city time, not the sum or the client body", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const length = asBigint(cfg["tick_length_city_hours"])
    const now = lastCityTimeOf(host.state) + length
    const eth = asBigint(cfg["eth_usd_8dec"])
    const corp = asBigint(cfg["seed_corp_wei"])
    const earlier = 3n
    const later = 5n
    const bodyTurnover = 100n
    await putBytes(
      host.store,
      "price_samples",
      "a:" + now.toString(),
      canonical({
        city_time: now,
        eth_usd_8dec: eth,
        corp_eth_wei_per_whole: corp,
        dex_turnover_usd_8dec: later,
        feed_live: 0n,
      }),
      undefined,
    )
    await putBytes(
      host.store,
      "price_samples",
      "z:" + (now - length).toString(),
      canonical({
        city_time: now - length,
        eth_usd_8dec: eth,
        corp_eth_wei_per_whole: corp,
        dex_turnover_usd_8dec: earlier,
      }),
      undefined,
    )
    const posted = await host.handle(
      "POST",
      "/not-a-command",
      canonical({ dex_turnover_usd_8dec: bodyTurnover }),
    )
    expect(posted.status).not.toBe(host.ctx.httpOk)
    await tickOnce(host)
    const stored = await listBytes(host.store, "tick_inputs", "a:")
    expect(stored.length).toBe(1)
    const header = asObj(parseJson(fromUtf8(stored[0]?.payload ?? new Uint8Array())))
    expect(asBigint(header["dex_turnover_usd_8dec"])).toBe(later)
    expect(asBigint(header["dex_turnover_usd_8dec"])).not.toBe(earlier + later)
    expect(asBigint(header["dex_turnover_usd_8dec"])).not.toBe(bodyTurnover)
    expect(asBigint(header["feed_live"])).toBe(1n)
  })

  it("a sampler row is visible to inputsAhead", async () => {
    const host = await bootHost()
    const pack = loadSamplerPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json"))))
    const ethUsd = 300000000000n
    const scripted = chainPost(pack.wei, ethUsd, "fill")
    const samples = priceSampleStore(host.store, pack)
    await publishOnce(pack, emptySamplerState(), "chain", samples, scripted.post, chainEnv)
    const inputs = await inputsAhead(host.ctx, host.state, "a", 1n, host.store)
    expect(scripted.methods.includes("eth_getLogs")).toBe(true)
    expect(asBigint(inputs["city_time"])).toBe(pack.anchorHour)
    expect(asBigint(inputs["feed_live"])).toBe(1n)
    expect(asBigint(inputs["dex_turnover_usd_8dec"])).toBe(ethUsd)
  })

  it("a sample stamped with an old city clock is not a live feed", async () => {
    const host = await bootHost()
    const pack = loadSamplerPack(new Uint8Array(readFileSync(join(repo, "content/out/pack.json"))))
    await putBytes(host.store, "cities", "world", canonical({ tick_index: 0n, city_time: 0n }), "demo")
    const ethUsd = 300000000000n
    const scripted = chainPost(pack.wei, ethUsd, "fill")
    await publishOnce(pack, emptySamplerState(), "chain", priceSampleStore(host.store, pack), scripted.post, chainEnv)
    const stored = await listBytes(host.store, "price_samples", "")
    expect(stored.length).toBe(1)
    const body = asObj(parseJson(fromUtf8(stored[0]?.payload ?? new Uint8Array())))
    expect(asBigint(body["city_time"])).toBe(0n)
    const inputs = await inputsAhead(host.ctx, host.state, "a", 1n, host.store)
    expect(asBigint(inputs["feed_live"])).toBe(0n)
    expect(asBigint(inputs["dex_turnover_usd_8dec"])).toBe(0n)
  })
})

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

const chainEnv = {
  CORPORATOR_FEED_ETH_USD: "0x" + "11".repeat(20),
  CORPORATOR_POOL_ADDRESS: "0x" + "22".repeat(20),
  CORPORATOR_POOL_KIND: "v2",
  CORPORATOR_CORP_TOKEN: "0x" + "ab".repeat(20),
}

function chainPost(packWei: bigint, ethUsd: bigint, logs: "fill" | "empty" | "fail"): {
  readonly post: JsonRpcPost
  readonly methods: string[]
} {
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

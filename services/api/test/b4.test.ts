import { createServer } from "node:http"
import { afterEach, describe, expect, it } from "vitest"
import { canonical, fromUtf8, parseJson, utf8, type Json } from "@corporator/contentpack"
import { listenPorts } from "@corporator/protocol"
import { PRIZE_KETTLE_FARM, PRIZE_KETTLE_MONTH } from "@corporator/chainport"
import { splitTurnover } from "../../buyback/src/index.ts"
import { worldLockHeld } from "../src/city_lock.ts"
import { publishBuybackFrame, useBuybackPoster, type BuybackPoster } from "../src/buyback_frame.ts"
import { tickOnce } from "../src/scheduler.ts"
import { putBytes } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, bootHost } from "./harness.ts"
import { walk } from "../src/values.ts"

const posts: Uint8Array[] = []

afterEach(() => {
  posts.length = 0
  useBuybackPoster(undefined)
})

function capture(): BuybackPoster {
  return async (body) => {
    posts.push(body)
  }
}

function row(raw: Uint8Array): { readonly [key: string]: Json } {
  return asObj(parseJson(fromUtf8(raw)))
}

function asMap(value: Json | undefined): { readonly [key: string]: bigint } {
  const obj = asObj(value ?? null)
  const out: { [key: string]: bigint } = {}
  for (const key of Object.keys(obj)) out[key] = asBigint(obj[key])
  return out
}

async function sample(
  host: Awaited<ReturnType<typeof bootHost>>,
  cityTime: bigint,
  ethUsd: bigint,
  corpWei: bigint,
  turnoverUsd: bigint,
): Promise<void> {
  await putBytes(
    host.store,
    "price_samples",
    "b4:" + cityTime.toString(),
    canonical({
      city_time: cityTime,
      eth_usd_8dec: ethUsd,
      corp_eth_wei_per_whole: corpWei,
      dex_turnover_usd_8dec: turnoverUsd,
    }),
    undefined,
  )
}

describe("B4 buyback frame", () => {
  it("posts shares, summed demand, and month slices, with no fills", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const now = asBigint(host.state["city_time"])
    const eth = asBigint(cfg["eth_usd_8dec"])
    const wei = asBigint(cfg["wei"])
    const corp = asBigint(cfg["seed_corp_wei"])
    expect(eth > 0n && wei > 0n && corp > 0n).toBe(true)
    const turnoverUsd = eth + 1n
    await sample(host, now, eth, corp, turnoverUsd)
    const cities = asEngineDict(host.state["cities"])
    const cityA = asEngineDict(cities["a"])
    cityA["account_kind"] = "wallet"
    cityA["fragment_owed"] = { NVDA: 4n }
    cities["b"] = { id: "b", account_kind: "wallet", fragment_owed: { NVDA: 5n, TSLA: 2n } }
    const wallet = "0x" + "ab".repeat(20)
    host.state["season_settlement"] = {
      by_asset: {
        NVDA: { payouts: [{ wallet, payout: 3n, city_id: "a" }] },
        TSLA: { payouts: [{ wallet, payout: 0n, city_id: "a" }] },
      },
    }
    useBuybackPoster(capture())
    expect(await publishBuybackFrame(host)).toBe(1n)
    expect(posts.length).toBe(1)
    const body = row(posts[0] ?? utf8(""))
    const turnoverWei = (turnoverUsd * wei) / eth
    const split = splitTurnover(
      turnoverWei,
      asBigint(walk(host.ctx.pack, ["generated", "economy", "fee_split", "fund_bps"])),
      asBigint(walk(host.ctx.pack, ["generated", "economy", "fee_split", "leaderboard_bps"])),
      asBigint(walk(host.ctx.pack, ["generated", "economy", "fee_split", "farm_bps"])),
      asBigint(walk(host.ctx.pack, ["generated", "economy", "fee_split", "studio_bps"])),
      asBigint(cfg["bps"]),
    )
    expect(asBigint(body["turnover_wei"])).toBe(turnoverWei)
    expect(asBigint(body["farm_wei"])).toBe(split.farmWei)
    expect(asBigint(body["fund_wei"])).toBe(split.fundWei)
    expect(asBigint(body["leaderboard_wei"])).toBe(split.leaderboardWei)
    expect(asBigint(body["studio_wei"])).toBe(split.studioWei)
    const demand = asMap(body["fragment_demand"])
    expect(demand["NVDA"]).toBe(9n)
    expect(demand["TSLA"]).toBe(2n)
    expect(demand["COIN"]).toBe(0n)
    const depths = asMap(body["depths_wei"])
    const depth = asBigint(cfg["risk4_depth_hi_wei"])
    for (const ticker of Object.keys(demand)) expect(depths[ticker]).toBe(depth)
    expect(body["farm_fills"]).toBe(undefined)
    expect(body["month_fills"]).toBe(undefined)
    expect(body["hop_ok"]).toBe(undefined)
    expect(body["caller_service"]).toBe(undefined)
    const slices = body["slices"]
    expect(Array.isArray(slices)).toBe(true)
    if (!Array.isArray(slices)) return
    expect(slices.length).toBe(1)
    const slice = asObj(slices[0] ?? null)
    expect(asBigint(slice["kettle"])).toBe(PRIZE_KETTLE_MONTH)
    expect(asBigint(slice["kettle"])).not.toBe(PRIZE_KETTLE_FARM)
    expect(asText(slice["token"])).toBe("NVDA")
    expect(asText(slice["caller_service"])).toBe(
      asText(walk(host.ctx.pack, ["sections", "arch", "keys", "voucher_signer", "service"])),
    )
    const players = slice["players"]
    const amounts = slice["amounts"]
    expect(Array.isArray(players) && players.length === 1).toBe(true)
    expect(Array.isArray(amounts) && amounts.length === 1 && asBigint(amounts[0])).toBe(3n)
    expect(await publishBuybackFrame(host)).toBe(0n)
    expect(posts.length).toBe(1)
    const cadence = asBigint(walk(host.ctx.pack, ["sections", "launch", "params", "buyback_cadence_city_hours", "v"]))
    host.state["city_time"] = now + cadence
    expect(await publishBuybackFrame(host)).toBe(1n)
    expect(posts.length).toBe(2)
  })

  it("sends nothing when the feed is dead", async () => {
    const host = await bootHost()
    useBuybackPoster(capture())
    expect(await publishBuybackFrame(host)).toBe(0n)
    const now = asBigint(host.state["city_time"])
    const stale = asBigint(host.ctx.cfg["stale_max"])
    await sample(host, now - (stale + 1n), asBigint(host.ctx.cfg["eth_usd_8dec"]), asBigint(host.ctx.cfg["seed_corp_wei"]), asBigint(host.ctx.cfg["eth_usd_8dec"]))
    expect(await publishBuybackFrame(host)).toBe(0n)
    expect(posts.length).toBe(0)
  })

  it("leaves demo fragment debt out of farm demand", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const now = asBigint(host.state["city_time"])
    await sample(host, now, asBigint(cfg["eth_usd_8dec"]), asBigint(cfg["seed_corp_wei"]), asBigint(cfg["eth_usd_8dec"]))
    const cities = asEngineDict(host.state["cities"])
    const cityA = asEngineDict(cities["a"])
    cityA["account_kind"] = "wallet"
    cityA["fragment_owed"] = { NVDA: 4n }
    cities["demo"] = { account_kind: "demo", fragment_owed: { NVDA: 100n } }
    useBuybackPoster(capture())
    expect(await publishBuybackFrame(host)).toBe(1n)
    const demand = asMap(row(posts[0] ?? utf8("")).fragment_demand)
    expect(demand["NVDA"]).toBe(4n)
  })

  it("releases the hour when the post fails", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const now = asBigint(host.state["city_time"])
    await sample(host, now, asBigint(cfg["eth_usd_8dec"]), asBigint(cfg["seed_corp_wei"]), asBigint(cfg["eth_usd_8dec"]))
    let n = 0
    useBuybackPoster(async (body) => {
      n += 1
      posts.push(body)
      if (n === 1) throw new Error("buyback down")
    })
    expect(await publishBuybackFrame(host)).toBe(0n)
    expect(await publishBuybackFrame(host)).toBe(1n)
    expect(posts.length).toBe(2)
  })

  it("releases the hour when buyback answers degraded", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const now = asBigint(host.state["city_time"])
    await sample(host, now, asBigint(cfg["eth_usd_8dec"]), asBigint(cfg["seed_corp_wei"]), asBigint(cfg["eth_usd_8dec"]))
    const server = createServer((_req, res) => {
      res.statusCode = 200
      res.end(Buffer.from(canonical({ ok: 0n, degraded: 1n, code: "SERVICE_DEGRADED" })))
    })
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(Number(listenPorts.buyback), "127.0.0.1", () => resolve())
    })
    try {
      expect(await publishBuybackFrame(host)).toBe(0n)
    } finally {
      await new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    }
    useBuybackPoster(async (body) => {
      posts.push(body)
    })
    expect(await publishBuybackFrame(host)).toBe(1n)
    expect(posts.length).toBe(1)
  })

  it("claims the hour once under the lock and posts after it", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const now = asBigint(host.state["city_time"])
    await sample(host, now, asBigint(cfg["eth_usd_8dec"]), asBigint(cfg["seed_corp_wei"]), asBigint(cfg["eth_usd_8dec"]))
    let held = false
    useBuybackPoster(async (body) => {
      held = worldLockHeld()
      posts.push(body)
    })
    const [first, second] = await Promise.all([publishBuybackFrame(host), publishBuybackFrame(host)])
    expect(first + second).toBe(1n)
    expect(posts.length).toBe(1)
    expect(held).toBe(false)
  })

  it("does not make the tick wait for the post", async () => {
    const host = await bootHost()
    const cfg = host.ctx.cfg
    const anchor = asBigint(cfg["anchor_hour"])
    host.state["city_time"] = anchor
    await sample(host, anchor, asBigint(cfg["eth_usd_8dec"]), asBigint(cfg["seed_corp_wei"]), asBigint(cfg["eth_usd_8dec"]))
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    let phase = "idle"
    useBuybackPoster(async () => {
      phase = "post"
      expect(worldLockHeld()).toBe(false)
      await gate
      phase = "done"
    })
    const pending = tickOnce(host)
    const winner = await Promise.race([
      pending.then(() => "tick"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000)),
    ])
    expect(winner).toBe("tick")
    let spins = 0
    while (phase === "idle" && spins < 50) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      spins += 1
    }
    expect(phase).toBe("post")
    release()
    await pending
    expect(phase).toBe("done")
  })
})

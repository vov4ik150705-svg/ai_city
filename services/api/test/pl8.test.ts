import { afterEach, describe, expect, it } from "vitest"
import { canonical, parseJson, fromUtf8 } from "@corporator/contentpack"
import { createMockPort, type AssetPort } from "@corporator/chainport"
import { publishBuybackFrame, useBuybackPoster } from "../src/buyback_frame.ts"
import { catchUpOnce } from "../src/scheduler.ts"
import { putBytes } from "../src/store.ts"
import { asBigint, asObj, asText, bootHost } from "./harness.ts"
import { portCfgFromPack } from "../src/custody.ts"
import { walk } from "../src/values.ts"

function sliceId(body: Uint8Array): string {
  const row = asObj(parseJson(fromUtf8(body)))
  const slices = row["slices"]
  if (!Array.isArray(slices) || slices.length === 0) return ""
  return asText(asObj(slices[0] ?? null)["batch_id"])
}

afterEach(() => {
  useBuybackPoster(undefined)
  delete process.env.CORPORATOR_VAULT_HOUSE
})

describe("PL8 live fund and month batch", () => {
  it("two frames of one settlement do not slice twice", async () => {
    const seen: Uint8Array[] = []
    useBuybackPoster(async (body) => {
      seen.push(body)
    })
    const host = await bootHost()
    const now = asBigint(host.state["city_time"])
    const cfg = host.ctx.cfg
    await putBytes(
      host.store,
      "price_samples",
      "pl8:" + now.toString(),
      canonical({
        city_time: now,
        eth_usd_8dec: asBigint(cfg["eth_usd_8dec"]),
        corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
        dex_turnover_usd_8dec: asBigint(cfg["eth_usd_8dec"]) + 1n,
      }),
      undefined,
    )
    const wallet = "0x" + "ab".repeat(20)
    host.state["season_settlement"] = {
      by_asset: { NVDA: { payouts: [{ wallet, payout: 3n }] } },
    }
    expect(await publishBuybackFrame(host)).toBe(1n)
    const buyCadence = asBigint(walk(host.ctx.pack, ["sections", "launch", "params", "buyback_cadence_city_hours", "v"]))
    host.state["city_time"] = now + buyCadence
    await putBytes(
      host.store,
      "price_samples",
      "pl8b:" + asBigint(host.state["city_time"]).toString(),
      canonical({
        city_time: asBigint(host.state["city_time"]),
        eth_usd_8dec: asBigint(cfg["eth_usd_8dec"]),
        corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
        dex_turnover_usd_8dec: asBigint(cfg["eth_usd_8dec"]) + 1n,
      }),
      undefined,
    )
    expect(await publishBuybackFrame(host)).toBe(1n)
    expect(seen.length).toBe(2)
    const first = asObj(parseJson(fromUtf8(seen[0] ?? new Uint8Array())))
    const second = asObj(parseJson(fromUtf8(seen[1] ?? new Uint8Array())))
    expect(Array.isArray(first["slices"])).toBe(true)
    expect(second["slices"]).toBe(undefined)
    const firstId = sliceId(seen[0] ?? new Uint8Array())
    const season = asBigint(walk(host.ctx.pack, ["sections", "balance", "params", "season_city_days", "v"]))
    const periods = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "prize_periods_per_season", "v"]))
    const span = periods === 0n ? 0n : season / periods
    const ticksDay = asBigint(cfg["ticks_day"])
    const length = asBigint(cfg["tick_length_city_hours"])
    const settle = asBigint(walk(host.ctx.pack, ["sections", "time", "params", "efficiency_recalc_hour", "v"]))
    const later = asBigint(host.state["city_time"]) + (span * ticksDay + settle) * length
    host.state["city_time"] = later
    await putBytes(
      host.store,
      "price_samples",
      "pl8c:" + later.toString(),
      canonical({
        city_time: later,
        eth_usd_8dec: asBigint(cfg["eth_usd_8dec"]),
        corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
        dex_turnover_usd_8dec: asBigint(cfg["eth_usd_8dec"]) + 1n,
      }),
      undefined,
    )
    expect(await publishBuybackFrame(host)).toBe(1n)
    const third = asObj(parseJson(fromUtf8(seen[2] ?? new Uint8Array())))
    expect(Array.isArray(third["slices"])).toBe(true)
    expect(sliceId(seen[2] ?? new Uint8Array())).not.toBe(firstId)
  })

  it("live turnover does not mint capital before a CORP deposit", async () => {
    const host = await bootHost()
    const now = asBigint(host.state["city_time"])
    const cfg = host.ctx.cfg
    const turnover = asBigint(cfg["eth_usd_8dec"]) * 1000n
    await putBytes(
      host.store,
      "price_samples",
      "pl8live:" + now.toString(),
      canonical({
        city_time: now,
        eth_usd_8dec: asBigint(cfg["eth_usd_8dec"]),
        corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
        dex_turnover_usd_8dec: turnover,
      }),
      undefined,
    )
    const seen: bigint[] = []
    const original = host.stepTick.bind(host)
    host.stepTick = async (inputs, attestor) => {
      seen.push(asBigint(inputs["dex_turnover_usd_8dec"]))
      return original(inputs, attestor)
    }
    const mock = createMockPort(portCfgFromPack(host.ctx.pack))
    const house = "0x" + "44".repeat(20)
    process.env.CORPORATOR_VAULT_HOUSE = house
    let backing = 0n
    const live = {
      ...mock,
      kind: "rpc",
      vault: {
        ...mock.vault,
        async backingOf(account: string) {
          if (account !== house) return mock.vault.backingOf(account)
          return { ok: true as const, amount: backing }
        },
      },
    } as AssetPort
    const before = asBigint(host.state["capital_outstanding"])
    await catchUpOnce(host, undefined, 1n, live)
    expect(seen.length > 0).toBe(true)
    expect(seen.every((n) => n === 0n)).toBe(true)
    expect(asBigint(host.state["capital_outstanding"])).toBe(before)
    const marked = seen.length
    backing = asBigint(cfg["wei"])
    await catchUpOnce(host, undefined, 1n, live)
    expect(seen.length > marked).toBe(true)
    expect(seen.slice(marked).every((n) => n === 0n)).toBe(true)
    expect(asBigint(host.state["capital_outstanding"]) > before).toBe(true)
  })
})

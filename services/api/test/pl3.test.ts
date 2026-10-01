import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { cityClock } from "@corporator/engine"
import { describe, expect, it } from "vitest"
import { projectState } from "../src/project.ts"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { putJson } from "../src/store.ts"
import { bootHost, demoAuth, seedPlayerCapital } from "./harness.ts"

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function cityOf(host: Awaited<ReturnType<typeof bootHost>>, cityId: string) {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function cmd(intent: string, cityTime: bigint, extra: { readonly [key: string]: string | bigint } = {}): Uint8Array {
  return canonical({ intent_id: intent, expected_city_time: cityTime, ...extra })
}

async function walletAuth(host: Awaited<ReturnType<typeof bootHost>>): Promise<{
  readonly cityId: string
  readonly headers: { readonly authorization: string }
}> {
  const cityId = "a"
  const city = cityOf(host, cityId)
  city["account_kind"] = "wallet"
  city["wallet"] = "0x" + "ab".repeat(20)
  const sessionId = "pl3-wallet"
  const expires = asBigint(host.state["city_time"]) + 10_000n
  await putJson(
    host.store,
    "sessions",
    sessionId,
    { kind: "session", city_id: cityId, account_kind: "wallet", expires_city_time: expires.toString() },
    "wallet",
  )
  return { cityId, headers: { authorization: "Bearer " + sessionId } }
}

function exchangeLevel(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
}

describe("PL3 exchange window and one hire", () => {
  it("projects mint_rate from state and not the anchor", async () => {
    const host = await bootHost()
    host.state["mint_rate"] = 1777n
    const envelope = asObj(projectState(host.ctx, host.state, "a", []))
    const buildings = asObj(asObj(envelope["sections"])["tick.building_level"])
    expect(asBigint(buildings["mint_rate"])).toBe(1777n)
    const anchor = asBigint(walk(host.ctx.pack, ["generated", "economy", "anchor_mint_rate"]))
    expect(asBigint(buildings["mint_rate"])).not.toBe(anchor)
  })

  it("buy below the exchange level is CITY_LEVEL_TOO_LOW on prepare and on the direct post", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const t = asBigint(host.state["city_time"])
    const direct = await host.handle("POST", "/command/buy_stock", cmd("pl3-direct", t, { ticker: "NVDA", amount: wei }), auth.headers)
    expect(bodyCode(direct.body)).toBe(codes.CITY_LEVEL_TOO_LOW)
    const prepared = await host.handle(
      "POST",
      "/command/buy_stock",
      cmd("pl3-prep", t, { phase: "prepare", ticker: "NVDA", amount: wei }),
      auth.headers,
    )
    expect(bodyCode(prepared.body)).toBe(codes.CITY_LEVEL_TOO_LOW)
    expect(asBigint(city["corp_held"])).toBe(wei)
    expect(asBigint(city["city_level"], 1n) < exchangeLevel(host)).toBe(true)
  })

  it("buy outside bank hours is BANK_CLOSED and Sunday is BANK_SUNDAY", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["city_level"] = exchangeLevel(host)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const cfg = host.ctx.cfg
    const anchor = asBigint(cfg["anchor_hour"])
    const close = asBigint(cfg["bank_close_hour"])
    const ticksDay = asBigint(cfg["ticks_day"])
    let delta = close - anchor
    if (delta < 0n) delta += ticksDay
    host.state["tick_index"] = delta
    const closedHour = cityClock(cfg, delta)[1]
    expect(closedHour).toBe(close)
    const t = asBigint(host.state["city_time"])
    const closed = await host.handle(
      "POST",
      "/command/buy_stock",
      cmd("pl3-closed", t, { phase: "prepare", ticker: "NVDA", amount: wei }),
      auth.headers,
    )
    expect(bodyCode(closed.body)).toBe(codes.BANK_CLOSED)
    const week = asBigint(cfg["city_week_days"])
    const dayOffset = (asBigint(cfg["bank_closed_weekday"]) - asBigint(cfg["anchor_weekday"]) + week) % week
    host.state["tick_index"] = dayOffset * ticksDay
    const sunday = await host.handle(
      "POST",
      "/command/buy_stock",
      cmd("pl3-sunday", t, { phase: "prepare", ticker: "NVDA", amount: wei }),
      auth.headers,
    )
    expect(bodyCode(sunday.body)).toBe(codes.BANK_SUNDAY)
    expect(asBigint(city["corp_held"])).toBe(wei)
  })

  it("a second hire when capital pays for one agent is refused", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const cost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, cost)
    const t = asBigint(host.state["city_time"])
    const first = await host.handle(
      "POST",
      "/command/hire",
      cmd("pl3-h1", t, { role: "engineer" }),
      auth.headers,
    )
    expect(Number(first.status)).toBe(Number(host.ctx.httpOk))
    expect(bodyCode(first.body)).toBe("")
    const second = await host.handle(
      "POST",
      "/command/hire",
      cmd("pl3-h2", t, { role: "engineer" }),
      auth.headers,
    )
    expect(bodyCode(second.body)).toBe(codes.NOT_ENOUGH_CAPITAL)
    const agents = cityOf(host, auth.cityId)["agents"]
    expect(Array.isArray(agents) ? agents.length : 0).toBe(1)
  })
})

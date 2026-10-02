import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { bankOpen, cityClock, windowSettleDue } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import {
  createMockPort,
  createRpcPort,
  PRIZE_KETTLE_FARM,
  silentTransport,
  type AssetPort,
} from "@corporator/chainport"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { applyBuyStock, hopFillFromEnv, hopPriced } from "../src/commit_exchange.ts"
import { applyDeposit, applyLiveWithdraw, flushChainMint } from "../src/commit_bank.ts"
import { applyLive } from "../src/commit.ts"
import { portCfgFromPack, pickApiPort, prizeCustodyLive, selectApiPort } from "../src/custody.ts"
import { settleServerMint } from "../src/commands.ts"
import { bindDeposits } from "../src/main.ts"
import { getBytes, putJson } from "../src/store.ts"
import { bootHost, demoAuth, makeInputs, repo, seedPlayerCapital } from "./harness.ts"

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function cmdBody(intent: string, cityTime: bigint, extra: { readonly [key: string]: string | bigint } = {}): Uint8Array {
  return canonical({ intent_id: intent, expected_city_time: cityTime, ...extra })
}

function cityOf(host: Awaited<ReturnType<typeof bootHost>>, cityId: string) {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function openExchange(host: Awaited<ReturnType<typeof bootHost>>, city: ReturnType<typeof cityOf>): void {
  city["city_level"] = asBigint(walk(host.ctx.pack, ["sections", "buildings", "buildings", "exchange", "city_level_req"]))
}

function gridCost(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  const costs = asObj(walk(host.ctx.pack, ["generated", "balance", "research_node_cost"]))
  return asBigint(costs["grid"])
}

describe("H2.1 research_start", () => {
  it("pays_research_start_without_completing_node", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const cost = gridCost(host)
    expect(cost > 0n).toBe(true)
    seedPlayerCapital(host, auth.cityId, cost + cost)
    const city = cityOf(host, auth.cityId)
    const before = asBigint(city["capital"])
    expect(before >= cost).toBe(true)
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/research_start", cmdBody("rs1", t, { axis_id: "grid" }), auth.headers)
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(asText(city["research_focus"])).toBe("grid")
    expect(asBigint(city["research_progress"])).toBe(0n)
    expect(asText(city["objective"])).toBe(asText(host.ctx.cfg["research_objective"]))
    expect(asBigint(city["capital"])).toBe(before - cost)
    const unlocked = city["research_unlocked"]
    expect(Array.isArray(unlocked) ? unlocked.includes("grid") : false).toBe(false)
  })

  it("refuses_unknown_or_empty_research_axis", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/research_start", cmdBody("rs2", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/research_start",
      cmdBody("rs3", t, { axis_id: "nope" }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
  })

  it("refuses_research_start_without_capital", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    city["capital"] = 0n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/research_start", cmdBody("rs4", t, { axis_id: "grid" }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CAPITAL)
    expect(asText(city["research_focus"])).toBe("")
  })

  it("keeps_research_start_idempotent", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const cost = gridCost(host)
    seedPlayerCapital(host, auth.cityId, cost + cost)
    const city = cityOf(host, auth.cityId)
    const t = asBigint(host.state["city_time"])
    const first = await host.handle("POST", "/command/research_start", cmdBody("rs5", t, { axis_id: "grid" }), auth.headers)
    expect(bodyCode(first.body)).toBe("")
    const mid = asBigint(city["capital"])
    city["research_progress"] = 3n
    const second = await host.handle(
      "POST",
      "/command/research_start",
      cmdBody("rs6", t, { axis_id: "grid" }),
      auth.headers,
    )
    expect(bodyCode(second.body)).toBe("")
    expect(asBigint(city["capital"])).toBe(mid)
    expect(asBigint(city["research_progress"])).toBe(3n)
    city["research_unlocked"] = ["grid"]
    city["research_focus"] = ""
    const third = await host.handle(
      "POST",
      "/command/research_start",
      cmdBody("rs7", t, { axis_id: "grid" }),
      auth.headers,
    )
    expect(bodyCode(third.body)).toBe("")
    expect(asBigint(city["capital"])).toBe(mid)
    expect(asText(city["research_focus"])).toBe("")
  })
})

async function walletAuth(host: Awaited<ReturnType<typeof bootHost>>): Promise<{
  readonly cityId: string
  readonly headers: { readonly authorization: string }
}> {
  const cityId = "a"
  const city = cityOf(host, cityId)
  city["account_kind"] = "wallet"
  const sessionId = "wallet-open-district"
  const expires = asBigint(host.state["city_time"]) + 10_000n
  await putJson(
    host.store,
    "sessions",
    sessionId,
    {
      kind: "session",
      city_id: cityId,
      account_kind: "wallet",
      expires_city_time: expires.toString(),
    },
    "wallet",
  )
  return { cityId, headers: { authorization: "Bearer " + sessionId } }
}

function stakeMinOf(host: Awaited<ReturnType<typeof bootHost>>, ticker: string): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

function openedIds(city: ReturnType<typeof cityOf>): readonly string[] {
  const out: string[] = []
  const raw = city["districts"]
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

describe("H2.2 open_district", () => {
  it("refuses_open_district_without_wallet", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    city["stake_settled"] = { NVDA: stakeMinOf(host, "NVDA") }
    city["corp_held"] = 1n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od1", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.WALLET_NOT_CONNECTED)
    expect(openedIds(city)).toEqual([])
    expect(asBigint(city["corp_held"])).toBe(1n)
  })

  it("refuses_unknown_or_empty_district", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/open_district", cmdBody("od2", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od3", t, { district_id: "nope" }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
  })

  it("locks_unplayable_district_before_stake", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const defs = asObj(walk(host.ctx.pack, ["sections", "districts", "districts"]))
    asEngineDict(defs["compute"])["playable_v1"] = false
    city["stake_settled"] = { NVDA: stakeMinOf(host, "NVDA") }
    city["corp_held"] = 1n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od4", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.DISTRICT_LOCKED)
    expect(openedIds(city)).toEqual([])
  })

  it("keeps_open_district_idempotent_without_corp_spend", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["districts"] = ["compute"]
    city["stake_settled"] = {}
    city["corp_held"] = 0n
    city["city_level"] = 1n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od5", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(openedIds(city)).toEqual(["compute"])
    expect(asBigint(city["corp_held"])).toBe(0n)
  })

  it("refuses_open_district_below_s_min", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const need = stakeMinOf(host, "NVDA")
    expect(need > 0n).toBe(true)
    city["stake_settled"] = { NVDA: need - 1n }
    city["corp_held"] = 1n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od6", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.STAKE_BELOW_THRESHOLD)
    expect(openedIds(city)).toEqual([])
    expect(asBigint(city["corp_held"])).toBe(1n)
  })

  it("refuses_open_district_without_corp", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["stake_settled"] = { NVDA: stakeMinOf(host, "NVDA") }
    city["corp_held"] = 0n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od7", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(openedIds(city)).toEqual(["compute"])
    expect(asBigint(city["corp_held"])).toBe(0n)
    expect(asBigint(asEngineDict(city["district_tiers"])["compute"], 0n)).toBe(1n)
  })

  it("opens_district_at_s_min_without_deducting_corp", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const need = stakeMinOf(host, "NVDA")
    city["stake_settled"] = { NVDA: need }
    city["corp_held"] = 9n
    city["city_level"] = 1n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od8", t, { ticker: "NVDA" }),
      auth.headers,
    )
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(openedIds(city)).toEqual(["compute"])
    expect(asBigint(city["corp_held"])).toBe(9n)
    const again = await host.handle(
      "POST",
      "/command/open_district",
      cmdBody("od9", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(again.body)).toBe("")
    expect(openedIds(city)).toEqual(["compute"])
    expect(asBigint(city["corp_held"])).toBe(9n)
  })
})

function tokensOf(city: ReturnType<typeof cityOf>, ticker: string): bigint {
  return asBigint(asEngineDict(city["tokens_held"])[ticker], 0n)
}

function settledOf(city: ReturnType<typeof cityOf>, ticker: string): bigint {
  return asBigint(asEngineDict(city["stake_settled"])[ticker], 0n)
}

function stakeStepOf(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "progression", "params", "stake_mult_step", "v"]))
}

describe("H2.3 stake", () => {
  it("refuses_unknown_or_empty_stake_district", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/stake", cmdBody("st1", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/stake",
      cmdBody("st2", t, { district_id: "nope" }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
  })

  it("locks_stake_on_closed_district", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const need = stakeMinOf(host, "NVDA")
    city["tokens_held"] = { NVDA: need }
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/stake",
      cmdBody("st3", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(settledOf(city, "NVDA")).toBe(need)
    expect(tokensOf(city, "NVDA")).toBe(0n)
    expect(openedIds(city)).toEqual([])
  })

  it("refuses_stake_short_of_next_multiple", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const unit = stakeStepOf(host) * stakeMinOf(host, "NVDA")
    expect(unit > 0n).toBe(true)
    city["districts"] = ["compute"]
    city["stake_settled"] = { NVDA: unit }
    city["tokens_held"] = { NVDA: unit - 1n }
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/stake",
      cmdBody("st4", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.STAKE_MULT_SHORT)
    expect(settledOf(city, "NVDA")).toBe(unit)
    expect(tokensOf(city, "NVDA")).toBe(unit - 1n)
  })

  it("refuses_explicit_amount_below_next_multiple", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const unit = stakeStepOf(host) * stakeMinOf(host, "NVDA")
    city["districts"] = ["compute"]
    city["stake_settled"] = { NVDA: unit }
    city["tokens_held"] = { NVDA: unit }
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/stake",
      cmdBody("st5", t, { district_id: "compute", amount: unit - 1n }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.STAKE_MULT_SHORT)
    expect(settledOf(city, "NVDA")).toBe(unit)
    expect(tokensOf(city, "NVDA")).toBe(unit)
  })

  it("stakes_next_multiple_from_tokens_held", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const unit = stakeStepOf(host) * stakeMinOf(host, "NVDA")
    city["districts"] = ["compute"]
    city["stake_settled"] = { NVDA: unit }
    city["tokens_held"] = { NVDA: unit + unit }
    city["district_freeze_until"] = { NVDA: 999n, TSLA: 50n }
    city["unstake_pending"] = [
      { ticker: "NVDA", amount: 1n, ready_at: 999n },
      { ticker: "TSLA", amount: 2n, ready_at: 50n },
    ]
    const before = tokensOf(city, "NVDA") + settledOf(city, "NVDA")
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/stake",
      cmdBody("st6", t, { ticker: "NVDA" }),
      auth.headers,
    )
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(settledOf(city, "NVDA")).toBe(unit + unit)
    expect(tokensOf(city, "NVDA")).toBe(unit)
    expect(tokensOf(city, "NVDA") + settledOf(city, "NVDA")).toBe(before)
    expect("NVDA" in asEngineDict(city["district_freeze_until"])).toBe(false)
    expect(asBigint(asEngineDict(city["district_freeze_until"])["TSLA"], 0n)).toBe(50n)
    const pending = city["unstake_pending"]
    expect(Array.isArray(pending)).toBe(true)
    if (Array.isArray(pending)) {
      expect(pending.length).toBe(1)
      expect(asText(asEngineDict(pending[0])["ticker"])).toBe("TSLA")
    }
  })

  it("allows_amount_above_next_multiple_without_inventing_fee", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const unit = stakeStepOf(host) * stakeMinOf(host, "NVDA")
    city["districts"] = ["compute"]
    city["stake_settled"] = { NVDA: unit }
    city["tokens_held"] = { NVDA: unit + unit }
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/stake",
      cmdBody("st7", t, { district_id: "compute", amount: unit + 1n }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe("")
    expect(settledOf(city, "NVDA")).toBe(unit + unit + 1n)
    expect(tokensOf(city, "NVDA")).toBe(unit - 1n)
  })
})

function districtTierOf(city: ReturnType<typeof cityOf>, districtId: string): bigint {
  return asBigint(asEngineDict(city["district_tiers"])[districtId], 0n)
}

function nodeIds(city: ReturnType<typeof cityOf>): readonly string[] {
  const out: string[] = []
  const raw = city["nodes"]
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const id = asText(asEngineDict(item)["id"])
    if (id.length > 0) out.push(id)
  }
  return out
}

function tierCostOf(host: Awaited<ReturnType<typeof bootHost>>, t: bigint): bigint {
  const costs = asObj(walk(host.ctx.pack, ["generated", "progression", "tier_cost"]))
  return asBigint(costs[t.toString()])
}

function tierGateOf(
  host: Awaited<ReturnType<typeof bootHost>>,
  t: bigint,
): { readonly cityLevelReq: bigint; readonly stakeMult: bigint } {
  const g = asObj(walk(host.ctx.pack, ["generated", "progression", "tier_gates", t.toString()]))
  return { cityLevelReq: asBigint(g["city_level_req"]), stakeMult: asBigint(g["stake_mult"]) }
}

function tierCountOf(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "progression", "params", "tier_count", "v"]))
}

describe("H2.4 unlock_tier", () => {
  it("refuses_unknown_or_empty_unlock_district", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/unlock_tier", cmdBody("ut1", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut2", t, { district_id: "nope" }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
  })

  it("locks_unlock_on_closed_district", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    city["stake_settled"] = { NVDA: stakeMinOf(host, "NVDA") }
    city["capital"] = 0n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut3", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.DISTRICT_LOCKED)
    expect(districtTierOf(city, "compute")).toBe(0n)
  })

  it("unlocks_tier_1_at_zero_cost_for_demo", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const cost = tierCostOf(host, 1n)
    expect(cost).toBe(0n)
    const gate = tierGateOf(host, 1n)
    const need = gate.stakeMult * stakeMinOf(host, "NVDA")
    city["districts"] = ["compute"]
    city["stake_settled"] = { NVDA: need }
    city["city_level"] = gate.cityLevelReq
    city["capital"] = 0n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut4", t, { ticker: "NVDA", tier: 3n }),
      auth.headers,
    )
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(districtTierOf(city, "compute")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(0n)
    expect(nodeIds(city)).toContain("div_compute_1")
  })

  it("refuses_tier_2_below_city_level", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const g1 = tierGateOf(host, 1n)
    const g2 = tierGateOf(host, 2n)
    expect(g2.cityLevelReq > g1.cityLevelReq).toBe(true)
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: 1n }
    city["stake_settled"] = { NVDA: g2.stakeMult * stakeMinOf(host, "NVDA") }
    city["city_level"] = g2.cityLevelReq - 1n
    const cost = tierCostOf(host, 2n)
    seedPlayerCapital(host, auth.cityId, cost)
    const before = asBigint(city["capital"])
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut5", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.CITY_LEVEL_TOO_LOW)
    expect(districtTierOf(city, "compute")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(before)
  })

  it("refuses_tier_2_below_stake_mult", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const g2 = tierGateOf(host, 2n)
    const need = g2.stakeMult * stakeMinOf(host, "NVDA")
    expect(need > 0n).toBe(true)
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: 1n }
    city["stake_settled"] = { NVDA: need - 1n }
    city["city_level"] = g2.cityLevelReq
    const cost = tierCostOf(host, 2n)
    seedPlayerCapital(host, auth.cityId, cost)
    const before = asBigint(city["capital"])
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut6", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.STAKE_MULT_SHORT)
    expect(districtTierOf(city, "compute")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(before)
  })

  it("refuses_tier_2_without_capital", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const g2 = tierGateOf(host, 2n)
    const cost = tierCostOf(host, 2n)
    expect(cost > 0n).toBe(true)
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: 1n }
    city["stake_settled"] = { NVDA: g2.stakeMult * stakeMinOf(host, "NVDA") }
    city["city_level"] = g2.cityLevelReq
    city["capital"] = cost - 1n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut7", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CAPITAL)
    expect(districtTierOf(city, "compute")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(cost - 1n)
    expect(nodeIds(city).includes("div_compute_2")).toBe(false)
  })

  it("pays_tier_2_from_pack_cost", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const g2 = tierGateOf(host, 2n)
    const cost = tierCostOf(host, 2n)
    expect(cost > 0n).toBe(true)
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: 1n }
    city["nodes"] = [{ id: "div_compute_1", key: "keep", magnitude: 1n }]
    city["stake_settled"] = { NVDA: g2.stakeMult * stakeMinOf(host, "NVDA") }
    city["city_level"] = g2.cityLevelReq
    seedPlayerCapital(host, auth.cityId, cost)
    const before = asBigint(city["capital"])
    expect(before >= cost).toBe(true)
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut8", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(districtTierOf(city, "compute")).toBe(2n)
    expect(asBigint(city["capital"])).toBe(before - cost)
    expect(nodeIds(city)).toContain("div_compute_1")
    expect(nodeIds(city)).toContain("div_compute_2")
  })

  it("refuses_past_max_tier_without_spend", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const max = tierCountOf(host)
    expect(max > 0n).toBe(true)
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: max }
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/unlock_tier",
      cmdBody("ut9", t, { district_id: "compute" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.TIER_NOT_UNLOCKED)
    expect(districtTierOf(city, "compute")).toBe(max)
    expect(asBigint(city["capital"])).toBe(9n)
  })
})

function progressionNodeOf(
  host: Awaited<ReturnType<typeof bootHost>>,
  nodeId: string,
): { readonly district: string; readonly axis: string; readonly tier: bigint; readonly exclusiveWith: string } {
  const row = asObj(walk(host.ctx.pack, ["generated", "progression", "progression_nodes", nodeId]))
  return {
    district: asText(row["district"]),
    axis: asText(row["axis"]),
    tier: asBigint(row["tier"]),
    exclusiveWith: asText(row["exclusive_with"]),
  }
}

describe("H2.5 pick_node", () => {
  it("refuses_unknown_or_empty_node", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/pick_node", cmdBody("pn1", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn2", t, { node_id: "n_nope_scale" }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
  })

  it("locks_pick_on_closed_district", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const node = progressionNodeOf(host, "n_compute_scale")
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn3", t, { node_id: "n_compute_scale" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.DISTRICT_LOCKED)
    expect(nodeIds(city).includes("n_compute_scale")).toBe(false)
    expect(asBigint(city["capital"])).toBe(9n)
    expect(node.district).toBe("compute")
  })

  it("refuses_pick_before_tier_unlock", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const node = progressionNodeOf(host, "n_compute_scale")
    expect(node.tier > 0n).toBe(true)
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: node.tier - 1n }
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn4", t, { node_id: "n_compute_scale" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.TIER_NOT_UNLOCKED)
    expect(nodeIds(city).includes("n_compute_scale")).toBe(false)
    expect(asBigint(city["capital"])).toBe(9n)
  })

  it("picks_scale_without_spend_for_demo", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const node = progressionNodeOf(host, "n_compute_scale")
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: node.tier }
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn5", t, { node_id: "n_compute_scale", district_id: "energy" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.API_MALFORMED)
    const ok = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn6", t, { node_id: "n_compute_scale", ticker: "NVDA" }),
      auth.headers,
    )
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(nodeIds(city)).toContain("n_compute_scale")
    expect(asBigint(city["capital"])).toBe(9n)
    const again = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn7", t, { node_id: "n_compute_scale" }),
      auth.headers,
    )
    expect(bodyCode(again.body)).toBe("")
    expect(nodeIds(city).filter((id) => id === "n_compute_scale").length).toBe(1)
    expect(asBigint(city["capital"])).toBe(9n)
  })

  it("locks_exclusive_side_without_respec", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const node = progressionNodeOf(host, "n_compute_scale")
    expect(node.exclusiveWith.length > 0).toBe(true)
    city["districts"] = ["compute"]
    city["district_tiers"] = { compute: node.tier }
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const first = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn8", t, { node_id: "n_compute_scale" }),
      auth.headers,
    )
    expect(bodyCode(first.body)).toBe("")
    const blocked = await host.handle(
      "POST",
      "/command/pick_node",
      cmdBody("pn9", t, { node_id: node.exclusiveWith }),
      auth.headers,
    )
    expect(bodyCode(blocked.body)).toBe(codes.NODE_SIDE_LOCKED)
    expect(nodeIds(city)).toContain("n_compute_scale")
    expect(nodeIds(city).includes(node.exclusiveWith)).toBe(false)
    expect(asBigint(city["capital"])).toBe(9n)
  })
})

function mergeCostOf(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  return asBigint(walk(host.ctx.pack, ["generated", "progression", "merge_cost"]))
}

function mergeCapOf(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  return asBigint(walk(host.ctx.pack, ["generated", "progression", "merge_active_cap"]))
}

function mergeMinTierOf(host: Awaited<ReturnType<typeof bootHost>>, mergeId: string): bigint {
  return asBigint(walk(host.ctx.pack, ["generated", "progression", "progression_merges", mergeId, "min_tier"]))
}

function mergeDistrictsOf(host: Awaited<ReturnType<typeof bootHost>>, mergeId: string): readonly string[] {
  const out: string[] = []
  const raw = walk(host.ctx.pack, ["generated", "progression", "progression_merges", mergeId, "districts"])
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function mergeEffectsOf(
  host: Awaited<ReturnType<typeof bootHost>>,
  mergeId: string,
): readonly { readonly district: string; readonly key: string; readonly magnitude: bigint }[] {
  const out: { district: string; key: string; magnitude: bigint }[] = []
  const raw = walk(host.ctx.pack, ["generated", "progression", "progression_merges", mergeId, "effects"])
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asObj(item)
    out.push({
      district: asText(row["district"]),
      key: asText(row["key"]),
      magnitude: asBigint(row["magnitude"]),
    })
  }
  return out
}

function mergeIdsOf(host: Awaited<ReturnType<typeof bootHost>>): readonly string[] {
  return Object.keys(asObj(walk(host.ctx.pack, ["generated", "progression", "progression_merges"]))).sort()
}

function cityMerges(city: ReturnType<typeof cityOf>): readonly string[] {
  const out: string[] = []
  const raw = city["merges"]
  if (!Array.isArray(raw)) return out
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function armMergeCity(
  city: ReturnType<typeof cityOf>,
  districts: readonly string[],
  tier: bigint,
): void {
  city["districts"] = [...districts]
  const tiers: { [id: string]: bigint } = {}
  for (const id of districts) tiers[id] = tier
  city["district_tiers"] = tiers
}

function matchingIds(host: Awaited<ReturnType<typeof bootHost>>, size: number): readonly string[] {
  const ids = mergeIdsOf(host)
  function disjoint(picked: readonly string[]): boolean {
    const taken = new Set<string>()
    for (const id of picked) {
      for (const d of mergeDistrictsOf(host, id)) {
        if (taken.has(d)) return false
        taken.add(d)
      }
    }
    return true
  }
  function search(start: number, acc: readonly string[]): readonly string[] | undefined {
    if (acc.length === size) return acc
    for (let i = start; i < ids.length; i++) {
      const id = ids[i]
      if (id === undefined) continue
      const next = [...acc, id]
      if (!disjoint(next)) continue
      const hit = search(i + 1, next)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  return search(0, []) ?? []
}

describe("H2.6 merge", () => {
  it("refuses_unknown_or_empty_merge", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/merge", cmdBody("mg1", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/merge",
      cmdBody("mg2", t, { merge_id: "m_nope_pair" }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
    const synergy = await host.handle(
      "POST",
      "/command/merge",
      cmdBody("mg3", t, { merge_id: "compute+energy" }),
      auth.headers,
    )
    expect(bodyCode(synergy.body)).toBe(codes.API_MALFORMED)
  })

  it("locks_merge_on_closed_district", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const mergeId = mergeIdsOf(host)[0]
    expect(typeof mergeId).toBe("string")
    if (mergeId === undefined) return
    const districts = mergeDistrictsOf(host, mergeId)
    expect(districts.length).toBe(2)
    const opened = districts[0] ?? ""
    city["districts"] = [opened]
    city["district_tiers"] = { [opened]: mergeMinTierOf(host, mergeId) }
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/merge", cmdBody("mg4", t, { merge_id: mergeId }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.DISTRICT_LOCKED)
    expect(cityMerges(city).includes(mergeId)).toBe(false)
    expect(asBigint(city["capital"])).toBe(9n)
  })

  it("refuses_merge_before_min_tier", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const mergeId = mergeIdsOf(host)[0]
    expect(typeof mergeId).toBe("string")
    if (mergeId === undefined) return
    const minTier = mergeMinTierOf(host, mergeId)
    expect(minTier > 0n).toBe(true)
    armMergeCity(city, mergeDistrictsOf(host, mergeId), minTier - 1n)
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/merge", cmdBody("mg5", t, { merge_id: mergeId }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.TIER_NOT_UNLOCKED)
    expect(cityMerges(city).includes(mergeId)).toBe(false)
    expect(asBigint(city["capital"])).toBe(9n)
  })

  it("refuses_merge_without_capital", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const mergeId = mergeIdsOf(host)[0]
    expect(typeof mergeId).toBe("string")
    if (mergeId === undefined) return
    const cost = mergeCostOf(host)
    expect(cost > 0n).toBe(true)
    armMergeCity(city, mergeDistrictsOf(host, mergeId), mergeMinTierOf(host, mergeId))
    city["capital"] = cost - 1n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/merge", cmdBody("mg6", t, { merge_id: mergeId }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CAPITAL)
    expect(cityMerges(city).includes(mergeId)).toBe(false)
    expect(asBigint(city["capital"])).toBe(cost - 1n)
  })

  it("pays_merge_from_pack_and_keeps_pack_magnitude", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const mergeId = mergeIdsOf(host)[0]
    expect(typeof mergeId).toBe("string")
    if (mergeId === undefined) return
    const cost = mergeCostOf(host)
    const effects = mergeEffectsOf(host, mergeId)
    expect(effects.length > 0).toBe(true)
    const districts = mergeDistrictsOf(host, mergeId)
    armMergeCity(city, districts, mergeMinTierOf(host, mergeId))
    seedPlayerCapital(host, auth.cityId, cost)
    const before = asBigint(city["capital"])
    expect(before >= cost).toBe(true)
    const t = asBigint(host.state["city_time"])
    let outsider = "compute"
    if (districts.includes(outsider)) outsider = "energy"
    if (districts.includes(outsider)) outsider = "finance"
    expect(districts.includes(outsider)).toBe(false)
    const mismatch = await host.handle(
      "POST",
      "/command/merge",
      cmdBody("mg7", t, { merge_id: mergeId, district_id: outsider }),
      auth.headers,
    )
    expect(bodyCode(mismatch.body)).toBe(codes.API_MALFORMED)
    const hinted = districts[0] ?? ""
    const ok = await host.handle(
      "POST",
      "/command/merge",
      cmdBody("mg8", t, { merge_id: mergeId, district_id: hinted }),
      auth.headers,
    )
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(cityMerges(city)).toContain(mergeId)
    expect(asBigint(city["capital"])).toBe(before - cost)
    for (const eff of effects) {
      const nid = mergeId + "_" + eff.district
      expect(nodeIds(city)).toContain(nid)
      const nodes = asList(city["nodes"])
      let mag = 0n
      for (const item of nodes) {
        if (item === null || typeof item !== "object" || Array.isArray(item)) continue
        const row = asEngineDict(item)
        if (asText(row["id"]) !== nid) continue
        mag = asBigint(row["magnitude"])
        expect(asText(row["key"])).toBe(eff.key)
      }
      expect(mag).toBe(eff.magnitude)
    }
    const again = await host.handle("POST", "/command/merge", cmdBody("mg9", t, { merge_id: mergeId }), auth.headers)
    expect(bodyCode(again.body)).toBe("")
    expect(asBigint(city["capital"])).toBe(before - cost)
    expect(cityMerges(city).filter((id) => id === mergeId).length).toBe(1)
  })

  it("blocks_matching_and_cap_without_respec", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const cap = mergeCapOf(host)
    expect(cap > 0n).toBe(true)
    const chosen = matchingIds(host, Number(cap))
    expect(BigInt(chosen.length)).toBe(cap)
    const allDistricts: string[] = []
    for (const id of mergeIdsOf(host)) {
      for (const d of mergeDistrictsOf(host, id)) {
        if (!allDistricts.includes(d)) allDistricts.push(d)
      }
    }
    const cost = mergeCostOf(host)
    const first = chosen[0]
    expect(typeof first).toBe("string")
    if (first === undefined) return
    armMergeCity(city, allDistricts, mergeMinTierOf(host, first))
    seedPlayerCapital(host, auth.cityId, cost * (cap + 1n))
    const t = asBigint(host.state["city_time"])
    for (let i = 0; i < chosen.length; i++) {
      const id = chosen[i]
      if (id === undefined) continue
      const res = await host.handle("POST", "/command/merge", cmdBody("mgc" + i.toString(), t, { merge_id: id }), auth.headers)
      expect(bodyCode(res.body)).toBe("")
    }
    expect(cityMerges(city).length).toBe(Number(cap))
    let overlap: string | undefined
    for (const id of mergeIdsOf(host)) {
      if (chosen.includes(id)) continue
      overlap = id
      break
    }
    expect(typeof overlap).toBe("string")
    if (overlap === undefined) return
    const blocked = await host.handle(
      "POST",
      "/command/merge",
      cmdBody("mg10", t, { merge_id: overlap }),
      auth.headers,
    )
    expect(bodyCode(blocked.body)).toBe(codes.MERGE_MATCHING_BLOCKED)
    expect(cityMerges(city).includes(overlap)).toBe(false)
  })
})

function workshopLevelCost(
  host: Awaited<ReturnType<typeof bootHost>>,
  level: bigint,
): bigint {
  const costs = asObj(walk(host.ctx.pack, ["generated", "balance", "level_cost"]))
  const rows = costs["workshop"]
  expect(Array.isArray(rows)).toBe(true)
  if (!Array.isArray(rows)) return 0n
  let i = 1n
  for (const item of rows) {
    if (i === level) return asBigint(item)
    i += 1n
  }
  return 0n
}

function buildingLevelMaxOf(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "balance", "params", "building_level_max", "v"]))
}

function functionLevel(city: ReturnType<typeof cityOf>, bid: string): bigint | undefined {
  for (const item of asList(city["functions"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) !== bid) continue
    return asBigint(row["level"], 1n)
  }
  return undefined
}

describe("H2.7 upgrade", () => {
  it("refuses_unknown_or_empty_upgrade", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/upgrade", cmdBody("up1", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up2", t, { building_id: "nope_building" }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
  })

  it("locks_upgrade_without_built_function", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    city["functions"] = []
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up3", t, { building_id: "workshop" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CAPITAL)
    expect(functionLevel(city, "workshop")).toBe(undefined)
    expect(asBigint(city["capital"])).toBe(9n)
    city["functions"] = [{ id: "city_hall", level: 1n }]
    const hall = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up4", t, { building_id: "city_hall" }),
      auth.headers,
    )
    expect(bodyCode(hall.body)).toBe(codes.API_MALFORMED)
    expect(functionLevel(city, "city_hall")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(9n)
  })

  it("refuses_upgrade_without_next_level_cost", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const l1 = workshopLevelCost(host, 1n)
    const l2 = workshopLevelCost(host, 2n)
    expect(l1 > 0n).toBe(true)
    expect(l2 > l1).toBe(true)
    city["functions"] = [{ id: "workshop", level: 1n }]
    city["capital"] = l1
    const t = asBigint(host.state["city_time"])
    const short = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up5", t, { building_id: "workshop" }),
      auth.headers,
    )
    expect(bodyCode(short.body)).toBe(codes.NOT_ENOUGH_CAPITAL)
    expect(functionLevel(city, "workshop")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(l1)
  })

  it("pays_pack_next_level_and_ignores_body_level", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const l2 = workshopLevelCost(host, 2n)
    city["functions"] = [{ id: "workshop", level: 1n }]
    seedPlayerCapital(host, auth.cityId, l2)
    const before = asBigint(city["capital"])
    expect(before >= l2).toBe(true)
    const t = asBigint(host.state["city_time"])
    const ok = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up6", t, { building_id: "workshop", level: 3n }),
      auth.headers,
    )
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(functionLevel(city, "workshop")).toBe(2n)
    expect(asBigint(city["capital"])).toBe(before - l2)
    let construction = 0n
    for (const item of asList(city["functions"])) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const row = asEngineDict(item)
      if (asText(row["id"]) !== "workshop") continue
      construction = asBigint(row["construction"])
    }
    expect(construction > 0n).toBe(true)
    const authB = await demoAuth(host)
    const cityB = cityOf(host, authB.cityId)
    cityB["functions"] = [{ id: "workshop", level: 1n }]
    cityB["nodes"] = [{ key: "build_cost_bps", magnitude: -1000n }]
    seedPlayerCapital(host, authB.cityId, l2)
    const beforeB = asBigint(cityB["capital"])
    const tB = asBigint(host.state["city_time"])
    const cheap = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up6b", tB, { building_id: "workshop" }),
      authB.headers,
    )
    expect(cheap.status).toBe(host.ctx.httpOk)
    expect(bodyCode(cheap.body)).toBe("")
    expect(functionLevel(cityB, "workshop")).toBe(2n)
    const bps = asBigint(host.ctx.cfg["bps"])
    expect(asBigint(cityB["capital"])).toBe(beforeB - (l2 * (bps - 1000n)) / bps)
    const latheMag = asBigint(asEngineDict(asEngineDict(host.ctx.cfg["research_nodes"])["lathe"])["effect_bps"])
    expect(latheMag > 0n).toBe(true)
    const authC = await demoAuth(host)
    const cityC = cityOf(host, authC.cityId)
    cityC["functions"] = [{ id: "workshop", level: 1n }]
    cityC["nodes"] = [{ key: "upgrade_speed_bps", magnitude: latheMag }]
    seedPlayerCapital(host, authC.cityId, l2)
    const tC = asBigint(host.state["city_time"])
    const fast = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up6c", tC, { building_id: "workshop" }),
      authC.headers,
    )
    expect(fast.status).toBe(host.ctx.httpOk)
    expect(bodyCode(fast.body)).toBe("")
    expect(functionLevel(cityC, "workshop")).toBe(2n)
    let constructionC = 0n
    for (const item of asList(cityC["functions"])) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const row = asEngineDict(item)
      if (asText(row["id"]) !== "workshop") continue
      constructionC = asBigint(row["construction"])
    }
    expect(constructionC).toBe((construction * bps) / (bps + latheMag))
    expect(constructionC < construction).toBe(true)
    const authD = await demoAuth(host)
    const cityD = cityOf(host, authD.cityId)
    cityD["functions"] = [{ id: "workshop", level: 1n }]
    cityD["research_unlocked"] = ["lathe"]
    seedPlayerCapital(host, authD.cityId, l2)
    const tD = asBigint(host.state["city_time"])
    const latheUp = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up6d", tD, { building_id: "workshop" }),
      authD.headers,
    )
    expect(latheUp.status).toBe(host.ctx.httpOk)
    expect(bodyCode(latheUp.body)).toBe("")
    let constructionD = 0n
    for (const item of asList(cityD["functions"])) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const row = asEngineDict(item)
      if (asText(row["id"]) !== "workshop") continue
      constructionD = asBigint(row["construction"])
    }
    expect(constructionD).toBe(constructionC)
  })

  it("blocks_upgrade_at_pack_max", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const max = buildingLevelMaxOf(host)
    expect(max > 1n).toBe(true)
    city["functions"] = [{ id: "workshop", level: max }]
    city["capital"] = 9n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up7", t, { building_id: "workshop" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.TIER_NOT_UNLOCKED)
    expect(functionLevel(city, "workshop")).toBe(max)
    expect(asBigint(city["capital"])).toBe(9n)
  })

  it("blocks_frozen_and_deactivated_upgrade", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const l2 = workshopLevelCost(host, 2n)
    city["functions"] = [{ id: "workshop", level: 1n, frozen: 1n }]
    city["capital"] = l2
    const t = asBigint(host.state["city_time"])
    const frozen = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up8", t, { building_id: "workshop" }),
      auth.headers,
    )
    expect(bodyCode(frozen.body)).toBe(codes.DISTRICT_FROZEN)
    expect(functionLevel(city, "workshop")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(l2)
    city["functions"] = [{ id: "workshop", level: 1n, deactivated: 1n }]
    const off = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up9", t, { building_id: "workshop" }),
      auth.headers,
    )
    expect(bodyCode(off.body)).toBe(codes.API_MALFORMED)
    expect(functionLevel(city, "workshop")).toBe(1n)
    expect(asBigint(city["capital"])).toBe(l2)
    city["functions"] = [{ id: "ai_research_center", level: 1n }]
    if (asBigint(host.state["city_time"]) === 0n) host.state["city_time"] = 1n
    const freezeAt = asBigint(host.state["city_time"])
    city["district_freeze_until"] = { NVDA: freezeAt }
    const iced = await host.handle(
      "POST",
      "/command/upgrade",
      cmdBody("up10", freezeAt, { building_id: "ai_research_center" }),
      auth.headers,
    )
    expect(bodyCode(iced.body)).toBe(codes.DISTRICT_FROZEN)
    expect(functionLevel(city, "ai_research_center")).toBe(1n)
    city["functions"] = []
    const built = await host.handle(
      "POST",
      "/command/build",
      cmdBody("up11", freezeAt, { building_id: "drone_depot" }),
      auth.headers,
    )
    expect(bodyCode(built.body)).toBe(codes.DISTRICT_FROZEN)
    expect(functionLevel(city, "drone_depot")).toBe(undefined)
  })
})

function ledgerTickerOf(host: Awaited<ReturnType<typeof bootHost>>): string {
  const raw = walk(host.ctx.pack, ["generated", "fragments", "fragment_ledgers_v1"])
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string" && item.length > 0) return item
    }
  }
  return ""
}

function settleTickOf(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  const data = asEngineDict(host.ctx.cfg["data"])
  let i = 0n
  while (i < 2000n) {
    const clock = cityClock(host.ctx.cfg, i)
    if (windowSettleDue(data, clock[0], clock[1])) return i
    i += 1n
  }
  return 0n
}

function tokensHeldOf(city: ReturnType<typeof cityOf>, ticker: string): bigint {
  return asBigint(asEngineDict(city["tokens_held"])[ticker], 0n)
}

function owedOf(city: ReturnType<typeof cityOf>, ticker: string): bigint {
  return asBigint(asEngineDict(city["fragment_owed"])[ticker], 0n)
}

describe("H2.8 claim_fragment", () => {
  it("refuses_demo_fragment_claim", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const ticker = ledgerTickerOf(host)
    expect(ticker.length > 0).toBe(true)
    city["fragment_owed"] = { [ticker]: 7n }
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/claim_fragment", cmdBody("cf1", t), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.DEMO_NO_CLAIM)
    expect(owedOf(city, ticker)).toBe(7n)
    expect(tokensHeldOf(city, ticker)).toBe(0n)
  })

  it("refuses_when_nothing_to_claim", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["fragment_owed"] = {}
    city["fragment_ledger"] = {}
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/claim_fragment", cmdBody("cf2", t), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.FRAGMENT_NO_CLAIMS)
  })

  it("pays_owed_into_tokens_held", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const ticker = ledgerTickerOf(host)
    city["fragment_owed"] = { [ticker]: 11n }
    city["tokens_held"] = { [ticker]: 2n }
    const t = asBigint(host.state["city_time"])
    const ok = await host.handle("POST", "/command/claim_fragment", cmdBody("cf3", t), auth.headers)
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(owedOf(city, ticker)).toBe(0n)
    expect(tokensHeldOf(city, ticker)).toBe(13n)
    expect(asBigint(city["capital"], 0n)).toBe(0n)
    expect(asBigint(city["corp_held"], 0n)).toBe(0n)
    const again = await host.handle("POST", "/command/claim_fragment", cmdBody("cf4", t), auth.headers)
    expect(bodyCode(again.body)).toBe(codes.FRAGMENT_NO_CLAIMS)
    expect(tokensHeldOf(city, ticker)).toBe(13n)
  })

  it("settles_due_window_then_pays", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const ticker = ledgerTickerOf(host)
    const idx = settleTickOf(host)
    expect(idx > 0n).toBe(true)
    host.state["tick_index"] = idx
    city["fragment_ledger"] = { [ticker]: 100n }
    city["fragment_pool"] = 40n
    const t = asBigint(host.state["city_time"])
    const ok = await host.handle("POST", "/command/claim_fragment", cmdBody("cf5", t), auth.headers)
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(asEngineDict(city["fragment_ledger"])).toEqual({})
    expect(owedOf(city, ticker)).toBe(0n)
    expect(tokensHeldOf(city, ticker)).toBe(40n)
  })

  it("caps_matching_across_cities", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const ticker = ledgerTickerOf(host)
    const idx = settleTickOf(host)
    expect(idx > 0n).toBe(true)
    host.state["tick_index"] = idx
    const cities = asEngineDict(host.state["cities"])
    const whale = asEngineDict(cities["a"])
    whale["fragment_ledger"] = { [ticker]: 9000n }
    whale["fragment_pool"] = 0n
    cities["b"] = { fragment_ledger: { [ticker]: 1000n } }
    host.state["fragment_pools"] = { [ticker]: 100n }
    const t = asBigint(host.state["city_time"])
    const ok = await host.handle("POST", "/command/claim_fragment", cmdBody("cf6", t), auth.headers)
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(tokensHeldOf(whale, ticker)).toBe(50n)
    expect(owedOf(whale, ticker)).toBe(0n)
    const other = asEngineDict(cities["b"])
    expect(owedOf(other, ticker)).toBe(10n)
    expect(tokensHeldOf(other, ticker)).toBe(0n)
  })

  it("burns_ledger_on_empty_pool", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const ticker = ledgerTickerOf(host)
    const idx = settleTickOf(host)
    expect(idx > 0n).toBe(true)
    host.state["tick_index"] = idx
    city["fragment_ledger"] = { [ticker]: 9n }
    city["fragment_pool"] = 0n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/claim_fragment", cmdBody("cf7", t), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.FRAGMENT_POOL_EMPTY)
    expect(asEngineDict(city["fragment_ledger"])).toEqual({})
    expect(tokensHeldOf(city, ticker)).toBe(0n)
  })

  it("does_not_settle_mid_window", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const ticker = ledgerTickerOf(host)
    host.state["tick_index"] = 0n
    city["fragment_ledger"] = { [ticker]: 100n }
    city["fragment_pool"] = 40n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/claim_fragment", cmdBody("cf8", t), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.FRAGMENT_NO_CLAIMS)
    expect(asBigint(asEngineDict(city["fragment_ledger"])[ticker], 0n)).toBe(100n)
    expect(asBigint(city["fragment_pool"], 0n)).toBe(40n)
    expect(tokensHeldOf(city, ticker)).toBe(0n)
  })

  it("leaves_pool_when_sigma_zero", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const idx = settleTickOf(host)
    expect(idx > 0n).toBe(true)
    host.state["tick_index"] = idx
    city["fragment_ledger"] = {}
    city["fragment_pool"] = 40n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/claim_fragment", cmdBody("cf9", t), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.FRAGMENT_NO_CLAIMS)
    expect(asBigint(city["fragment_pool"], 0n)).toBe(40n)
    expect(asEngineDict(city["fragment_ledger"])).toEqual({})
  })
})

function expectedMint(host: Awaited<ReturnType<typeof bootHost>>, corpDeposited: bigint): bigint {
  const rate = asBigint(host.state["mint_rate"])
  const wei = asBigint(host.ctx.cfg["wei"])
  const bps = asBigint(host.ctx.cfg["bps"])
  const fee = asBigint(host.ctx.cfg["vault_fee_bps"])
  if (rate <= 0n || wei <= 0n) return 0n
  const gross = (corpDeposited * rate) / wei
  return (gross * (bps - fee)) / bps
}

describe("H2.9 deposit", () => {
  it("refuses_deposit_without_wallet", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/deposit", cmdBody("dp1", t, { amount: wei }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.WALLET_NOT_CONNECTED)
    expect(asBigint(city["corp_held"])).toBe(wei)
    expect(asBigint(city["capital"])).toBe(0n)
  })

  it("refuses_deposit_without_corp", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["corp_held"] = 0n
    const wei = asBigint(host.ctx.cfg["wei"])
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/deposit", cmdBody("dp2", t, { amount: wei }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CORP)
    expect(asBigint(city["capital"])).toBe(0n)
  })

  it("refuses_zero_or_missing_amount", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/deposit", cmdBody("dp3", t), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const zero = await host.handle("POST", "/command/deposit", cmdBody("dp4", t, { amount: 0n }), auth.headers)
    expect(bodyCode(zero.body)).toBe(codes.API_MALFORMED)
    expect(asBigint(city["corp_held"])).toBe(wei)
  })

  it("mints_capital_from_vault_deposit", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    const amount = wei
    city["corp_held"] = amount + amount
    const vaultBefore = asBigint(host.state["vault_corp"], 0n)
    const fundBefore = asBigint(host.state["fund"], 0n)
    const outstandingBefore = asBigint(host.state["capital_outstanding"], 0n)
    const want = expectedMint(host, amount)
    expect(want > 0n).toBe(true)
    const t = asBigint(host.state["city_time"])
    const ok = await host.handle("POST", "/command/deposit", cmdBody("dp5", t, { amount }), auth.headers)
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(asBigint(city["corp_held"])).toBe(amount)
    expect(asBigint(city["capital"])).toBe(want)
    expect(asBigint(host.state["vault_corp"])).toBe(vaultBefore + amount)
    expect(asBigint(host.state["capital_outstanding"])).toBe(outstandingBefore + want)
    expect(asBigint(host.state["fund"])).toBe(fundBefore)
    const cap = asBigint(host.state["vault_corp"]) * asBigint(host.ctx.cfg["capital_anchor"])
    expect(asBigint(host.state["capital_outstanding"]) <= cap).toBe(true)

    const liveHost = await bootHost()
    const liveAuth = await walletAuth(liveHost)
    const liveCity = cityOf(liveHost, liveAuth.cityId)
    const liveAmount = asBigint(liveHost.ctx.cfg["wei"])
    const wallet = padAddr(7n)
    liveCity["wallet"] = wallet
    liveCity["corp_held"] = 0n
    const liveWant = expectedMint(liveHost, liveAmount)
    const liveVault = asBigint(liveHost.state["vault_corp"], 0n)
    let pulls = 0
    const mock = createMockPort(portCfgFromPack(liveHost.ctx.pack), { corp: { [wallet]: liveAmount + liveAmount } })
    const livePort: AssetPort = {
      ...mock,
      kind: "rpc",
      vault: {
        ...mock.vault,
        async deposit(account, amt) {
          pulls += 1
          return mock.vault.deposit(account, amt)
        },
      },
    }
    expect((await mock.vault.deposit(wallet, liveAmount)).ok).toBe(true)
    const liveOk = await applyDeposit(
      liveHost.ctx,
      liveHost.state,
      liveCity,
      { amount: liveAmount, intent_id: "dp5live", expected_city_time: asBigint(liveHost.state["city_time"]) },
      liveAuth.cityId,
      livePort,
    )
    expect(liveOk.status).toBe(liveHost.ctx.httpOk)
    expect(bodyCode(liveOk.body)).toBe("")
    expect(pulls).toBe(0)
    expect(asBigint(liveCity["corp_held"])).toBe(0n)
    expect(asBigint(liveCity["capital"])).toBe(liveWant)
    expect(asBigint(liveHost.state["vault_corp"])).toBe(liveVault + liveAmount)
    const onChain = await mock.vault.capitalOf(wallet)
    expect(onChain.ok).toBe(true)
    if (onChain.ok) expect(onChain.amount).toBe(liveWant)

    const killedHost = await bootHost()
    const killedAuth = await walletAuth(killedHost)
    const killedCity = cityOf(killedHost, killedAuth.cityId)
    killedCity["wallet"] = wallet
    killedCity["corp_held"] = 0n
    const killedWant = expectedMint(killedHost, liveAmount)
    const killedRate = asBigint(killedHost.state["mint_rate"])
    expect(killedRate > 0n).toBe(true)
    let killedPulls = 0
    const killedMock = createMockPort(portCfgFromPack(killedHost.ctx.pack), { corp: { [wallet]: liveAmount } })
    const killedPort: AssetPort = {
      ...killedMock,
      kind: "rpc",
      vault: {
        ...killedMock.vault,
        async deposit(account, amt) {
          killedPulls += 1
          killedHost.state["mint_rate"] = 0n
          return killedMock.vault.deposit(account, amt)
        },
      },
    }
    expect((await killedMock.vault.deposit(wallet, liveAmount)).ok).toBe(true)
    const killedOk = await applyDeposit(
      killedHost.ctx,
      killedHost.state,
      killedCity,
      { amount: liveAmount, intent_id: "dp5kill", expected_city_time: asBigint(killedHost.state["city_time"]) },
      killedAuth.cityId,
      killedPort,
    )
    expect(killedOk.status).toBe(killedHost.ctx.httpOk)
    expect(bodyCode(killedOk.body)).toBe("")
    expect(killedPulls).toBe(0)
    expect(asBigint(killedCity["capital"])).toBe(killedWant)
    expect(asBigint(killedHost.state["mint_rate"])).toBe(killedRate)

    const retryHost = await bootHost()
    const retryAuth = await walletAuth(retryHost)
    const retryCity = cityOf(retryHost, retryAuth.cityId)
    retryCity["wallet"] = wallet
    retryCity["corp_held"] = 0n
    const retryWant = expectedMint(retryHost, liveAmount)
    let mintCalls = 0
    const retryMock = createMockPort(portCfgFromPack(retryHost.ctx.pack), { corp: { [wallet]: liveAmount } })
    const retryPort: AssetPort = {
      ...retryMock,
      kind: "rpc",
      vault: {
        ...retryMock.vault,
        async signMintCapital(account, corpAmount, capitalAmount) {
          mintCalls += 1
          if (mintCalls === 1) return { ok: false, code: codes.SERVICE_DEGRADED }
          return retryMock.vault.signMintCapital(account, corpAmount, capitalAmount)
        },
      },
    }
    expect((await retryMock.vault.deposit(wallet, liveAmount)).ok).toBe(true)
    const retried = await applyDeposit(
      retryHost.ctx,
      retryHost.state,
      retryCity,
      { amount: liveAmount, intent_id: "dp5retry", expected_city_time: asBigint(retryHost.state["city_time"]) },
      retryAuth.cityId,
      retryPort,
    )
    expect(retried.status).toBe(retryHost.ctx.httpOk)
    expect(mintCalls).toBe(1)
    expect(asBigint(retryCity["capital"])).toBe(retryWant)
    expect(asBigint(retryCity["chain_mint_capital"], 0n)).toBe(retryWant)
    expect(asBigint(retryCity["chain_mint_corp"], 0n)).toBe(liveAmount)
    await flushChainMint(retryPort, retryCity, wallet)
    expect(mintCalls).toBe(2)
    expect(asBigint(retryCity["chain_mint_capital"], 0n)).toBe(0n)
    expect(asBigint(retryCity["chain_mint_corp"], 0n)).toBe(0n)
    const retriedOnChain = await retryMock.vault.capitalOf(wallet)
    expect(retriedOnChain.ok).toBe(true)
    if (retriedOnChain.ok) expect(retriedOnChain.amount).toBe(retryWant)

    const stuckHost = await bootHost()
    const stuckAuth = await walletAuth(stuckHost)
    let stuckCity = cityOf(stuckHost, stuckAuth.cityId)
    stuckCity["wallet"] = wallet
    stuckCity["corp_held"] = 0n
    const stuckWant = expectedMint(stuckHost, liveAmount)
    let denyMint = true
    const stuckMock = createMockPort(portCfgFromPack(stuckHost.ctx.pack), {
      corp: { [wallet]: liveAmount + liveAmount },
    })
    const stuckPort: AssetPort = {
      ...stuckMock,
      kind: "rpc",
      vault: {
        ...stuckMock.vault,
        async signMintCapital(account, corpAmount, capitalAmount) {
          if (denyMint) return { ok: false, code: codes.SERVICE_DEGRADED }
          return stuckMock.vault.signMintCapital(account, corpAmount, capitalAmount)
        },
      },
    }
    expect((await stuckMock.vault.deposit(wallet, liveAmount)).ok).toBe(true)
    const stuck = await applyDeposit(
      stuckHost.ctx,
      stuckHost.state,
      stuckCity,
      { amount: liveAmount, intent_id: "dp5stuck", expected_city_time: asBigint(stuckHost.state["city_time"]) },
      stuckAuth.cityId,
      stuckPort,
    )
    expect(stuck.status).toBe(stuckHost.ctx.httpOk)
    expect(asBigint(stuckCity["capital"])).toBe(stuckWant)
    expect(asBigint(stuckCity["chain_mint_capital"], 0n)).toBe(stuckWant)
    const refused = await applyLiveWithdraw(
      stuckHost.ctx,
      stuckHost.store,
      stuckHost.state,
      stuckAuth.cityId,
      "pl5wd",
      asBigint(stuckHost.state["city_time"]),
      { amount: 1n, intent_id: "pl5wd" },
      0n,
      undefined,
      stuckPort,
    )
    expect(bodyCode(refused.body)).toBe(codes.VAULT_EXIT_UNCOVERED)
    expect(stuckCity["vouchers"] === undefined).toBe(true)
    stuckCity = cityOf(stuckHost, stuckAuth.cityId)
    denyMint = false
    const hiredFlush = await applyLive(
      stuckHost.ctx,
      stuckHost.state,
      "hire",
      { role: "engineer", intent_id: "dp5hire", expected_city_time: asBigint(stuckHost.state["city_time"]) },
      stuckAuth.cityId,
      stuckPort,
    )
    expect(hiredFlush !== undefined).toBe(true)
    expect(asBigint(stuckCity["chain_mint_capital"], 0n)).toBe(0n)
    const hiredOnChain = await stuckMock.vault.capitalOf(wallet)
    expect(hiredOnChain.ok).toBe(true)
    if (hiredOnChain.ok) expect(hiredOnChain.amount).toBe(stuckWant)
    expect((await stuckMock.vault.deposit(wallet, liveAmount)).ok).toBe(true)
    const flushed = await applyDeposit(
      stuckHost.ctx,
      stuckHost.state,
      stuckCity,
      { amount: liveAmount, intent_id: "dp5flush", expected_city_time: asBigint(stuckHost.state["city_time"]) },
      stuckAuth.cityId,
      stuckPort,
    )
    expect(flushed.status).toBe(stuckHost.ctx.httpOk)
    expect(asBigint(stuckCity["chain_mint_capital"], 0n)).toBe(0n)
    const flushedOnChain = await stuckMock.vault.capitalOf(wallet)
    expect(flushedOnChain.ok).toBe(true)
    if (flushedOnChain.ok) expect(flushedOnChain.amount).toBe(stuckWant + stuckWant)

    const rawHost = await bootHost()
    const rawAuth = await walletAuth(rawHost)
    const rawCity = cityOf(rawHost, rawAuth.cityId)
    rawCity["wallet"] = wallet
    let signs = 0
    let replays = 0
    let mined = false
    const rawHash = "0x" + "11".repeat(32)
    const rawMock = createMockPort(portCfgFromPack(rawHost.ctx.pack), { corp: { [wallet]: 4n } })
    const rawPort: AssetPort = {
      ...rawMock,
      kind: "rpc",
      vault: {
        ...rawMock.vault,
        async signMintCapital() {
          signs += 1
          return { ok: true, txHash: rawHash, txNonce: "4", txRaw: "0xrawpl5", txConfirmed: false }
        },
      },
      chain: {
        ...rawMock.chain,
        async transactionReceipt(hash: string) {
          if (!mined || hash !== rawHash) return { ok: false, code: codes.SERVICE_DEGRADED }
          return { ok: true, status: 1n, from: wallet, to: padAddr(2n), input: "0x01", logs: [] }
        },
        async sendRaw(raw: string) {
          replays += 1
          expect(raw).toBe("0xrawpl5")
          const saved = await getBytes(rawHost.store, "cities", "world")
          expect(saved !== undefined).toBe(true)
          if (saved === undefined) return { ok: false, code: codes.SERVICE_DEGRADED }
          const text = fromUtf8(saved)
          expect(text.includes("0xrawpl5")).toBe(true)
          expect(text.includes('"chain_mint_capital":0')).toBe(false)
          expect(text.includes('"chain_mint_capital":"0"')).toBe(false)
          return { ok: true }
        },
      },
    }
    expect((await rawMock.vault.deposit(wallet, 4n)).ok).toBe(true)
    rawCity["chain_mint_corp"] = 4n
    rawCity["chain_mint_capital"] = 4n
    await settleServerMint(rawHost.store, rawHost.state, rawAuth.cityId, rawPort)
    expect(signs).toBe(1)
    expect(replays).toBe(1)
    expect(asBigint(rawCity["chain_mint_capital"], 0n)).toBe(4n)
    expect(asText(rawCity["chain_mint_raw"])).toBe("0xrawpl5")
    await settleServerMint(rawHost.store, rawHost.state, rawAuth.cityId, rawPort)
    expect(signs).toBe(1)
    expect(replays).toBe(2)
    rawCity["chain_mint_corp"] = 7n
    rawCity["chain_mint_capital"] = 7n
    mined = true
    await settleServerMint(rawHost.store, rawHost.state, rawAuth.cityId, rawPort)
    expect(signs).toBe(1)
    expect(replays).toBe(2)
    expect(asBigint(rawCity["chain_mint_corp"], 0n)).toBe(3n)
    expect(asBigint(rawCity["chain_mint_capital"], 0n)).toBe(3n)
    expect(asText(rawCity["chain_mint_raw"])).toBe("")
  }, 120_000)

  it("does_not_mint_without_debit", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const vaultBefore = asBigint(host.state["vault_corp"], 0n)
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/deposit",
      cmdBody("dp6", t, { amount: wei + 1n }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CORP)
    expect(asBigint(city["corp_held"])).toBe(wei)
    expect(asBigint(city["capital"])).toBe(0n)
    expect(asBigint(host.state["vault_corp"], 0n)).toBe(vaultBefore)

    const wallet = padAddr(7n)
    city["wallet"] = wallet
    let stalePulls = 0
    const staleMock = createMockPort(portCfgFromPack(host.ctx.pack), { corp: { [wallet]: wei } })
    const stalePort: AssetPort = {
      ...staleMock,
      kind: "rpc",
      vault: {
        ...staleMock.vault,
        async deposit(account, amt) {
          stalePulls += 1
          return staleMock.vault.deposit(account, amt)
        },
      },
    }
    host.state["mint_rate"] = 0n
    const stale = await applyDeposit(
      host.ctx,
      host.state,
      city,
      { amount: wei, intent_id: "dp6stale", expected_city_time: t },
      auth.cityId,
      stalePort,
    )
    expect(bodyCode(stale.body)).toBe(codes.STALE_PRICE)
    expect(stalePulls).toBe(0)
    expect(asBigint(city["capital"])).toBe(0n)

    const broken = await bootHost()
    const brokenAuth = await walletAuth(broken)
    const brokenCity = cityOf(broken, brokenAuth.cityId)
    brokenCity["wallet"] = wallet
    const brokenAmount = asBigint(broken.ctx.cfg["wei"])
    const cap = (asBigint(broken.state["vault_corp"], 0n) + brokenAmount) * asBigint(broken.ctx.cfg["capital_anchor"])
    brokenCity["capital"] = cap + 1n
    broken.state["capital_outstanding"] = cap + 1n
    let i1Pulls = 0
    const i1Mock = createMockPort(portCfgFromPack(broken.ctx.pack), { corp: { [wallet]: brokenAmount } })
    const i1Port: AssetPort = {
      ...i1Mock,
      kind: "rpc",
      vault: {
        ...i1Mock.vault,
        async deposit(account, amt) {
          i1Pulls += 1
          return i1Mock.vault.deposit(account, amt)
        },
      },
    }
    const blocked = await applyDeposit(
      broken.ctx,
      broken.state,
      brokenCity,
      { amount: brokenAmount, intent_id: "dp6i1", expected_city_time: asBigint(broken.state["city_time"]) },
      brokenAuth.cityId,
      i1Port,
    )
    expect(bodyCode(blocked.body)).toBe(codes.API_MALFORMED)
    expect(i1Pulls).toBe(0)
    expect(asBigint(brokenCity["capital"])).toBe(cap + 1n)
  })

  it("applies_vault_fee_not_gross", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    const rate = asBigint(host.state["mint_rate"])
    const gross = (wei * rate) / wei
    const want = expectedMint(host, wei)
    expect(want < gross).toBe(true)
    city["corp_held"] = wei
    const t = asBigint(host.state["city_time"])
    const ok = await host.handle("POST", "/command/deposit", cmdBody("dp7", t, { amount: wei }), auth.headers)
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(asBigint(city["capital"])).toBe(want)
    expect(asBigint(city["capital"]) === gross).toBe(false)
  })
})

function expectedCorp(host: Awaited<ReturnType<typeof bootHost>>, capital: bigint): bigint {
  const rate = asBigint(host.state["mint_rate"])
  const wei = asBigint(host.ctx.cfg["wei"])
  const bps = asBigint(host.ctx.cfg["bps"])
  const markup = asBigint(host.ctx.cfg["bank_markup_bps"])
  const denom = rate * (bps + markup)
  if (denom <= 0n || wei <= 0n) return 0n
  return (capital * wei * bps) / denom
}

function clockTickOf(
  host: Awaited<ReturnType<typeof bootHost>>,
  want: (day: bigint, hour: bigint, weekday: bigint) => boolean,
): bigint {
  let i = 0n
  while (i < 2000n) {
    const clock = cityClock(host.ctx.cfg, i)
    if (want(clock[0], clock[1], clock[2])) return i
    i += 1n
  }
  return 0n
}

describe("H2.10 withdraw", () => {
  it("refuses_demo_withdraw", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    seedPlayerCapital(host, auth.cityId, 50n)
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/withdraw", cmdBody("wd1", t, { amount: 10n }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.DEMO_NO_WITHDRAW)
    expect(asBigint(city["capital"]) >= 50n).toBe(true)
  })

  it("refuses_withdraw_without_capital", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["capital"] = 0n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/withdraw", cmdBody("wd2", t, { amount: 10n }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CAPITAL)
  })

  it("refuses_sunday_before_hours", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    seedPlayerCapital(host, auth.cityId, 50n)
    const closed = asBigint(host.ctx.cfg["bank_closed_weekday"])
    const idx = clockTickOf(host, (_d, _h, weekday) => weekday === closed)
    expect(idx > 0n).toBe(true)
    host.state["tick_index"] = idx
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/withdraw", cmdBody("wd3", t, { amount: 10n }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.BANK_SUNDAY)
    expect(asBigint(city["capital"]) >= 50n).toBe(true)
  })

  it("refuses_when_bank_hours_closed", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const closed = asBigint(host.ctx.cfg["bank_closed_weekday"])
    const idx = clockTickOf(host, (_d, hour, weekday) => weekday !== closed && bankOpen(host.ctx.cfg, hour, weekday) === 0n)
    expect(idx > 0n).toBe(true)
    host.state["tick_index"] = idx
    seedPlayerCapital(host, auth.cityId, 50n)
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/withdraw", cmdBody("wd4", t, { amount: 10n }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.BANK_CLOSED)
  })

  it("pays_corp_via_authorize_then_present", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    seedPlayerCapital(host, auth.cityId, 50n)
    const before = asBigint(city["capital"])
    const vaultBefore = asBigint(host.state["vault_corp"])
    const outstandingBefore = asBigint(host.state["capital_outstanding"])
    const fundBefore = asBigint(host.state["fund"], 0n)
    const amount = 10n
    const want = expectedCorp(host, amount)
    expect(want > 0n).toBe(true)
    const floorMarkup = asBigint(host.ctx.cfg["bank_markup_floor_bps"])
    const rate = asBigint(host.state["mint_rate"])
    const wei = asBigint(host.ctx.cfg["wei"])
    const bps = asBigint(host.ctx.cfg["bps"])
    const better = (amount * wei * bps) / (rate * (bps + floorMarkup))
    expect(want < better).toBe(true)
    const t = asBigint(host.state["city_time"])
    const ok = await host.handle("POST", "/command/withdraw", cmdBody("wd5", t, { amount }), auth.headers)
    expect(ok.status).toBe(host.ctx.httpOk)
    expect(bodyCode(ok.body)).toBe("")
    expect(asBigint(city["capital"])).toBe(before - amount)
    expect(asBigint(city["corp_held"])).toBe(want)
    expect(asBigint(host.state["vault_corp"])).toBe(vaultBefore - want)
    expect(asBigint(host.state["capital_outstanding"])).toBe(outstandingBefore - amount)
    expect(asBigint(host.state["fund"], 0n)).toBe(fundBefore)
    expect(asBigint(city["withdraw_intent"], 0n)).toBe(0n)
    expect(asBigint(city["withdrawn_capital"], 0n)).toBe(amount)
    expect(asBigint(asEngineDict(host.state["acc"])["withdrawn_capital"], 0n)).toBe(amount)
    const rows = asList(host.state["bank_reservations"])
    expect(rows.length).toBe(1)
    expect(asText(asEngineDict(rows[0])["status"])).toBe("settled")
    const cap = asBigint(host.state["vault_corp"]) * asBigint(host.ctx.cfg["capital_anchor"])
    expect(asBigint(host.state["capital_outstanding"]) <= cap).toBe(true)
    const idx = asBigint(host.state["tick_index"], 0n)
    await host.stepTick(makeInputs(host.ctx.cfg, idx))
    expect(asBigint(asEngineDict(host.state["acc"])["withdrawn_capital"], 0n)).toBe(amount)
  })

  it("refuses_when_daily_limit_is_zero", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    seedPlayerCapital(host, auth.cityId, 50n)
    const clock = cityClock(host.ctx.cfg, asBigint(host.state["tick_index"], 0n))
    host.state["bank_day"] = clock[0]
    host.state["bank_used_today_wei"] = asBigint(host.state["pool_eth"])
    host.state["bank_reserved_today_wei"] = 0n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/withdraw", cmdBody("wd6", t, { amount: 10n }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.BANK_DAILY_LIMIT_REACHED)
    expect(asBigint(cityOf(host, auth.cityId)["capital"]) >= 50n).toBe(true)
  })

  it("refuses_uncovered_vault", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["capital"] = 50n
    host.state["vault_corp"] = 0n
    host.state["capital_outstanding"] = 50n
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/withdraw", cmdBody("wd7", t, { amount: 10n }), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.VAULT_EXIT_UNCOVERED)
    expect(asBigint(city["capital"])).toBe(50n)
    expect(asBigint(city["corp_held"], 0n)).toBe(0n)
  })
})

describe("H2.11 buy_stock", () => {
  it("refuses_buy_stock_without_wallet", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/buy_stock",
      cmdBody("bs1", t, { ticker: "NVDA", amount: wei }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.WALLET_NOT_CONNECTED)
    expect(asBigint(city["corp_held"])).toBe(wei)
  })

  it("refuses_buy_stock_without_corp", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    openExchange(host, city)
    city["corp_held"] = 0n
    const wei = asBigint(host.ctx.cfg["wei"])
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/buy_stock",
      cmdBody("bs2", t, { ticker: "NVDA", amount: wei }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.NOT_ENOUGH_CORP)
  })

  it("refuses_unknown_or_empty_ticker", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const t = asBigint(host.state["city_time"])
    const missing = await host.handle("POST", "/command/buy_stock", cmdBody("bs3", t, { amount: wei }), auth.headers)
    expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const unknown = await host.handle(
      "POST",
      "/command/buy_stock",
      cmdBody("bs4", t, { ticker: "GOOGL", amount: wei }),
      auth.headers,
    )
    expect(bodyCode(unknown.body)).toBe(codes.API_MALFORMED)
    expect(asBigint(city["corp_held"])).toBe(wei)
  })

  it("refuses_hop_when_quote_is_not_live", async () => {
    const host = await bootHost()
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    openExchange(host, city)
    const wei = asBigint(host.ctx.cfg["wei"])
    city["corp_held"] = wei
    const poolEth = asBigint(host.state["pool_eth"])
    const poolCorp = asBigint(host.state["pool_corp"])
    const vault = asBigint(host.state["vault_corp"])
    const fund = asBigint(host.state["fund"], 0n)
    const outstanding = asBigint(host.state["capital_outstanding"])
    const tokens = asEngineDict(city["tokens_held"])
    const nvda = asBigint(tokens["NVDA"], 0n)
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/buy_stock",
      cmdBody("bs5", t, { ticker: "NVDA", amount: wei }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe(codes.EXCHANGE_HOP_UNAVAILABLE)
    expect(hopPriced()).toBe(false)
    expect(asBigint(city["corp_held"])).toBe(wei)
    expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(nvda)
    expect(asBigint(host.state["pool_eth"])).toBe(poolEth)
    expect(asBigint(host.state["pool_corp"])).toBe(poolCorp)
    expect(asBigint(host.state["vault_corp"])).toBe(vault)
    expect(asBigint(host.state["fund"], 0n)).toBe(fund)
    expect(asBigint(host.state["capital_outstanding"])).toBe(outstanding)
    expect(hopPriced(1n)).toBe(true)
    const emptyFill = await hopFillFromEnv({}, "NVDA", wei)
    expect(emptyFill.ok).toBe(false)
    expect(emptyFill.stockOut).toBe(0n)
    const zeroFill = await applyBuyStock(
      host.ctx,
      host.state,
      city,
      { ticker: "NVDA", amount: wei, intent_id: "bs6", expected_city_time: t },
      auth.cityId,
      { priced: true, fill: async () => ({ ok: true, stockOut: 0n }) },
    )
    expect(bodyCode(zeroFill.body)).toBe(codes.EXCHANGE_HOP_UNAVAILABLE)
    expect(asBigint(city["corp_held"])).toBe(wei)
    const dust = await applyBuyStock(
      host.ctx,
      host.state,
      city,
      { ticker: "NVDA", amount: wei, intent_id: "bs6b", expected_city_time: t },
      auth.cityId,
      { priced: true, fill: async () => ({ ok: true, stockOut: 1n }) },
    )
    expect(dust.status).toBe(host.ctx.httpOk)
    expect(bodyCode(dust.body)).toBe("")
    expect(asBigint(city["corp_held"])).toBe(0n)
    expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"])).toBe(nvda + 1n)
    city["corp_held"] = wei
    const rawOut = 10000n
    const haircut = asBigint(walk(host.ctx.pack, ["sections", "fragments", "params", "fragment_hop_haircut_bps", "v"]))
    const bps = asBigint(host.ctx.cfg["bps"])
    const shaved = (rawOut * (bps - haircut)) / bps
    expect(shaved < rawOut).toBe(true)
    const filled = await applyBuyStock(
      host.ctx,
      host.state,
      city,
      { ticker: "NVDA", amount: wei, intent_id: "bs7", expected_city_time: t },
      auth.cityId,
      { priced: true, fill: async () => ({ ok: true, stockOut: rawOut }) },
    )
    expect(filled.status).toBe(host.ctx.httpOk)
    const ok = asObj(parseJson(fromUtf8(filled.body)))
    expect("code" in ok).toBe(false)
    expect(ok["effect"]).toBe("buy_stock")
    expect(ok["stock_out"]).toBe(shaved)
    expect(asBigint(city["corp_held"])).toBe(0n)
    expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(nvda + 1n + shaved)
    expect(asBigint(host.state["pool_corp"])).not.toBe(poolCorp)
    city["corp_held"] = wei
    city["hop_quality"] = 1n
    const quoted = await applyBuyStock(
      host.ctx,
      host.state,
      city,
      { ticker: "NVDA", amount: wei, intent_id: "bs8", expected_city_time: t },
      auth.cityId,
      { priced: true, fill: async () => ({ ok: true, stockOut: rawOut }) },
    )
    expect(quoted.status).toBe(host.ctx.httpOk)
    const quotedOk = asObj(parseJson(fromUtf8(quoted.body)))
    expect(quotedOk["stock_out"]).toBe(rawOut)
    expect(asBigint(asEngineDict(city["tokens_held"])["NVDA"], 0n)).toBe(nvda + 1n + shaved + rawOut)
  })
})

function padAddr(n: bigint): string {
  return "0x" + n.toString(16).padStart(40, "0")
}

function prizePaid(body: Uint8Array, ticker: string): { readonly paid: bigint; readonly code: string } {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { paid: 0n, code: "" }
  }
  const rows = asObj(parsed)["assets"]
  if (!Array.isArray(rows)) return { paid: 0n, code: "" }
  for (const raw of rows) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asObj(raw)
    if (asText(row["asset"]) !== ticker) continue
    return { paid: asBigint(row["paid"], 0n), code: asText(row["code"]) }
  }
  return { paid: 0n, code: "" }
}

describe("M6 prize custody", () => {
  it("mock_port_is_not_prize_custody", async () => {
    const host = await bootHost()
    const cfg = portCfgFromPack(host.ctx.pack)
    const mock = selectApiPort(cfg, {})
    expect(mock.kind).toBe("mock")
    expect(prizeCustodyLive(mock)).toBe(false)
    expect(hopPriced()).toBe(false)
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["prize_owed"] = { NVDA: 50n }
    city["prize_pool_in"] = { NVDA: 50n }
    const t = asBigint(host.state["city_time"])
    const res = await host.handle("POST", "/command/claim_prize", cmdBody("m6a", t), auth.headers)
    expect(bodyCode(res.body)).toBe(codes.DEMO_NO_PRIZE)
    expect(prizePaid(res.body, "NVDA").paid).toBe(0n)
  })

  it("rpc_silence_does_not_pay", async () => {
    const host = await bootHost()
    const cfg = portCfgFromPack(host.ctx.pack)
    const env = {
      CORPORATOR_RPC_URL: "http://127.0.0.1:1",
      CORPORATOR_CHAIN_ID: "1",
      CORPORATOR_RPC_TIMEOUT_MS: "1",
      CORPORATOR_CORP_TOKEN: padAddr(1n),
      CORPORATOR_VAULT: padAddr(2n),
      CORPORATOR_STAKE_REGISTRY: padAddr(3n),
      CORPORATOR_MERKLE_ROOTS: padAddr(4n),
      CORPORATOR_PRIZE_TREASURY: padAddr(5n),
    }
    expect(selectApiPort(cfg, env).kind).toBe("mock")
    expect(prizeCustodyLive(selectApiPort(cfg, env))).toBe(false)
    const opened = { ...env, CORPORATOR_DEPOSITS_OPEN: "1" }
    expect(selectApiPort(cfg, opened).kind).toBe("rpc")
    const refused = pickApiPort(cfg, { ...opened, CORPORATOR_VAULT: "not-an-address" })
    expect(refused.kind).toBe("refuse")
    const silent = createRpcPort(cfg, silentTransport())
    expect(prizeCustodyLive(silent)).toBe(true)
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["wallet"] = padAddr(7n)
    city["corp_held"] = 2n
    let chainMints = 0
    const closed = selectApiPort(cfg, env)
    const watched: AssetPort = {
      ...closed,
      vault: {
        ...closed.vault,
        async mintCapital(account, corpAmount, capitalAmount) {
          chainMints += 1
          return closed.vault.mintCapital(account, corpAmount, capitalAmount)
        },
      },
    }
    await applyDeposit(
      host.ctx,
      host.state,
      city,
      { amount: 1n, intent_id: "pl4", expected_city_time: asBigint(host.state["city_time"]) },
      auth.cityId,
      watched,
    )
    expect(chainMints).toBe(0)
    city["prize_owed"] = { NVDA: 50n }
    city["prize_pool_in"] = { NVDA: 50n }
    const res = await applyLive(host.ctx, host.state, "claim_prize", {}, auth.cityId, silent)
    expect(res !== undefined).toBe(true)
    if (res !== undefined) {
      expect(bodyCode(res.body)).toBe(codes.DEMO_NO_PRIZE)
      expect(prizePaid(res.body, "NVDA").paid).toBe(0n)
    }
    const stopped = await bindDeposits(host, { CORPORATOR_DEPOSITS_OPEN: "1", CORPORATOR_VAULT: "not-an-address" })
    expect(stopped).toBeUndefined()
  })

  it("live_treasury_transfer_pays", async () => {
    const host = await bootHost()
    const cfg = portCfgFromPack(host.ctx.pack)
    const caller = padAddr(7n)
    const mock = createMockPort(cfg, {
      prizeStocks: ["NVDA"],
      prizeDepositor: cfg.buybackExecutorService,
      prizeSigner: cfg.voucherSignerService,
      prizeBalances: { [cfg.buybackExecutorService]: { NVDA: 50n } },
    })
    const deposited = await mock.prizeTreasury.deposit(cfg.buybackExecutorService, "NVDA", PRIZE_KETTLE_FARM, 50n)
    expect(deposited.ok).toBe(true)
    const sliced = await mock.prizeTreasury.slice(
      cfg.voucherSignerService,
      "b-h2",
      "NVDA",
      PRIZE_KETTLE_FARM,
      [caller],
      [50n],
    )
    expect(sliced.ok).toBe(true)
    const livePort: AssetPort = { ...mock, kind: "rpc" }
    const auth = await walletAuth(host)
    const city = cityOf(host, auth.cityId)
    city["wallet"] = caller
    city["prize_owed"] = { NVDA: 50n }
    city["prize_pool_in"] = { NVDA: 50n }
    const deployed = walk(host.ctx.pack, ["sections", "launch", "deployed"])
    if (deployed !== null && typeof deployed === "object" && !Array.isArray(deployed)) {
      const row = deployed as { [key: string]: string }
      row["token"] = padAddr(1n)
      row["curve"] = padAddr(2n)
      row["pool"] = padAddr(3n)
      row["hook"] = padAddr(4n)
      row["tx"] = "0x" + "ab".repeat(32)
    }
    const res = await applyLive(host.ctx, host.state, "claim_prize", {}, auth.cityId, livePort)
    expect(res !== undefined).toBe(true)
    if (res === undefined) return
    const nvda = prizePaid(res.body, "NVDA")
    expect(nvda.paid).toBe(50n)
    expect(nvda.code).toBe("")
    const twice = await mock.prizeTreasury.claimPrize(caller, "NVDA", PRIZE_KETTLE_FARM)
    expect(twice.ok).toBe(false)
  })

  it("vault_and_prize_have_no_pause", () => {
    const vault = readFileSync(join(repo, "contracts/src/Vault.sol"), "utf8")
    const treas = readFileSync(join(repo, "contracts/src/PrizeTreasury.sol"), "utf8")
    expect(vault.includes("function pause")).toBe(false)
    expect(vault.includes("function unpause")).toBe(false)
    expect(treas.includes("function pause")).toBe(false)
    expect(treas.includes("function unpause")).toBe(false)
    expect(treas.includes("function returnUnsettled")).toBe(true)
    expect(vault.includes("function refundPlayer")).toBe(true)
  })
})

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

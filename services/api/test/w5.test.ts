import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { putJson } from "../src/store.ts"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "../src/values.ts"
import { bootHost } from "./harness.ts"

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function cityOf(host: Awaited<ReturnType<typeof bootHost>>, cityId: string) {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function stakeMinOf(host: Awaited<ReturnType<typeof bootHost>>, ticker: string): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

function graceOf(host: Awaited<ReturnType<typeof bootHost>>): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "economy", "params", "unstake_grace_city_hours", "v"]))
}

function opened(city: ReturnType<typeof cityOf>): string[] {
  const raw = city["districts"]
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === "string")
}

async function walletCity(host: Awaited<ReturnType<typeof bootHost>>, sessionId: string) {
  const cityId = "a"
  const city = cityOf(host, cityId)
  city["account_kind"] = "wallet"
  const expires = asBigint(host.state["city_time"]) + host.ctx.sessionTtlCity
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
  return { cityId, city, headers: { authorization: "Bearer " + sessionId } }
}

async function command(
  host: Awaited<ReturnType<typeof bootHost>>,
  headers: { readonly authorization: string },
  effect: string,
  intent: string,
  extra: { readonly [key: string]: Json },
) {
  return host.handle(
    "POST",
    "/command/" + effect,
    canonical({ intent_id: intent, expected_city_time: asBigint(host.state["city_time"]), ...extra }),
    headers,
  )
}

describe("W5 stake opens a district", () => {
  it("stakes s_min on NVDA and opens compute at tier 1", async () => {
    const host = await bootHost()
    const auth = await walletCity(host, "w5-open")
    const need = stakeMinOf(host, "NVDA")
    auth.city["tokens_held"] = { NVDA: need }
    const res = await command(host, auth.headers, "stake", "w5-s", { ticker: "NVDA", amount: need })
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(opened(auth.city)).toContain("compute")
    expect(asBigint(asEngineDict(auth.city["district_tiers"])["compute"], 0n)).toBe(1n)
    expect(asBigint(asEngineDict(auth.city["stake_settled"])["NVDA"], 0n)).toBe(need)
  })

  it("a stake below s_min does not open, and open_district stays below threshold", async () => {
    const host = await bootHost()
    const auth = await walletCity(host, "w5-short")
    const need = stakeMinOf(host, "NVDA")
    expect(need > 1n).toBe(true)
    auth.city["tokens_held"] = { NVDA: need }
    const staked = await command(host, auth.headers, "stake", "w5-low", { ticker: "NVDA", amount: need - 1n })
    expect(bodyCode(staked.body)).toBe(codes.STAKE_MULT_SHORT)
    expect(opened(auth.city)).not.toContain("compute")
    expect(asBigint(asEngineDict(auth.city["stake_settled"])["NVDA"], 0n)).toBe(0n)
    const openedRes = await command(host, auth.headers, "open_district", "w5-od", { district_id: "compute" })
    expect(bodyCode(openedRes.body)).toBe(codes.STAKE_BELOW_THRESHOLD)
    expect(opened(auth.city)).not.toContain("compute")
  })

  it("opens at the threshold with an empty corp balance", async () => {
    const host = await bootHost()
    const auth = await walletCity(host, "w5-corp")
    const need = stakeMinOf(host, "NVDA")
    auth.city["stake_settled"] = { NVDA: need }
    auth.city["corp_held"] = 0n
    const res = await command(host, auth.headers, "open_district", "w5-free", { district_id: "compute" })
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(opened(auth.city)).toContain("compute")
    expect(asBigint(auth.city["corp_held"], 0n)).toBe(0n)
    expect(asBigint(asEngineDict(auth.city["district_tiers"])["compute"], 0n)).toBe(1n)
  })

  it("unstake below s_min freezes, and staking back to the threshold thaws", async () => {
    const host = await bootHost()
    const auth = await walletCity(host, "w5-freeze")
    const need = stakeMinOf(host, "NVDA")
    const grace = graceOf(host)
    expect(grace > 0n).toBe(true)
    auth.city["tokens_held"] = { NVDA: need }
    const staked = await command(host, auth.headers, "stake", "w5-full", { ticker: "NVDA", amount: need })
    expect(staked.status).toBe(host.ctx.httpOk)
    const now = asBigint(host.state["city_time"])
    const pulled = await command(host, auth.headers, "unstake", "w5-pull", { ticker: "NVDA", amount: 1n })
    expect(pulled.status).toBe(host.ctx.httpOk)
    expect(asBigint(asEngineDict(auth.city["stake_settled"])["NVDA"], 0n)).toBe(need - 1n)
    expect(asBigint(asEngineDict(auth.city["district_freeze_until"])["NVDA"], 0n)).toBe(now + grace)
    const back = await command(host, auth.headers, "stake", "w5-back", { ticker: "NVDA", amount: 1n })
    expect(back.status).toBe(host.ctx.httpOk)
    expect(asBigint(asEngineDict(auth.city["stake_settled"])["NVDA"], 0n)).toBe(need)
    expect("NVDA" in asEngineDict(auth.city["district_freeze_until"])).toBe(false)
  })

  it("unstake above the settled stake does not go negative or open the district", async () => {
    const host = await bootHost()
    const auth = await walletCity(host, "w5-over")
    const held = 5n
    auth.city["stake_settled"] = { NVDA: held }
    auth.city["tokens_held"] = { NVDA: 0n }
    const res = await command(host, auth.headers, "unstake", "w5-too", { ticker: "NVDA", amount: held + 1n })
    expect(bodyCode(res.body)).toBe(codes.STAKE_BELOW_THRESHOLD)
    expect(asBigint(asEngineDict(auth.city["stake_settled"])["NVDA"], 0n)).toBe(held)
    expect(asBigint(asEngineDict(auth.city["tokens_held"])["NVDA"], 0n)).toBe(0n)
    expect(opened(auth.city)).not.toContain("compute")
  })
})

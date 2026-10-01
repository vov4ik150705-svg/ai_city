import { describe, expect, it } from "vitest"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { assertI1, bankOpen, cityClock, TickError, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { putJson } from "../src/store.ts"
import { bootHostOn, makeInputs, openPglite } from "./harness.ts"

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function cmdBody(
  intent: string,
  cityTime: bigint,
  extra: { readonly [key: string]: string | bigint } = {},
): Uint8Array {
  return canonical({ intent_id: intent, expected_city_time: cityTime, ...extra })
}

function cityOf(host: Awaited<ReturnType<typeof bootHostOn>>): Dict {
  return asEngineDict(asEngineDict(host.state["cities"])["a"])
}

function claimBags(state: Dict): bigint {
  let bags = asBigint(state["fund"])
  const cities = asEngineDict(state["cities"])
  for (const id of Object.keys(cities)) bags += asBigint(asEngineDict(cities[id])["capital"])
  return bags
}

function vaultCap(host: Awaited<ReturnType<typeof bootHostOn>>): bigint {
  return asBigint(host.state["vault_corp"]) * asBigint(host.ctx.cfg["capital_anchor"])
}

function constructionOf(city: Dict, buildingId: string): bigint {
  const rows = city["functions"]
  if (!Array.isArray(rows)) return 0n
  for (const item of rows) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = item as Dict
    if (asText(row["id"]) !== buildingId) continue
    return asBigint(row["construction"])
  }
  return 0n
}

function stakeMin(host: Awaited<ReturnType<typeof bootHostOn>>, ticker: string): bigint {
  return asBigint(walk(host.ctx.pack, ["sections", "districts", "stake", "s_min", ticker, "v"]))
}

describe("W25 acceptance walk", () => {
  it("walks a fresh wallet from deposit through a settled voucher", async () => {
    const host = await bootHostOn(await openPglite())
    const cityId = "a"
    const city = cityOf(host)
    city["account_kind"] = "wallet"
    city["demo"] = 0n
    const sessionId = "w25-wallet"
    const expires = asBigint(host.state["city_time"]) + 10_000n
    await putJson(
      host.store,
      "sessions",
      sessionId,
      { kind: "session", city_id: cityId, account_kind: "wallet", expires_city_time: expires.toString() },
      "wallet",
    )
    const headers = { authorization: "Bearer " + sessionId }
    const log: { step: string; code: string; capital: string; corp: string }[] = []

    function snap(step: string, code: string): void {
      const row = cityOf(host)
      log.push({
        step,
        code,
        capital: asBigint(row["capital"]).toString(),
        corp: asBigint(row["corp_held"]).toString(),
      })
      expect(asBigint(host.state["capital_outstanding"]) <= vaultCap(host), step + " outstanding").toBe(true)
      expect(claimBags(host.state) <= vaultCap(host), step + " bags").toBe(true)
    }

    async function post(
      step: string,
      effect: string,
      intent: string,
      extra: { readonly [key: string]: string | bigint } = {},
    ): Promise<string> {
      const t = asBigint(host.state["city_time"])
      const res = await host.handle("POST", "/command/" + effect, cmdBody(intent, t, extra), headers)
      const code = bodyCode(res.body)
      if (code.length === 0) expect(res.status, step).toBe(host.ctx.httpOk)
      snap(step, code)
      return code
    }

    const wei = asBigint(host.ctx.cfg["wei"])
    const amount = wei * 20_000_000n
    cityOf(host)["corp_held"] = amount
    expect(await post("deposit", "deposit", "w25-deposit", { amount })).toBe("")
    expect(asBigint(cityOf(host)["capital"]) > 0n).toBe(true)
    expect(await post("hire", "hire", "w25-hire", { role: "engineer" })).toBe("")
    expect(asText(asEngineDict((cityOf(host)["agents"] as unknown[])[0])["id"])).toBe("h1")
    expect(await post("build-workshop", "build", "w25-workshop", { building_id: "workshop" })).toBe("")
    expect(await post("build-energy-locked", "build", "w25-energy-locked", { building_id: "energy_plant" })).toBe(
      codes.DISTRICT_LOCKED,
    )
    const need = stakeMin(host, "TSLA")
    expect(need > 0n).toBe(true)
    expect(
      await post("stake", "stake", "w25-stake", { district_id: "energy", source: "wallet", amount: need }),
    ).toBe("")
    expect(await post("open", "open_district", "w25-open", { district_id: "energy" })).toBe("")
    expect(await post("build-energy", "build", "w25-energy", { building_id: "energy_plant" })).toBe("")

    let cursor = asBigint(host.state["tick_index"])
    let stepped = false
    async function step(): Promise<void> {
      const index = stepped ? cursor + 1n : cursor
      await host.stepTick(makeInputs(host.ctx.cfg, index))
      cursor = asBigint(host.state["tick_index"])
      stepped = true
      snap("tick", "")
    }
    let guard = 0
    while (constructionOf(cityOf(host), "workshop") > 0n && guard < 64) {
      await step()
      guard += 1
    }
    expect(constructionOf(cityOf(host), "workshop")).toBe(0n)
    expect(await post("assign", "assign", "w25-assign", { agent_id: "h1", building_id: "workshop" })).toBe("")

    const outstandingBefore = asBigint(host.state["capital_outstanding"])
    const bagsBefore = claimBags(host.state)
    let played = 0
    while (played < 3) {
      await step()
      played += 1
    }
    expect(asBigint(host.state["capital_outstanding"])).toBe(outstandingBefore)
    expect(claimBags(host.state) <= bagsBefore).toBe(true)

    guard = 0
    while (guard < 400) {
      const clock = cityClock(host.ctx.cfg, asBigint(host.state["tick_index"]))
      const weekday = clock[2]
      const hour = clock[1]
      const sunday = weekday === asBigint(host.ctx.cfg["bank_closed_weekday"])
      if (!sunday && bankOpen(host.ctx.cfg, hour, weekday) !== 0n) break
      await step()
      guard += 1
    }
    expect(guard < 400).toBe(true)
    const held = asBigint(cityOf(host)["capital"])
    expect(held > 1n).toBe(true)
    const corpBefore = asBigint(cityOf(host)["corp_held"])
    const capitalBefore = held
    const take = 1n
    expect(await post("withdraw", "withdraw", "w25-withdraw", { amount: take })).toBe("")
    const after = cityOf(host)
    expect(asBigint(after["capital"]) < capitalBefore).toBe(true)
    expect(asBigint(after["corp_held"]) > corpBefore).toBe(true)
    const capitalAfter = asBigint(after["capital"])
    const corpAfter = asBigint(after["corp_held"])
    const replay = await host.handle(
      "POST",
      "/command/withdraw",
      cmdBody("w25-withdraw", asBigint(host.state["city_time"]), { amount: held }),
      headers,
    )
    expect(bodyCode(replay.body)).toBe("")
    expect(asBigint(cityOf(host)["capital"])).toBe(capitalAfter)
    expect(asBigint(cityOf(host)["corp_held"])).toBe(corpAfter)

    expect(await post("present", "present_voucher", "w25-present", { voucher_id: "w25-withdraw" })).toBe("")
    expect(asBigint(cityOf(host)["capital"])).toBe(capitalAfter)
    expect(asBigint(cityOf(host)["corp_held"])).toBe(corpAfter)
    expect(await post("present-again", "present_voucher", "w25-present-2", { voucher_id: "w25-withdraw" })).toBe("")
    expect(asBigint(cityOf(host)["capital"])).toBe(capitalAfter)
    expect(asBigint(cityOf(host)["corp_held"])).toBe(corpAfter)
    const missing = await post("present-missing", "present_voucher", "w25-present-missing", {})
    expect(missing).toBe(codes.API_MALFORMED)
    expect(asBigint(cityOf(host)["corp_held"])).toBe(corpAfter)

    const broken = structuredClone(host.state)
    const cap = asBigint(broken["vault_corp"]) * asBigint(host.ctx.cfg["capital_anchor"])
    broken["fund"] = cap + 1n
    let caught = ""
    try {
      assertI1(host.ctx.cfg, broken, cityId)
    } catch (err) {
      if (err instanceof TickError) caught = err.code
    }
    expect(caught).toBe("I1_VAULT")
    expect(log.map((row) => row.step + ":" + row.code).join(",")).toContain("present:")
  })
})

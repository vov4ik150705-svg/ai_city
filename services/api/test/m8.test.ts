import { describe, expect, it } from "vitest"
import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { asBigint, asEngineDict, asObj, asText, walk } from "../src/values.ts"
import { applyLive } from "../src/commit.ts"
import { bootHost, demoAuth, makeInputs, seedPlayerCapital } from "./harness.ts"

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function cmdBody(intent: string, cityTime: bigint, extra: { readonly [key: string]: string } = {}): Uint8Array {
  return canonical({ intent_id: intent, expected_city_time: cityTime, ...extra })
}

function cityOf(host: Awaited<ReturnType<typeof bootHost>>, cityId: string) {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function agentsOf(city: ReturnType<typeof cityOf>): { readonly [key: string]: unknown }[] {
  const raw = city["agents"]
  if (!Array.isArray(raw)) return []
  return raw.filter((row) => row !== null && typeof row === "object" && !Array.isArray(row)) as {
    readonly [key: string]: unknown
  }[]
}

describe("M8 hire assign objective", () => {
  it("hire_pool_never_scientist", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const cost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, cost * 20n)
    city["tick_index"] = 0n
    const seen = new Set<string>()
    for (let i = 0; i < 8; i += 1) {
      const t = asBigint(host.state["city_time"])
      const res = await host.handle("POST", "/command/hire", cmdBody("h" + String(i), t), auth.headers)
      expect(bodyCode(res.body)).toBe("")
    }
    for (const row of agentsOf(city)) {
      const role = asText(row["role"])
      seen.add(role)
      expect(role === "scientist" || role === "manager").toBe(false)
    }
    expect(seen.has("engineer") || seen.has("logistician") || seen.has("trader")).toBe(true)
  })

  it("hire_explicit_scientist", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const cost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, cost + cost)
    const t = asBigint(host.state["city_time"])
    const res = await host.handle(
      "POST",
      "/command/hire",
      cmdBody("hs", t, { role: "scientist" }),
      auth.headers,
    )
    expect(bodyCode(res.body)).toBe("")
    const hired = agentsOf(city)[0]
    expect(hired !== undefined).toBe(true)
    if (hired !== undefined) {
      expect(asText(hired["role"])).toBe("scientist")
      expect(asText(hired["objective"])).toBe("train")
      expect(asText(hired["train_target"])).toBe("")
      expect(asText(hired["idle"])).toBe("IDLE_NO_TRAIN_TARGET")
      expect(asBigint(hired["level"], 1n)).toBe(1n)
    }
  })

  it("assign_displaces_occupant", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const cost = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    seedPlayerCapital(host, auth.cityId, cost * 4n)
    const t = asBigint(host.state["city_time"])
    await host.handle("POST", "/command/hire", cmdBody("a1", t, { role: "engineer" }), auth.headers)
    await host.handle("POST", "/command/hire", cmdBody("a2", t, { role: "engineer" }), auth.headers)
    const ids = agentsOf(city).map((row) => asText(row["id"]))
    const first = ids[0] ?? ""
    const second = ids[1] ?? ""
    expect(first.length > 0 && second.length > 0).toBe(true)
    city["functions"] = [{ id: "workshop", level: 1n }, ...(Array.isArray(city["functions"]) ? city["functions"] : [])]
    const firstAssign = await applyLive(host.ctx, host.state, "assign", { agent_id: first, building_id: "workshop" }, auth.cityId)
    expect(firstAssign !== undefined && firstAssign.status === host.ctx.httpOk).toBe(true)
    const secondAssign = await applyLive(host.ctx, host.state, "assign", { agent_id: second, building_id: "workshop" }, auth.cityId)
    expect(secondAssign !== undefined && secondAssign.status === host.ctx.httpOk).toBe(true)
    const seated: string[] = []
    for (const row of agentsOf(city)) {
      if (asText(row["building_id"]) === "workshop") seated.push(asText(row["id"]))
    }
    expect(seated).toEqual([second])
    const displaced = agentsOf(city).find((row) => asText(row["id"]) === first)
    expect(asText(displaced?.["building_id"])).toBe("")
    for (const item of Array.isArray(city["functions"]) ? city["functions"] : []) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const row = asEngineDict(item)
      if (asText(row["id"]) !== "workshop") continue
      row["deactivated"] = 1n
    }
    const blocked = await applyLive(
      host.ctx,
      host.state,
      "assign",
      { agent_id: first, building_id: "workshop" },
      auth.cityId,
    )
    expect(blocked !== undefined).toBe(true)
    if (blocked !== undefined) expect(bodyCode(blocked.body)).toBe(codes.API_MALFORMED)
    for (const item of Array.isArray(city["functions"]) ? city["functions"] : []) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const row = asEngineDict(item)
      if (asText(row["id"]) !== "workshop") continue
      row["deactivated"] = 0n
    }
    city["functions"] = [
      { id: "ai_research_center", level: 1n },
      ...(Array.isArray(city["functions"]) ? city["functions"] : []),
    ]
    const now = asBigint(host.state["city_time"])
    if (now === 0n) host.state["city_time"] = 1n
    city["district_freeze_until"] = { NVDA: now > 0n ? now : 1n }
    const icedAssign = await applyLive(
      host.ctx,
      host.state,
      "assign",
      { agent_id: first, building_id: "ai_research_center" },
      auth.cityId,
    )
    expect(icedAssign !== undefined).toBe(true)
    if (icedAssign !== undefined) expect(bodyCode(icedAssign.body)).toBe(codes.DISTRICT_FROZEN)
  })

  it("set_objective_train_requires_target", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const cost1 = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1", "cost"]))
    const cost2 = asBigint(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "2", "cost"]))
    seedPlayerCapital(host, auth.cityId, cost1 + cost2)
    const t = asBigint(host.state["city_time"])
    await host.handle("POST", "/command/hire", cmdBody("st", t, { role: "scientist" }), auth.headers)
    await host.handle("POST", "/command/hire", cmdBody("en", t, { role: "engineer" }), auth.headers)
    const sciId = asText(agentsOf(city)[0]?.["id"])
    const engId = asText(agentsOf(city)[1]?.["id"])
    const missing = await applyLive(host.ctx, host.state, "set_objective", { agent_id: sciId, objective: "train" }, auth.cityId)
    expect(missing !== undefined).toBe(true)
    if (missing !== undefined) expect(bodyCode(missing.body)).toBe(codes.API_MALFORMED)
    const self = await applyLive(
      host.ctx,
      host.state,
      "set_objective",
      { agent_id: sciId, objective: "train", train_target: sciId },
      auth.cityId,
    )
    expect(self !== undefined).toBe(true)
    if (self !== undefined) expect(bodyCode(self.body)).toBe(codes.API_MALFORMED)
    const ghost = await applyLive(
      host.ctx,
      host.state,
      "set_objective",
      { agent_id: sciId, objective: "train", train_target: "ghost" },
      auth.cityId,
    )
    expect(ghost !== undefined).toBe(true)
    if (ghost !== undefined) expect(bodyCode(ghost.body)).toBe(codes.API_MALFORMED)
    const ok = await applyLive(
      host.ctx,
      host.state,
      "set_objective",
      { agent_id: sciId, objective: "train", train_target: engId },
      auth.cityId,
    )
    expect(ok !== undefined).toBe(true)
    if (ok !== undefined) expect(bodyCode(ok.body)).toBe("")
    expect(asText(agentsOf(city)[0]?.["train_target"])).toBe(engId)
  })

  it("live_tick_records_not_shift", async () => {
    const host = await bootHost()
    const genesis = cityOf(host, "a")
    expect("energy_stock" in genesis).toBe(true)
    expect(asBigint(genesis["energy_stock"])).toBe(0n)
    const ran = await host.stepTick(makeInputs(host.ctx.cfg, 0n))
    expect(ran.headerBytes.length > 0).toBe(true)
    for (const blob of ran.recordBytes) {
      expect(fromUtf8(blob).includes("\"agent_id\":\"shift\"")).toBe(false)
    }
  })
})

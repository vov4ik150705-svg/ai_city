import { canonical, fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { describe, expect, it } from "vitest"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "../src/values.ts"
import { bootHost, demoAuth, seedPlayerCapital } from "./harness.ts"

function bodyCode(body: Uint8Array): string {
  const parsed = parseJson(fromUtf8(body))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return ""
  return asText(asObj(parsed)["code"])
}

function cityOf(host: Awaited<ReturnType<typeof bootHost>>, cityId: string) {
  return asEngineDict(asEngineDict(host.state["cities"])[cityId])
}

function levelCost(host: Awaited<ReturnType<typeof bootHost>>, bid: string): bigint {
  const rows = walk(host.ctx.pack, ["generated", "balance", "level_cost", bid])
  if (!Array.isArray(rows) || rows[0] === undefined) return 0n
  return asBigint(rows[0])
}

function buildTime(host: Awaited<ReturnType<typeof bootHost>>, bid: string): bigint {
  const rows = walk(host.ctx.pack, ["generated", "balance", "level_build_time", bid])
  if (!Array.isArray(rows) || rows[0] === undefined) return 0n
  return asBigint(rows[0])
}

function slotCap(host: Awaited<ReturnType<typeof bootHost>>, level: bigint): bigint {
  const table = asObj(walk(host.ctx.pack, ["generated", "balance", "build_slots"]))
  return asBigint(table[level.toString()])
}

function functionRow(city: ReturnType<typeof cityOf>, bid: string): { readonly [key: string]: Json } | undefined {
  const functions = city["functions"]
  if (!Array.isArray(functions)) return undefined
  for (const item of functions) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asObj(item)
    if (asText(row["id"]) === bid) return row
  }
  return undefined
}

function placeableAt(host: Awaited<ReturnType<typeof bootHost>>, level: bigint): string[] {
  const playable = walk(host.ctx.pack, ["generated", "buildings", "buildings_playable_v1"])
  const defs = asObj(walk(host.ctx.pack, ["sections", "buildings", "buildings"]))
  const out: string[] = []
  if (!Array.isArray(playable)) return out
  for (const item of playable) {
    if (typeof item !== "string") continue
    const spec = defs[item]
    if (spec === undefined || spec === null || typeof spec !== "object" || Array.isArray(spec)) continue
    const def = asObj(spec)
    if (def["prebuilt"] === true) continue
    if (asBigint(def["city_level_req"], 1n) > level) continue
    out.push(item)
  }
  out.sort()
  return out
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

describe("W4 build activate deactivate", () => {
  it("builds workshop with pack construction time", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const cost = levelCost(host, "workshop")
    seedPlayerCapital(host, auth.cityId, cost + cost)
    const built = await command(host, auth.headers, "build", "w4-ws", { building_id: "workshop" })
    expect(built.status).toBe(host.ctx.httpOk)
    expect(bodyCode(built.body)).toBe("")
    const row = functionRow(cityOf(host, auth.cityId), "workshop")
    expect(row !== undefined).toBe(true)
    if (row === undefined) return
    expect(asBigint(row["construction"])).toBe(buildTime(host, "workshop"))
    const again = await command(host, auth.headers, "build", "w4-ws2", { building_id: "workshop" })
    expect(bodyCode(again.body)).toBe(codes.API_MALFORMED)
  })

  it("builds autonomous agent_hub and robotics_lab", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const need = levelCost(host, "agent_hub") + levelCost(host, "robotics_lab")
    seedPlayerCapital(host, auth.cityId, need)
    const hub = await command(host, auth.headers, "build", "w4-hub", { building_id: "agent_hub" })
    const lab = await command(host, auth.headers, "build", "w4-lab", { building_id: "robotics_lab" })
    expect(hub.status).toBe(host.ctx.httpOk)
    expect(lab.status).toBe(host.ctx.httpOk)
    expect(bodyCode(hub.body)).toBe("")
    expect(bodyCode(lab.body)).toBe("")
    expect(functionRow(cityOf(host, auth.cityId), "agent_hub") !== undefined).toBe(true)
    expect(functionRow(cityOf(host, auth.cityId), "robotics_lab") !== undefined).toBe(true)
  })

  it("locks energy_plant until the energy district is open", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const locked = await command(host, auth.headers, "build", "w4-plant", { building_id: "energy_plant" })
    expect(bodyCode(locked.body)).toBe(codes.DISTRICT_LOCKED)
    expect(locked.status).not.toBe(host.ctx.httpOk)
    expect(functionRow(cityOf(host, auth.cityId), "energy_plant")).toBe(undefined)
  })

  it("upgrade of an unbuilt workshop builds it", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    seedPlayerCapital(host, auth.cityId, levelCost(host, "workshop"))
    const res = await command(host, auth.headers, "upgrade", "w4-up", { building_id: "workshop" })
    expect(res.status).toBe(host.ctx.httpOk)
    expect(bodyCode(res.body)).toBe("")
    expect(asText(asObj(parseJson(fromUtf8(res.body)))["effect"])).toBe("build")
    const row = functionRow(cityOf(host, auth.cityId), "workshop")
    expect(row !== undefined).toBe(true)
    if (row === undefined) return
    expect(asBigint(row["construction"])).toBe(buildTime(host, "workshop"))
  })

  it("deactivates a built workshop and activates it again", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    seedPlayerCapital(host, auth.cityId, levelCost(host, "workshop"))
    const built = await command(host, auth.headers, "build", "w4-on", { building_id: "workshop" })
    expect(built.status).toBe(host.ctx.httpOk)
    const off = await command(host, auth.headers, "build", "w4-off", { building_id: "workshop", deactivate: true })
    expect(off.status).toBe(host.ctx.httpOk)
    expect(asBigint(asObj(parseJson(fromUtf8(off.body)))["active"])).toBe(0n)
    const rowOff = functionRow(cityOf(host, auth.cityId), "workshop")
    expect(rowOff !== undefined).toBe(true)
    if (rowOff === undefined) return
    expect(asBigint(rowOff["deactivated"])).toBe(1n)
    const on = await command(host, auth.headers, "build", "w4-back", { building_id: "workshop", active: true })
    expect(on.status).toBe(host.ctx.httpOk)
    expect(asBigint(asObj(parseJson(fromUtf8(on.body)))["active"])).toBe(1n)
    const rowOn = functionRow(cityOf(host, auth.cityId), "workshop")
    expect(rowOn !== undefined).toBe(true)
    if (rowOn === undefined) return
    expect(asBigint(rowOn["deactivated"], 0n)).toBe(0n)
  })

  it("refuses deactivation of a building that was never built", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const off = await command(host, auth.headers, "build", "w4-miss", { building_id: "workshop", deactivate: true })
    expect(off.status).not.toBe(host.ctx.httpOk)
    expect(bodyCode(off.body)).toBe(codes.API_MALFORMED)
    expect(functionRow(cityOf(host, auth.cityId), "workshop")).toBe(undefined)
  })

  it("level 1 cannot pass build_slots", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const level = asBigint(city["city_level"], 1n)
    const cap = slotCap(host, level)
    const ids = placeableAt(host, level)
    expect(BigInt(ids.length) > cap).toBe(true)
    const districts = Object.keys(asObj(walk(host.ctx.pack, ["sections", "districts", "districts"])))
    city["districts"] = districts
    const take = ids.slice(0, Number(cap) + 1)
    let need = 0n
    for (const bid of take) need += levelCost(host, bid)
    seedPlayerCapital(host, auth.cityId, need)
    let n = 0
    while (BigInt(n) < cap) {
      const bid = take[n]
      if (bid === undefined) break
      const res = await command(host, auth.headers, "build", "w4-slot-" + n.toString(), { building_id: bid })
      expect(bodyCode(res.body), bid).toBe("")
      n += 1
    }
    const extra = take[Number(cap)]
    expect(extra !== undefined).toBe(true)
    if (extra === undefined) return
    const blocked = await command(host, auth.headers, "build", "w4-slot-over", { building_id: extra })
    expect(bodyCode(blocked.body)).toBe(codes.NO_FREE_BUILD_SLOT)
    expect(functionRow(city, extra)).toBe(undefined)
  })

  it("a deactivated building still occupies its slot", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const city = cityOf(host, auth.cityId)
    const cap = slotCap(host, asBigint(city["city_level"], 1n))
    const ids = placeableAt(host, 1n)
    city["districts"] = Object.keys(asObj(walk(host.ctx.pack, ["sections", "districts", "districts"])))
    const take = ids.slice(0, Number(cap) + 1)
    let need = 0n
    for (let i = 0; i < Number(cap); i += 1) {
      const bid = take[i]
      if (bid !== undefined) need += levelCost(host, bid)
    }
    seedPlayerCapital(host, auth.cityId, need)
    let n = 0
    while (BigInt(n) < cap) {
      const bid = take[n]
      if (bid === undefined) break
      const res = await command(host, auth.headers, "build", "w4-full-" + n.toString(), { building_id: bid })
      expect(bodyCode(res.body), bid).toBe("")
      n += 1
    }
    const held = take[0]
    const extra = take[Number(cap)]
    expect(held !== undefined && extra !== undefined).toBe(true)
    if (held === undefined || extra === undefined) return
    const off = await command(host, auth.headers, "build", "w4-full-off", { building_id: held, deactivate: true })
    expect(off.status).toBe(host.ctx.httpOk)
    const blocked = await command(host, auth.headers, "build", "w4-full-next", { building_id: extra })
    expect(bodyCode(blocked.body)).toBe(codes.NO_FREE_BUILD_SLOT)
    expect(functionRow(city, extra)).toBe(undefined)
    const row = functionRow(city, held)
    expect(row !== undefined).toBe(true)
    if (row === undefined) return
    expect(asBigint(row["deactivated"])).toBe(1n)
  })

  it("assign during construction is idle, and a low city level stays a level refusal", async () => {
    const host = await bootHost()
    const auth = await demoAuth(host)
    const hire = asBigint(asObj(walk(host.ctx.pack, ["generated", "balance", "hire_cost", "1"]))["cost"])
    seedPlayerCapital(host, auth.cityId, hire + levelCost(host, "workshop") + levelCost(host, "exchange"))
    const hired = await command(host, auth.headers, "hire", "w4-hire", { role: "engineer" })
    expect(hired.status).toBe(host.ctx.httpOk)
    const built = await command(host, auth.headers, "build", "w4-site", { building_id: "workshop" })
    expect(built.status).toBe(host.ctx.httpOk)
    const agents = cityOf(host, auth.cityId)["agents"]
    const agent = Array.isArray(agents) ? agents[0] : undefined
    expect(agent !== undefined && agent !== null && typeof agent === "object").toBe(true)
    if (agent === undefined || agent === null || typeof agent !== "object" || Array.isArray(agent)) return
    const assigned = await command(host, auth.headers, "assign", "w4-asg", {
      agent_id: asText(asObj(agent)["id"]),
      building_id: "workshop",
    })
    expect(bodyCode(assigned.body)).toBe(codes.IDLE_UNDER_CONSTRUCTION)
    const low = await command(host, auth.headers, "build", "w4-ex", { building_id: "exchange" })
    expect(bodyCode(low.body)).toBe(codes.CITY_LEVEL_TOO_LOW)
  })
})

import { describe, expect, it } from "vitest"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { asBigint, asEngineDict, asObj, type Json } from "../src/values.ts"
import { bootHost, stateHeaders } from "./harness.ts"

function rowsOf(body: Uint8Array): Json[] {
  const env = asObj(parseJson(fromUtf8(body)))
  const rows = env["rows"]
  expect(Array.isArray(rows)).toBe(true)
  if (!Array.isArray(rows)) return []
  return rows
}

describe("GET /rating", () => {
  it("answers without a session and hides the demo city", async () => {
    const host = await bootHost()
    const res = await host.handle("GET", host.ctx.ratingTemplate, new Uint8Array())
    expect(res.status).toBe(host.ctx.httpOk)
    expect(rowsOf(res.body)).toEqual([])
    const statePath = host.ctx.stateTemplate.replace("{city_id}", "a")
    const denied = await host.handle("GET", statePath, new Uint8Array())
    expect(denied.status === host.ctx.httpOk).toBe(false)
    const parsed = asObj(parseJson(fromUtf8(denied.body)))
    expect(parsed["code"]).toBe("API_UNAUTHORIZED")
  })

  it("lists wallet cities in board order, one row per wallet, self stays 0", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    function put(id: string, influence: bigint, gdp: bigint, wallet: string, demo: boolean): void {
      const row = { ...proto }
      row["account_kind"] = demo ? "demo" : "wallet"
      row["demo"] = demo ? 1n : 0n
      row["influence"] = influence
      row["day_gdp"] = gdp
      row["positive_days"] = 0n
      row["live_stake"] = 0n
      row["wallet"] = wallet
      cities[id] = row
    }
    put("m", 5n, 1n, "0xabc", false)
    put("k", 5n, 9n, "0xdef", false)
    put("aa", 3n, 3n, "0x111", false)
    put("ab", 3n, 3n, "0x222", false)
    put("p", 7n, 1n, "0xaaa", false)
    put("q", 4n, 9n, "0xaaa", false)
    put("z", 99n, 99n, "0xdemo", true)
    const res = await host.handle("GET", host.ctx.ratingTemplate, new Uint8Array())
    const rows = rowsOf(res.body).map((item) => asObj(item))
    expect(rows.map((row) => row["wallet"]).join(",")).toBe("0xaaa,0xdef,0xabc,0x111,0x222")
    expect(rows.map((row) => row["rank"]).join(",")).toBe("1,2,3,4,5")
    expect(rows.every((row) => row["self"] === 0n)).toBe(true)
    expect(asBigint(rows[0]?.["influence"])).toBe(7n)
    expect(rows.some((row) => row["wallet"] === "0xdemo")).toBe(false)
    const headers = await stateHeaders(host, "k")
    const statePath = host.ctx.stateTemplate.replace("{city_id}", "k")
    const authed = await host.handle("GET", statePath, new Uint8Array(), headers)
    const sections = asObj(asObj(parseJson(fromUtf8(authed.body)))["sections"])
    const board = asObj(sections["seasons.influence_rank"])["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    expect(board.map((item) => asObj(item)["wallet"]).join(",")).toBe("0xaaa,0xdef,0xabc,0x111,0x222")
    const viewer = board.map((item) => asObj(item)).find((row) => row["wallet"] === "0xdef")
    expect(viewer?.["self"]).toBe(1n)
  })

  it("does not treat a longer path as the board", async () => {
    const host = await bootHost()
    const res = await host.handle("GET", host.ctx.ratingTemplate + "/extra", new Uint8Array())
    const parsed = asObj(parseJson(fromUtf8(res.body)))
    expect(parsed["code"]).toBe("API_MALFORMED")
  })
})

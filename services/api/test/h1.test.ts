import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { gdpDay, qualifyDays } from "@corporator/engine"
import { applyTemplate } from "../src/pack_ctx.ts"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "../src/values.ts"
import { bootHost, stateHeaders } from "./harness.ts"

async function authedGet(host: Awaited<ReturnType<typeof bootHost>>, path: string) {
  const marker = "/city/"
  const at = path.indexOf(marker)
  const rest = at < 0 ? "" : path.slice(at + marker.length)
  const cut = rest.indexOf("/")
  const cityId = cut < 0 ? rest : rest.slice(0, cut)
  const headers = await stateHeaders(host, cityId)
  return host.handle("GET", path, new Uint8Array(), headers)
}

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function sectionsOf(body: Uint8Array): { readonly [key: string]: Json } {
  const parsed = parseJson(fromUtf8(body))
  const env = asObj(parsed)
  const sections = env["sections"]
  if (sections === undefined || sections === null || typeof sections !== "object" || Array.isArray(sections)) {
    return {}
  }
  return asObj(sections)
}

function districtEffOf(sections: { readonly [key: string]: Json }, id: string): { readonly [key: string]: Json } {
  const bag = asObj(sections["oracle.district_efficiency"])
  const rows = bag["rows"]
  if (!Array.isArray(rows)) return {}
  for (const item of rows) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asObj(item)
    if (asText(row["id"]) === id) return row
  }
  return {}
}

describe("H1 state projection", () => {
  it("fills_aggregates_from_engine", async () => {
    const host = await bootHost()
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["day_gdp"] = 40n
    city["day_valid_ticks"] = 5n
    const path = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const res = await authedGet(host, path)
    expect(res.status).toBe(host.ctx.httpOk)
    const sections = sectionsOf(res.body)
    expect(sections["aggregate.gdp"]).toBe(gdpDay([40n]))
    expect(typeof sections["aggregate.happiness"]).toBe("bigint")
    expect(sections["aggregate.happiness"]).toBe(asBigint(host.ctx.cfg["bps"]))
    expect(sections["aggregate.stability"]).toBe((5n * asBigint(host.ctx.cfg["bps"])) / asBigint(host.ctx.cfg["ticks_day"]))
    expect("happiness_bps" in city).toBe(false)
    expect(asBigint(host.state["fund"], 0n)).toBe(0n)
    expect(asBigint(host.state["vault_corp"], 0n)).toBe(0n)
    expect(asBigint(host.state["capital_outstanding"], 0n)).toBe(0n)
  })

  it("e2_snapshot_publishes_boost_and_days_left", async () => {
    const host = await bootHost()
    const path = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const sections = sectionsOf((await authedGet(host, path)).body)
    expect(sections["aggregate.payroll_boost_bps"]).toBe(asBigint(host.ctx.cfg["payroll_boost_launch_bps"]))
    expect(sections["aggregate.payroll_boost_days_left"]).toBe(asBigint(host.ctx.cfg["payroll_boost_launch_city_days"]))
    host.state["tick_index"] =
      asBigint(host.ctx.cfg["payroll_boost_launch_city_days"]) * asBigint(host.ctx.cfg["ticks_day"])
    const after = sectionsOf((await authedGet(host, path)).body)
    expect(after["aggregate.payroll_boost_bps"]).toBe(asBigint(host.ctx.cfg["payroll_boost_bps"]))
    expect(after["aggregate.payroll_boost_days_left"]).toBe(0n)
  })

  it("projects_functions_agents_and_sticky_level", async () => {
    const host = await bootHost()
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["city_level"] = 4n
    city["idle"] = "IDLE_NO_ENERGY"
    city["functions"] = [
      { id: "workshop", level: 1n },
      { id: "bank", level: 1n, deactivated: 1n },
      { id: "data_center", level: 1n, frozen: 1n },
      { id: "robotics_lab", level: 1n, construction: 2n },
    ]
    city["agents"] = [{ id: "h1", role: "engineer" }]
    const path = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const sections = sectionsOf((await authedGet(host, path)).body)
    const buildings = asObj(sections["tick.building_level"])
    const fns = buildings["rows"]
    expect(Array.isArray(fns)).toBe(true)
    if (!Array.isArray(fns)) return
    expect(fns).toEqual([
      { id: "workshop", nameKey: "UI_BLD_WORKSHOP", statusKey: "IDLE_NO_AGENT", level: 1n, worker: "", task: "" },
      { id: "bank", nameKey: "UI_BLD_BANK", statusKey: "UI_DEACTIVATED", level: 1n, worker: "", task: "" },
      { id: "data_center", nameKey: "UI_BLD_DATA_CENTER", statusKey: "UI_FROZEN", level: 1n, worker: "", task: "" },
      { id: "robotics_lab", nameKey: "UI_BLD_ROBOTICS_LAB", statusKey: "IDLE_UNDER_CONSTRUCTION", construction: 2n, level: 1n, worker: "", task: "" },
    ])
    expect(buildings["city_level"]).toBe(4n)
    const agents = asObj(sections["tick.agent_state"])["rows"]
    expect(agents).toEqual([
      {
        id: "h1",
        idleKey: "IDLE_NO_AGENT",
        role: "engineer",
        buildingId: "",
        objective: "",
        level: 1n,
        xp: 0n,
        traits: [],
      },
    ])
    city["payout"] = 7n
    city["request"] = 10n
    asEngineDict(host.state["acc"])["payroll_paid"] = 99n
    city["agents"] = [{ id: "h1", role: "engineer", building_id: "workshop", idle: "IDLE_NO_ENERGY", objective: "produce" }]
    const seated = sectionsOf((await authedGet(host, path)).body)
    const seatedBuildings = asObj(seated["tick.building_level"])
    expect(seatedBuildings["payroll_paid"]).toBe(7n)
    expect(seatedBuildings["payroll_requested"]).toBe(10n)
    const seatedFns = seatedBuildings["rows"]
    expect(Array.isArray(seatedFns)).toBe(true)
    if (Array.isArray(seatedFns)) {
      expect(asObj(seatedFns[0] ?? {})["statusKey"]).toBe("IDLE_NO_ENERGY")
      expect(asObj(seatedFns[0] ?? {})["worker"]).toBe("h1")
    }
    const seatedAgents = asObj(seated["tick.agent_state"])["rows"]
    expect(Array.isArray(seatedAgents)).toBe(true)
    if (Array.isArray(seatedAgents)) {
      expect(asObj(seatedAgents[0] ?? {})["idleKey"]).toBe("IDLE_NO_ENERGY")
    }
    city["districts"] = ["compute"]
    city["unstake_pending"] = [{ ticker: "NVDA", amount: 1n, ready_at: 200n }]
    city["district_freeze_until"] = {}
    host.state["city_time"] = 10n
    const pendingOnly = districtEffOf(sectionsOf((await authedGet(host, path)).body), "compute")
    expect(pendingOnly["grace"]).toBe(0n)
    expect(pendingOnly["frozen"]).toBe(0n)
    city["district_freeze_until"] = { NVDA: 200n }
    const during = districtEffOf(sectionsOf((await authedGet(host, path)).body), "compute")
    expect(during["grace"]).toBe(1n)
    expect(during["frozen"]).toBe(0n)
    host.state["city_time"] = 200n
    const iced = districtEffOf(sectionsOf((await authedGet(host, path)).body), "compute")
    expect(iced["grace"]).toBe(0n)
    expect(iced["frozen"]).toBe(1n)
  })

  it("leaves_chain_wallet_empty_and_quote_not_live", async () => {
    const host = await bootHost()
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["corp_held"] = 9n
    const path = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const sections = sectionsOf((await authedGet(host, path)).body)
    const chain = sections["wallet.chain"]
    const corp = sections["wallet.corp_balance"]
    expect(chain !== null && typeof chain === "object" && !Array.isArray(chain)).toBe(true)
    expect(Object.keys(asObj(chain)).length).toBe(0)
    expect(corp !== null && typeof corp === "object" && !Array.isArray(corp)).toBe(true)
    expect(Object.keys(asObj(corp)).length).toBe(0)
    expect(corp === 0n).toBe(false)
    const quote = asObj(sections["oracle.stock_price"])
    expect(quote["live"]).toBe(false)
    expect("age_ms" in quote).toBe(false)
    expect("corp_eth" in quote).toBe(false)
    expect("eth_usd" in quote).toBe(false)
    const src = readFileSync(join(repo, "services/api/src/project.ts"), "utf8")
    expect(src.includes("Date.now")).toBe(false)
    expect(src.includes("performance.now")).toBe(false)
  })

  it("demo_city_has_no_invented_rank_one", async () => {
    const host = await bootHost()
    const city = asEngineDict(asEngineDict(host.state["cities"])["a"])
    city["influence"] = 99n
    city["positive_days"] = 99n
    city["live_stake"] = 1n
    const path = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const rank = asObj(sectionsOf((await authedGet(host, path)).body)["seasons.influence_rank"])
    expect(rank["qualified"]).toBe(0n)
    expect("rank" in rank).toBe(false)
    expect(rank["influence"]).toBe(99n)
    expect(Array.isArray(rank["board"])).toBe(true)
    expect(rank["board"]).toEqual([])
    expect(typeof rank["season_label"]).toBe("string")
    expect(typeof rank["period_label"]).toBe("string")
  })

  it("one_slot_per_wallet_and_city_id_tiebreak", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    expect(need > 0n).toBe(true)
    function walletCity(id: string, influence: bigint, wallet: string): void {
      const row = { ...proto }
      row["account_kind"] = "wallet"
      row["demo"] = 0n
      row["influence"] = influence
      row["positive_days"] = need
      row["live_stake"] = 1n
      row["wallet"] = wallet
      cities[id] = row
    }
    walletCity("b", 10n, "w1")
    walletCity("c", 8n, "w1")
    walletCity("d", 10n, "w2")
    walletCity("e", 99n, "w3")
    asEngineDict(cities["e"])["positive_days"] = need - 1n
    host.state["treasury_leaderboard_eth"] = 1_000_000n
    const pathB = applyTemplate(host.ctx.stateTemplate, "city_id", "b")
    const pathC = applyTemplate(host.ctx.stateTemplate, "city_id", "c")
    const pathD = applyTemplate(host.ctx.stateTemplate, "city_id", "d")
    const pathE = applyTemplate(host.ctx.stateTemplate, "city_id", "e")
    const rankB = asObj(sectionsOf((await authedGet(host, pathB)).body)["seasons.influence_rank"])
    const rankC = asObj(sectionsOf((await authedGet(host, pathC)).body)["seasons.influence_rank"])
    const rankD = asObj(sectionsOf((await authedGet(host, pathD)).body)["seasons.influence_rank"])
    const rankE = asObj(sectionsOf((await authedGet(host, pathE)).body)["seasons.influence_rank"])
    expect(rankB["qualified"]).toBe(1n)
    expect(rankC["qualified"]).toBe(1n)
    expect(rankB["rank"]).toBe(1n)
    expect(rankD["rank"]).toBe(2n)
    expect(rankC["rank"]).toBe(1n)
    expect(rankE["qualified"]).toBe(0n)
    expect("rank" in rankE).toBe(false)
    const boardB = rankB["board"]
    expect(Array.isArray(boardB)).toBe(true)
    if (!Array.isArray(boardB)) return
    expect(boardB.map((row) => asObj(row)["wallet"]).join(",")).toBe("w3,w1,w2")
    expect(boardB.map((row) => asObj(row)["rank"]).join(",")).toBe("1,2,3")
    expect(asObj(boardB[0] ?? {})["qualified"]).toBe(0n)
    expect(asObj(boardB[1] ?? {})["self"]).toBe(1n)
    expect(asObj(boardB[2] ?? {})["self"]).toBe(0n)
    const prizeB = rankB["prize_board"]
    expect(Array.isArray(prizeB)).toBe(true)
    if (!Array.isArray(prizeB)) return
    expect(prizeB.map((row) => asObj(row)["wallet"]).join(",")).toBe("w1,w2")
    expect(asObj(prizeB[0] ?? {})["payout"] > asObj(prizeB[1] ?? {})["payout"]).toBe(true)
    expect(asObj(prizeB[0] ?? {})["self"]).toBe(1n)
  })

  it("live_board_lists_unqualified_wallet_cities_without_top_n", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    function walletCity(id: string, influence: bigint, gdp: bigint, wallet: string): void {
      const row = { ...proto }
      row["account_kind"] = "wallet"
      row["demo"] = 0n
      row["influence"] = influence
      row["day_gdp"] = gdp
      row["positive_days"] = 0n
      row["live_stake"] = 0n
      row["wallet"] = wallet
      cities[id] = row
    }
    walletCity("c1", 0n, 5n, "w1")
    walletCity("c2", 0n, 9n, "w2")
    walletCity("c3", 0n, 1n, "w3")
    walletCity("c4", 0n, 4n, "w4")
    walletCity("c5", 0n, 8n, "w5")
    walletCity("c6", 0n, 2n, "w6")
    walletCity("c7", 0n, 7n, "w7")
    walletCity("c8", 0n, 3n, "w8")
    walletCity("c9", 0n, 6n, "w9")
    walletCity("c10", 0n, 0n, "w10")
    walletCity("c11", 0n, 11n, "w11")
    const path = applyTemplate(host.ctx.stateTemplate, "city_id", "c1")
    const rank = asObj(sectionsOf((await authedGet(host, path)).body)["seasons.influence_rank"])
    expect(rank["qualified"]).toBe(0n)
    expect("rank" in rank).toBe(false)
    const board = rank["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    expect(board.length).toBe(11)
    expect(asObj(board[0] ?? {})["wallet"]).toBe("w11")
    expect(asObj(board[1] ?? {})["wallet"]).toBe("w2")
    expect(asObj(board[10] ?? {})["wallet"]).toBe("w10")
    expect(asObj(board[0] ?? {})["self"]).toBe(0n)
    expect(asObj(board[board.length - 1] ?? {})["gdp"]).toBe(0n)
    const prize = rank["prize_board"]
    expect(Array.isArray(prize)).toBe(true)
    if (Array.isArray(prize)) expect(prize.length).toBe(0)
  })

  it("demo_viewer_sees_public_board_but_is_not_listed", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const row = { ...proto }
    row["account_kind"] = "wallet"
    row["demo"] = 0n
    row["influence"] = 4n
    row["day_gdp"] = 8n
    row["positive_days"] = 0n
    row["live_stake"] = 0n
    row["wallet"] = "w-live"
    cities["b"] = row
    const path = applyTemplate(host.ctx.stateTemplate, "city_id", "a")
    const rank = asObj(sectionsOf((await authedGet(host, path)).body)["seasons.influence_rank"])
    expect(rank["qualified"]).toBe(0n)
    expect("rank" in rank).toBe(false)
    const board = rank["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    expect(board.length).toBe(1)
    expect(asObj(board[0] ?? {})["wallet"]).toBe("w-live")
    expect(asObj(board[0] ?? {})["self"]).toBe(0n)
  })

  it("prize_rank_ignores_gdp_tiebreak_used_by_live_board", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    function walletCity(id: string, gdp: bigint, wallet: string): void {
      const city = { ...proto }
      city["account_kind"] = "wallet"
      city["demo"] = 0n
      city["influence"] = 10n
      city["day_gdp"] = gdp
      city["positive_days"] = need
      city["live_stake"] = 1n
      city["wallet"] = wallet
      cities[id] = city
    }
    walletCity("b", 1n, "w1")
    walletCity("d", 99n, "w2")
    const rankB = asObj(
      sectionsOf((await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "b"))).body)[
        "seasons.influence_rank"
      ],
    )
    const rankD = asObj(
      sectionsOf((await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "d"))).body)[
        "seasons.influence_rank"
      ],
    )
    expect(rankB["rank"]).toBe(1n)
    expect(rankD["rank"]).toBe(2n)
    const board = rankB["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    expect(board.map((row) => asObj(row)["wallet"]).join(",")).toBe("w2,w1")
  })

  it("live_board_source_does_not_cap_at_prize_top_n", () => {
    const src = readFileSync(join(repo, "services/api/src/project_rank.ts"), "utf8")
    expect(src.includes("prize_top_n")).toBe(false)
    expect(src.includes("zipf")).toBe(false)
    const projectSrc = readFileSync(join(repo, "services/api/src/project.ts"), "utf8")
    expect(projectSrc.includes("prize_board")).toBe(true)
    expect(projectSrc.includes("zipfPayout")).toBe(true)
  })

  it("adversarial_live_board_slot_rules", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    function walletCity(id: string, fields: { [key: string]: unknown }): void {
      const city = { ...proto }
      city["account_kind"] = "wallet"
      city["demo"] = 0n
      city["positive_days"] = need
      city["live_stake"] = 1n
      for (const key of Object.keys(fields)) city[key] = fields[key]
      cities[id] = city
    }
    walletCity("b", { influence: 10n, day_gdp: 1n, wallet: "w1" })
    walletCity("z", { influence: 10n, day_gdp: 99n, wallet: "w1" })
    walletCity("ghost", { influence: 50n, day_gdp: 50n, wallet: "" })
    const lower = "0x" + "aa".repeat(20)
    const upper = "0x" + "AA".repeat(20)
    walletCity("lo", { influence: 3n, day_gdp: 1n, wallet: lower })
    walletCity("hi", { influence: 4n, day_gdp: 2n, wallet: upper })
    const rankB = asObj(
      sectionsOf((await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "b"))).body)[
        "seasons.influence_rank"
      ],
    )
    const rankZ = asObj(
      sectionsOf((await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "z"))).body)[
        "seasons.influence_rank"
      ],
    )
    expect(rankB["rank"]).toBe(1n)
    expect(rankZ["rank"]).toBe(1n)
    const board = rankB["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    const wallets = board.map((row) => asObj(row)["wallet"])
    expect(wallets.includes("ghost")).toBe(false)
    expect(wallets.includes("b")).toBe(false)
    expect(wallets.filter((w) => w === "w1").length).toBe(1)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === "w1") ?? {})["gdp"]).toBe(1n)
    const addr = "0x" + "aa".repeat(20)
    expect(wallets.filter((w) => w === addr).length).toBe(1)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === addr) ?? {})["influence"]).toBe(4n)
  })

  it("adversarial_live_board_second_pass", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    function walletCity(id: string, fields: { [key: string]: unknown }): void {
      const city = { ...proto }
      city["account_kind"] = "wallet"
      city["demo"] = 0n
      city["positive_days"] = need
      city["live_stake"] = 1n
      for (const key of Object.keys(fields)) city[key] = fields[key]
      cities[id] = city
    }
    walletCity("qb", { influence: 5n, day_gdp: 1n, wallet: "wq" })
    walletCity("qz", { influence: 100n, day_gdp: 9n, positive_days: 0n, live_stake: 0n, wallet: "wq" })
    walletCity("listed", { influence: 1n, wallet: "spoof" })
    const spoof = { ...proto }
    spoof["account_kind"] = "wallet"
    spoof["demo"] = 0n
    spoof["wallet"] = ""
    spoof["influence"] = 0n
    cities["spoof"] = spoof
    const hex = "bb".repeat(20)
    walletCity("h1", { influence: 2n, wallet: hex })
    walletCity("h2", { influence: 1n, wallet: "0x" + hex })
    walletCity("dm", { influence: 999n, wallet: "w-demo", demo: 1n, account_kind: "wallet" })
    walletCity("bad", { influence: true, wallet: "w-bad" })
    const pathQb = applyTemplate(host.ctx.stateTemplate, "city_id", "qb")
    const resQb = await authedGet(host, pathQb)
    expect(resQb.status).toBe(host.ctx.httpOk)
    const rankQb = asObj(sectionsOf(resQb.body)["seasons.influence_rank"])
    expect(rankQb["qualified"]).toBe(1n)
    expect(rankQb["rank"]).toBe(1n)
    const board = rankQb["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    const wallets = board.map((row) => asObj(row)["wallet"])
    const wq = asObj(board.find((row) => asObj(row)["wallet"] === "wq") ?? {})
    expect(wq["influence"]).toBe(100n)
    expect(wq["qualified"]).toBe(0n)
    expect(wallets.includes("w-demo")).toBe(false)
    expect(wallets.includes("w-bad")).toBe(false)
    const merged = "0x" + hex
    expect(wallets.filter((w) => w === merged).length).toBe(1)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === merged) ?? {})["influence"]).toBe(2n)
    const rankSpoof = asObj(
      sectionsOf((await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "spoof"))).body)[
        "seasons.influence_rank"
      ],
    )
    const spoofBoard = rankSpoof["board"]
    expect(Array.isArray(spoofBoard)).toBe(true)
    if (!Array.isArray(spoofBoard)) return
    expect(asObj(spoofBoard.find((row) => asObj(row)["wallet"] === "spoof") ?? {})["self"]).toBe(0n)
  })

  it("adversarial_live_board_third_pass", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    function walletCity(id: string, fields: { [key: string]: unknown }): void {
      const city = { ...proto }
      city["account_kind"] = "wallet"
      city["demo"] = 0n
      city["positive_days"] = need
      city["live_stake"] = 1n
      for (const key of Object.keys(fields)) city[key] = fields[key]
      cities[id] = city
    }
    const addr = "0x" + "cc".repeat(20)
    walletCity("p1", { influence: 7n, wallet: ` ${addr}` })
    walletCity("p2", { influence: 2n, wallet: `${addr}\n` })
    walletCity("p3", { influence: 1n, wallet: addr.toUpperCase() })
    walletCity("spaces", { influence: 80n, wallet: "   " })
    walletCity("ok", { influence: 3n, wallet: "w-ok" })
    walletCity("broken", { influence: true, wallet: "w-broken" })
    const resBroken = await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "broken"))
    expect(resBroken.status).toBe(host.ctx.httpOk)
    const rankBroken = asObj(sectionsOf(resBroken.body)["seasons.influence_rank"])
    const boardBroken = rankBroken["board"]
    expect(Array.isArray(boardBroken)).toBe(true)
    if (!Array.isArray(boardBroken)) return
    const wallets = boardBroken.map((row) => asObj(row)["wallet"])
    expect(wallets.includes("w-ok")).toBe(true)
    expect(wallets.includes("w-broken")).toBe(false)
    expect(wallets.includes("   ")).toBe(false)
    expect(wallets.filter((w) => w === addr).length).toBe(1)
    expect(asObj(boardBroken.find((row) => asObj(row)["wallet"] === addr) ?? {})["influence"]).toBe(7n)
    const resP1 = asObj(
      sectionsOf((await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "p1"))).body)[
        "seasons.influence_rank"
      ],
    )
    const p1Board = resP1["board"]
    expect(Array.isArray(p1Board)).toBe(true)
    if (!Array.isArray(p1Board)) return
    expect(asObj(p1Board.find((row) => asObj(row)["wallet"] === addr) ?? {})["self"]).toBe(1n)
  })

  it("adversarial_live_board_fourth_pass", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    function walletCity(id: string, fields: { [key: string]: unknown }): void {
      const city = { ...proto }
      city["account_kind"] = "wallet"
      city["demo"] = 0n
      city["positive_days"] = need
      city["live_stake"] = 1n
      for (const key of Object.keys(fields)) city[key] = fields[key]
      cities[id] = city
    }
    const addr = "0x" + "dd".repeat(20)
    walletCity(addr, { influence: 100n, day_gdp: 50n, wallet: "" })
    walletCity("b", { influence: 10n, day_gdp: 1n, wallet: addr })
    walletCity("kind-demo", { influence: 500n, wallet: "w-kind-demo", account_kind: "demo", demo: 0n })
    const resB = await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "b"))
    expect(resB.status).toBe(host.ctx.httpOk)
    const rankB = asObj(sectionsOf(resB.body)["seasons.influence_rank"])
    const board = rankB["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    const wallets = board.map((row) => asObj(row)["wallet"])
    expect(wallets.filter((w) => w === addr).length).toBe(1)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === addr) ?? {})["influence"]).toBe(10n)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === addr) ?? {})["self"]).toBe(1n)
    expect(wallets.includes("w-kind-demo")).toBe(false)
    expect(rankB["rank"]).toBe(1n)
  })

  it("adversarial_live_board_fifth_pass", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    function walletCity(id: string, fields: { [key: string]: unknown }): void {
      const city = { ...proto }
      city["account_kind"] = "wallet"
      city["demo"] = 0n
      city["positive_days"] = need
      city["live_stake"] = 1n
      for (const key of Object.keys(fields)) city[key] = fields[key]
      cities[id] = city
    }
    const addr = "0x" + "ee".repeat(20)
    let inner = "0x"
    for (let i = 0; i < 20; i++) inner += "ee "
    inner = inner.trim()
    walletCity("s1", { influence: 6n, wallet: inner })
    walletCity("s2", { influence: 2n, wallet: addr })
    walletCity("g1", { influence: 80n, wallet: "" })
    walletCity("lit", { influence: 3n, wallet: "city:g1" })
    walletCity("low", { influence: 1n, wallet: "w-twin" })
    walletCity("high", { influence: 9n, wallet: "w-twin" })
    const resLow = await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "low"))
    expect(resLow.status).toBe(host.ctx.httpOk)
    const rankLow = asObj(sectionsOf(resLow.body)["seasons.influence_rank"])
    const rankHigh = asObj(
      sectionsOf((await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "high"))).body)[
        "seasons.influence_rank"
      ],
    )
    expect(rankLow["rank"]).toBe(1n)
    expect(rankHigh["rank"]).toBe(1n)
    const board = rankLow["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    const wallets = board.map((row) => asObj(row)["wallet"])
    expect(wallets.filter((w) => w === addr).length).toBe(1)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === addr) ?? {})["influence"]).toBe(6n)
    expect(wallets.includes("city:g1")).toBe(true)
    expect(wallets.includes("g1")).toBe(false)
    expect(wallets.filter((w) => w === "w-twin").length).toBe(1)
  })

  it("adversarial_live_board_sixth_pass", async () => {
    const host = await bootHost()
    const cities = asEngineDict(host.state["cities"])
    const proto = asEngineDict(cities["a"])
    const data = asEngineDict(asObj(host.ctx.pack)["sections"])
    const alpha = asBigint(walk(host.ctx.pack, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"]))
    const need = qualifyDays(data, alpha)
    function walletCity(id: string, fields: { [key: string]: unknown }): void {
      const city = { ...proto }
      city["account_kind"] = "wallet"
      city["demo"] = 0n
      city["positive_days"] = need
      city["live_stake"] = 1n
      for (const key of Object.keys(fields)) city[key] = fields[key]
      cities[id] = city
    }
    const addr = "0x" + "12".repeat(20)
    const nbsp = "0x" + "12".repeat(10) + "\u00a0" + "12".repeat(10)
    walletCity("n1", { influence: 8n, wallet: nbsp })
    walletCity("n2", { influence: 2n, wallet: addr })
    const res = await authedGet(host, applyTemplate(host.ctx.stateTemplate, "city_id", "n2"))
    expect(res.status).toBe(host.ctx.httpOk)
    const rank = asObj(sectionsOf(res.body)["seasons.influence_rank"])
    const board = rank["board"]
    expect(Array.isArray(board)).toBe(true)
    if (!Array.isArray(board)) return
    const wallets = board.map((row) => asObj(row)["wallet"])
    expect(wallets.filter((w) => w === addr).length).toBe(1)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === addr) ?? {})["influence"]).toBe(8n)
    expect(asObj(board.find((row) => asObj(row)["wallet"] === addr) ?? {})["self"]).toBe(1n)
  })
})

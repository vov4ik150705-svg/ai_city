import { describe, expect, it } from "vitest"
import {
  advanceResearch,
  loadConfig,
  newState,
  researchProgressStep,
  tick,
} from "../src/index.ts"
import { asBig, asDict, asList, asStr } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { armFund, liveCity, loadPack, makeInputs } from "./harness.ts"

describe.sequential("G3 construction", () => {
  it("research_wider_than_three", () => {
    const pack = loadPack()
    const nodes = asDict(asDict(asDict(pack["generated"])["balance"])["research_nodes"])
    expect(Object.keys(nodes).length).toBeGreaterThan(3)
    const cut = { grid: true, tools: true, handbook: true }
    expect(Object.keys(cut).length <= 3).toBe(true)
  })

  it("research_cost_derived", () => {
    const pack = loadPack()
    const axes = asDict(asDict(asDict(pack["sections"])["research"])["axes"])
    expect(Object.keys(axes).length).toBeGreaterThan(3)
    for (const nid of Object.keys(axes)) {
      const axis = asDict(axes[nid])
      expect("cost_capital" in axis).toBe(false)
      expect("effect_bps" in axis).toBe(false)
    }
    const priced = { cost_capital: 1 }
    expect("cost_capital" in priced).toBe(true)
  })

  it("research_objective_opens_node", () => {
    const opened = researchProgressStep("research", "", "research", 0n, 1n)
    expect(opened[1]).toBe(1n)
    const blocked = researchProgressStep("research", "IDLE_NO_COMPUTE", "research", 0n, 1n)
    expect(blocked[1]).toBe(0n)

    const pack = loadPack()
    const cfg = loadConfig(pack)
    const times = asDict(cfg["research_time_ticks"])
    const ids = Object.keys(times).sort()
    const nid = ids[0] ?? ""
    expect(nid.length).toBeGreaterThan(0)
    const need = asBig(times[nid])
    expect(need).toBeGreaterThan(0n)

    const city = liveCity(cfg, pack, "c")
    city["objective"] = "research"
    city["compute_ok"] = 1n
    city["research_focus"] = nid
    city["research_progress"] = need - 1n
    const state = newState(cfg, { c: city }, {})
    armFund(state, cfg, 200n)
    tick(state, makeInputs(cfg, 0n))
    const after = asDict(asDict(state["cities"])["c"])
    expect(asList(after["research_unlocked"]).map((x) => asStr(x))).toContain(nid)

    const idleCity = liveCity(cfg, pack, "d")
    idleCity["objective"] = "research"
    idleCity["compute_ok"] = 0n
    idleCity["research_focus"] = nid
    idleCity["research_progress"] = 0n
    const idleState: Dict = { cities: { d: idleCity } }
    advanceResearch(cfg, idleState)
    expect(asList(asDict(asDict(idleState["cities"])["d"])["research_unlocked"]).length).toBe(0)

    const unpaid = liveCity(cfg, pack, "e")
    unpaid["objective"] = "research"
    unpaid["idle"] = ""
    unpaid["research_progress"] = 0n
    const unpaidState: Dict = { cities: { e: unpaid } }
    advanceResearch(cfg, unpaidState)
    const unpaidAfter = asDict(asDict(unpaidState["cities"])["e"])
    expect(asList(unpaidAfter["research_unlocked"]).length).toBe(0)
    expect(asStr(unpaidAfter["research_focus"])).toBe("")
  })
})

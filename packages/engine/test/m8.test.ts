import { describe, expect, it } from "vitest"
import {
  agentLevelMultBps,
  bytesToHex,
  cityClock,
  loadConfig,
  applySpend,
  mintFromBacking,
  newState,
  plantPrebuilt,
  shiftSeedHex,
  spawnCity,
  tick,
  constructionTicks,
  scaleByModifierKey,
} from "../src/index.ts"
import { asBig, asDict, asList, asStr } from "../src/values.ts"
import type { Dict } from "../src/values.ts"
import { armFund, liveCity, loadPack, loadVector, makeInputs, runTickVector } from "./harness.ts"

function slotMult(cfg: Dict): bigint {
  return agentLevelMultBps(1n, asBig(cfg["agent_level_gain_bps"]), asBig(cfg["bps"]))
}

function agentRow(
  cfg: Dict,
  id: string,
  role: string,
  building: string,
  objective: string,
  extra: Dict = {},
): Dict {
  return {
    id,
    role,
    building_id: building,
    objective,
    level: 1n,
    xp: 0n,
    level_mult_bps: slotMult(cfg),
    traits: [],
    ...extra,
  }
}

function tickCity(cfg: Dict, city: Dict, idx: bigint = 0n): { readonly state: Dict; readonly recs: Dict[] } {
  const state = newState(cfg, { a: city }, {})
  armFund(state, cfg)
  const stepped = tick(state, makeInputs(cfg, idx, { city_id: "a" }))
  return { state: stepped[0], recs: [...stepped[1]] }
}

function recOf(recs: readonly Dict[], agentId: string): Dict | undefined {
  return recs.find((r) => asStr(r["agent_id"]) === agentId)
}

function agentOfCity(city: Dict, id: string): Dict | undefined {
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asDict(raw)
    if (asStr(row["id"]) === id) return row
  }
  return undefined
}

function closedBankTick(cfg: Dict): bigint {
  const closed = asBig(cfg["bank_closed_weekday"])
  const openH = asBig(cfg["bank_open_hour"])
  const closeH = asBig(cfg["bank_close_hour"])
  let i = 0n
  while (i < 48n) {
    const clock = cityClock(cfg, i)
    if (clock[2] === closed) return i
    if (clock[1] < openH || clock[1] >= closeH) return i
    i += 1n
  }
  return 0n
}

function officeClosedTick(cfg: Dict): bigint {
  const sch = asDict(asDict(cfg["schedules"])["office"])
  const openH = asBig(sch["open_hour"])
  const closeH = asBig(sch["close_hour"])
  const closed: bigint[] = []
  for (const raw of asList(sch["closed_weekdays"])) {
    closed.push(asBig(raw))
  }
  let i = 0n
  while (i < 48n) {
    const clock = cityClock(cfg, i)
    if (closed.includes(clock[2]) || clock[1] < openH || clock[1] >= closeH) return i
    i += 1n
  }
  return 0n
}

function retailOpenTick(cfg: Dict): bigint {
  const sch = asDict(asDict(cfg["schedules"])["retail"])
  const openH = asBig(sch["open_hour"])
  const closeH = asBig(sch["close_hour"])
  let i = 0n
  while (i < 48n) {
    const clock = cityClock(cfg, i)
    if (clock[1] >= openH && clock[1] < closeH) return i
    i += 1n
  }
  return 0n
}

describe("M8 slotted tick", () => {
  it("slotted_tick_pays_agent_not_shift", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const paid = liveCity(cfg, pack)
    paid["functions"] = [{ id: "workshop", level: 1n }]
    paid["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    const paidTick = tickCity(cfg, paid)
    expect(paidTick.recs.map((r) => asStr(r["agent_id"])).includes("shift")).toBe(false)
    const eng = recOf(paidTick.recs, "e1")
    expect(eng !== undefined).toBe(true)
    if (eng !== undefined) {
      expect(asBig(eng["output"]) > 0n).toBe(true)
      expect(asStr(eng["reason"])).toBe("")
      expect(asStr(eng["building_id"])).toBe("workshop")
      expect(asStr(eng["seed"])).toBe(shiftSeedHex("a", 0n, "e1"))
    }
    const empty = liveCity(cfg, pack)
    empty["functions"] = [{ id: "workshop", level: 1n }]
    empty["agents"] = []
    const emptyTick = tickCity(cfg, empty)
    expect(emptyTick.recs.length).toBe(1)
    expect(asStr(emptyTick.recs[0]?.["agent_id"])).toBe("")
    expect(asStr(emptyTick.recs[0]?.["reason"])).toBe(asStr(cfg["idle_agent"]))
    expect(asBig(emptyTick.recs[0]?.["output"])).toBe(0n)
    const wrong = liveCity(cfg, pack)
    wrong["functions"] = [{ id: "workshop", level: 1n }]
    wrong["agents"] = [agentRow(cfg, "t1", "trader", "workshop", "desk")]
    const wrongTick = tickCity(cfg, wrong)
    const trader = recOf(wrongTick.recs, "t1")
    expect(trader !== undefined).toBe(true)
    if (trader !== undefined) {
      expect(asStr(trader["reason"])).toBe(asStr(cfg["idle_wrong_role"]))
      expect(asBig(trader["output"])).toBe(0n)
    }
    const dup = liveCity(cfg, pack)
    dup["functions"] = [
      { id: "workshop", level: 1n },
      { id: "workshop", level: 1n },
    ]
    dup["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    const dupTick = tickCity(cfg, dup)
    const dupCity = asDict(asDict(dupTick.state["cities"])["a"])
    expect(asList(dupCity["_slot_rows"]).length).toBe(1)
    expect(asBig(dupCity["request"])).toBe(asBig(asDict(asDict(paidTick.state["cities"])["a"])["request"]))
    const crowded = liveCity(cfg, pack)
    crowded["functions"] = [{ id: "workshop", level: 1n }]
    crowded["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "e2", "engineer", "workshop", "produce"),
    ]
    const crowdedTick = tickCity(cfg, crowded)
    const crowdedCity = asDict(asDict(crowdedTick.state["cities"])["a"])
    const extraAgent = asList(crowdedCity["agents"])[1]
    expect(extraAgent !== undefined).toBe(true)
    if (extraAgent !== undefined) {
      expect(asStr(asDict(extraAgent)["idle"])).toBe(asStr(cfg["idle_agent"]))
      expect(asBig(asDict(extraAgent)["request"])).toBe(0n)
    }
    const t3 = spawnCity(
      cfg,
      "minimalist",
      asDict(asDict(asDict(asDict(pack["sections"])["sim"])["archetypes"])["minimalist"]),
      "a",
      1n,
      0n,
    )
    t3["login_period"] = 1n
    t3["output_base"] = asBig(cfg["workshop_out"])
    const t3Tick = tickCity(cfg, t3)
    expect(t3Tick.recs.map((r) => asStr(r["agent_id"]))).toEqual(["shift"])
    const vector = loadVector("slotted_tick")
    const five = liveCity(cfg, pack)
    five["functions"] = [
      { id: "workshop", level: 1n },
      { id: "bank", level: 1n },
      { id: "logistics_hub", level: 1n },
      { id: "ai_research_center", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    five["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "t1", "trader", "bank", "desk"),
      agentRow(cfg, "l1", "logistician", "logistics_hub", "route"),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
      agentRow(cfg, "m1", "manager", "city_hall", "focus"),
    ]
    const state = newState(cfg, { a: five }, {})
    armFund(state, cfg)
    state["day_budget_day"] = null
    const got = runTickVector(cfg, state, makeInputs(cfg, 0n))
    const recs = vector["records_hex"]
    expect(Array.isArray(recs)).toBe(true)
    const recList = recs as string[]
    expect(got.records.length).toBe(recList.length)
    for (let i = 0; i < got.records.length; i += 1) {
      const blob = got.records[i]
      const want = recList[i]
      if (blob === undefined || want === undefined) continue
      expect(bytesToHex(blob)).toBe(want)
    }
  })

  it("slotted_hours_and_inputs", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    expect(asBig(asDict(cfg["xp_to_next"])["1"])).toBe(240n)
    const closedIdx = closedBankTick(cfg)
    const bankCity = liveCity(cfg, pack)
    bankCity["functions"] = [{ id: "bank", level: 1n }]
    bankCity["agents"] = [agentRow(cfg, "t1", "trader", "bank", "desk")]
    const bankTick = tickCity(cfg, bankCity, closedIdx)
    const bankRec = recOf(bankTick.recs, "t1")
    expect(bankRec !== undefined).toBe(true)
    if (bankRec !== undefined) {
      const reason = asStr(bankRec["reason"])
      expect(reason === asStr(cfg["idle_bank"]) || reason === asStr(cfg["idle_hours"])).toBe(true)
      expect(asBig(bankRec["output"])).toBe(0n)
    }
    const sci = liveCity(cfg, pack)
    sci["functions"] = [{ id: "ai_research_center", level: 1n }]
    sci["agents"] = [
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
    ]
    sci["compute_stock"] = 0n
    sci["energy_stock"] = 50_000n
    const sciTick = tickCity(cfg, sci)
    const sciRec = recOf(sciTick.recs, "s1")
    expect(sciRec !== undefined).toBe(true)
    if (sciRec !== undefined) {
      expect(asStr(sciRec["reason"])).toBe(asStr(cfg["idle_compute"]))
      expect(asBig(sciRec["output"])).toBe(0n)
    }
    expect(asBig(asDict(asDict(sciTick.state["cities"])["a"])["energy_stock"])).toBe(50_000n)
    const missingCompute = liveCity(cfg, pack)
    missingCompute["functions"] = [
      { id: "ai_research_center", level: 1n },
      { id: "workshop", level: 1n },
    ]
    missingCompute["agents"] = [
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
    ]
    missingCompute["energy_stock"] = 50_000n
    expect("compute_stock" in missingCompute).toBe(false)
    const missingTick = tickCity(cfg, missingCompute)
    const missingRec = recOf(missingTick.recs, "s1")
    expect(missingRec !== undefined).toBe(true)
    if (missingRec !== undefined) {
      expect(asStr(missingRec["reason"])).toBe(asStr(cfg["idle_compute"]))
    }
    const robEnergyRows = asList(asDict(asDict(asDict(cfg["generated"])["balance"])["level_energy"])["robotics_lab"])
    const robEnergy = asBig(robEnergyRows[0])
    expect(robEnergy > 0n).toBe(true)
    const rob = liveCity(cfg, pack)
    rob["functions"] = [{ id: "robotics_lab", level: 1n }]
    rob["agents"] = []
    rob["energy_stock"] = robEnergy
    rob["compute_stock"] = 0n
    const robTick = tickCity(cfg, rob)
    expect(asStr(robTick.recs[0]?.["reason"])).toBe(asStr(cfg["idle_compute"]))
    expect(asBig(asDict(asDict(robTick.state["cities"])["a"])["energy_stock"])).toBe(robEnergy)
    const noPupil = liveCity(cfg, pack)
    noPupil["functions"] = [{ id: "ai_research_center", level: 1n }]
    noPupil["agents"] = [agentRow(cfg, "s1", "scientist", "ai_research_center", "train")]
    const noPupilStock = 1_000_000n
    noPupil["compute_stock"] = noPupilStock
    const noPupilTick = tickCity(cfg, noPupil)
    const noPupilRec = recOf(noPupilTick.recs, "s1")
    const noPupilCity = asDict(asDict(noPupilTick.state["cities"])["a"])
    expect(noPupilRec !== undefined).toBe(true)
    if (noPupilRec !== undefined) {
      expect(asStr(noPupilRec["reason"])).toBe(asStr(cfg["idle_train_target"]))
      expect(asBig(noPupilRec["output"])).toBe(0n)
    }
    expect(asBig(noPupilCity["compute_stock"])).toBe(noPupilStock)
    const selfTrain = liveCity(cfg, pack)
    selfTrain["functions"] = [{ id: "ai_research_center", level: 1n }]
    selfTrain["agents"] = [agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "s1" })]
    selfTrain["compute_stock"] = noPupilStock
    const selfTick = tickCity(cfg, selfTrain)
    const selfRec = recOf(selfTick.recs, "s1")
    expect(selfRec !== undefined).toBe(true)
    if (selfRec !== undefined) {
      expect(asStr(selfRec["reason"])).toBe(asStr(cfg["idle_train_target"]))
    }
    expect(asBig(asDict(asDict(selfTick.state["cities"])["a"])["compute_stock"])).toBe(noPupilStock)
    const ghostTrain = liveCity(cfg, pack)
    ghostTrain["functions"] = [{ id: "ai_research_center", level: 1n }]
    ghostTrain["agents"] = [
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "ghost" }),
    ]
    ghostTrain["compute_stock"] = noPupilStock
    ghostTrain["energy_stock"] = noPupilStock
    const ghostTick = tickCity(cfg, ghostTrain)
    const ghostRec = recOf(ghostTick.recs, "s1")
    const ghostCity = asDict(asDict(ghostTick.state["cities"])["a"])
    expect(ghostRec !== undefined).toBe(true)
    if (ghostRec !== undefined) {
      expect(asStr(ghostRec["reason"])).toBe(asStr(cfg["idle_train_target"]))
    }
    expect(asBig(ghostCity["compute_stock"])).toBe(noPupilStock)
    expect(asBig(ghostCity["energy_stock"])).toBe(noPupilStock)
    const spaceTrain = liveCity(cfg, pack)
    spaceTrain["functions"] = [{ id: "ai_research_center", level: 1n }]
    spaceTrain["agents"] = [
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1 " }),
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
    ]
    spaceTrain["compute_stock"] = noPupilStock
    const spaceTick = tickCity(cfg, spaceTrain)
    const spaceRec = recOf(spaceTick.recs, "s1")
    expect(spaceRec !== undefined).toBe(true)
    if (spaceRec !== undefined) {
      expect(asStr(spaceRec["reason"])).toBe(asStr(cfg["idle_train_target"]))
    }
    expect(asBig(asDict(asDict(spaceTick.state["cities"])["a"])["compute_stock"])).toBe(noPupilStock)
    const researchIdle = liveCity(cfg, pack)
    researchIdle["functions"] = [{ id: "ai_research_center", level: 1n }]
    researchIdle["agents"] = [agentRow(cfg, "s1", "scientist", "ai_research_center", "research")]
    researchIdle["compute_stock"] = noPupilStock
    const researchTick = tickCity(cfg, researchIdle)
    const researchRec = recOf(researchTick.recs, "s1")
    expect(researchRec !== undefined).toBe(true)
    if (researchRec !== undefined) {
      expect(asStr(researchRec["reason"])).not.toBe(asStr(cfg["idle_train_target"]))
    }
    const dryXp = liveCity(cfg, pack)
    dryXp["functions"] = [{ id: "ai_research_center", level: 1n }]
    dryXp["agents"] = [
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1", xp: 0n }),
      agentRow(cfg, "e1", "engineer", "", "produce", { xp: 0n }),
    ]
    dryXp["compute_stock"] = 0n
    const dryXpTick = tickCity(cfg, dryXp)
    const dryXpRec = recOf(dryXpTick.recs, "s1")
    const dryXpCity = asDict(asDict(dryXpTick.state["cities"])["a"])
    expect(dryXpRec !== undefined).toBe(true)
    if (dryXpRec !== undefined) {
      expect(asStr(dryXpRec["reason"])).toBe(asStr(cfg["idle_compute"]))
    }
    expect(asBig(asDict(agentOfCity(dryXpCity, "e1") ?? {})["xp"])).toBe(0n)
    const unseatedTrainer = liveCity(cfg, pack)
    unseatedTrainer["functions"] = [{ id: "workshop", level: 1n }]
    unseatedTrainer["agents"] = [
      agentRow(cfg, "s1", "scientist", "", "train", { train_target: "e1", xp: 0n }),
      agentRow(cfg, "e1", "engineer", "workshop", "produce", { xp: 0n }),
    ]
    unseatedTrainer["compute_stock"] = noPupilStock
    unseatedTrainer["energy_stock"] = noPupilStock
    const unseatedTick = tickCity(cfg, unseatedTrainer)
    const unseatedCity = asDict(asDict(unseatedTick.state["cities"])["a"])
    const unseatedEng = agentOfCity(unseatedCity, "e1")
    const unseatedRec = recOf(unseatedTick.recs, "e1")
    expect(unseatedEng !== undefined).toBe(true)
    expect(unseatedRec !== undefined).toBe(true)
    if (unseatedRec !== undefined) {
      expect(asStr(unseatedRec["reason"])).toBe("")
      expect(asBig(unseatedRec["output"]) > 0n).toBe(true)
    }
    if (unseatedEng !== undefined) {
      expect(asBig(unseatedEng["xp"])).toBe(1n)
    }
    const unseatedSci = agentOfCity(unseatedCity, "s1")
    expect(unseatedSci !== undefined).toBe(true)
    if (unseatedSci !== undefined) {
      expect(asStr(unseatedSci["idle"])).toBe(asStr(cfg["idle_agent"]))
      expect(asBig(unseatedSci["xp"])).toBe(0n)
    }
    const leftover = liveCity(cfg, pack)
    leftover["functions"] = [
      { id: "workshop", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    leftover["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce", { train_target: "s1", xp: 0n }),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "research", { xp: 0n }),
    ]
    leftover["compute_stock"] = noPupilStock
    const leftoverTick = tickCity(cfg, leftover)
    const leftoverCity = asDict(asDict(leftoverTick.state["cities"])["a"])
    expect(asBig(asDict(agentOfCity(leftoverCity, "s1") ?? {})["xp"])).toBe(0n)
    const blankTarget = liveCity(cfg, pack)
    blankTarget["functions"] = [
      { id: "workshop", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    blankTarget["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce", { xp: 0n }),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "", xp: 0n }),
    ]
    blankTarget["train_target"] = "e1"
    blankTarget["compute_stock"] = noPupilStock
    blankTarget["energy_stock"] = noPupilStock
    const blankTick = tickCity(cfg, blankTarget)
    const blankRec = recOf(blankTick.recs, "s1")
    const blankCity = asDict(asDict(blankTick.state["cities"])["a"])
    expect(blankRec !== undefined).toBe(true)
    if (blankRec !== undefined) {
      expect(asStr(blankRec["reason"])).toBe(asStr(cfg["idle_train_target"]))
      expect(asBig(blankRec["output"])).toBe(0n)
    }
    expect(asBig(blankCity["compute_stock"])).toBe(noPupilStock)
    expect(asBig(asDict(agentOfCity(blankCity, "e1") ?? {})["xp"])).toBe(1n)
    const energyRows = asList(asDict(asDict(asDict(cfg["generated"])["balance"])["level_energy"])["workshop"])
    const baseEnergy = asBig(energyRows[0])
    const unitBps = asBig(cfg["bps"])
    const probe = asDict(asDict(asDict(cfg["generated"])["modifiers"])["modifier_stack_probe"])
    const ocMag = asBig(probe["overclock_energy"])
    const ocMul = unitBps + ocMag
    const ocNeed = (baseEnergy * ocMul) / unitBps
    const oc = liveCity(cfg, pack)
    oc["functions"] = [{ id: "workshop", level: 1n }]
    oc["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "overclock")]
    oc["energy_stock"] = baseEnergy
    const ocTick = tickCity(cfg, oc)
    const ocRec = recOf(ocTick.recs, "e1")
    expect(ocRec !== undefined).toBe(true)
    if (ocRec !== undefined) {
      expect(asStr(ocRec["reason"])).toBe(asStr(cfg["idle_energy"]))
      expect(asBig(ocRec["output"])).toBe(0n)
    }
    const ocPaid = liveCity(cfg, pack)
    ocPaid["functions"] = [{ id: "workshop", level: 1n }]
    ocPaid["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "overclock")]
    ocPaid["energy_stock"] = ocNeed
    const ocPaidTick = tickCity(cfg, ocPaid)
    const ocPaidRec = recOf(ocPaidTick.recs, "e1")
    expect(ocPaidRec !== undefined).toBe(true)
    if (ocPaidRec !== undefined) {
      expect(asStr(ocPaidRec["reason"])).toBe("")
      expect(asBig(ocPaidRec["output"]) > 0n).toBe(true)
    }
    const specCity = liveCity(cfg, pack)
    specCity["functions"] = [{ id: "workshop", level: 1n }]
    specCity["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce", { traits: ["specialist"] }),
    ]
    specCity["energy_stock"] = baseEnergy
    const specTick = tickCity(cfg, specCity)
    const specRec = recOf(specTick.recs, "e1")
    expect(specRec !== undefined).toBe(true)
    if (specRec !== undefined) {
      expect(asStr(specRec["reason"])).toBe("")
      expect(asBig(specRec["output"]) > 0n).toBe(true)
    }
    const routeFat = liveCity(cfg, pack)
    routeFat["functions"] = [
      { id: "workshop", level: 1n },
      { id: "logistics_hub", level: 1n },
    ]
    routeFat["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "l1", "logistician", "logistics_hub", "route"),
    ]
    routeFat["energy_stock"] = 1_000_000n
    const routeFatTick = tickCity(cfg, routeFat)
    const routeFatRec = recOf(routeFatTick.recs, "e1")
    expect(routeFatRec !== undefined).toBe(true)
    if (routeFatRec !== undefined) {
      const used = asBig(asDict(routeFatRec["inputs"])["energy"])
      expect(used > (baseEnergy * 5n) / 10n).toBe(true)
      expect(used <= baseEnergy).toBe(true)
    }
    const thin = liveCity(cfg, pack)
    thin["functions"] = [{ id: "workshop", level: 1n }]
    thin["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    thin["energy_stock"] = (baseEnergy * 95n) / 100n
    const thinTick = tickCity(cfg, thin)
    const thinRec = recOf(thinTick.recs, "e1")
    expect(thinRec !== undefined).toBe(true)
    if (thinRec !== undefined) {
      expect(asStr(thinRec["reason"])).toBe(asStr(cfg["idle_energy"]))
    }
    const depot = liveCity(cfg, pack)
    depot["functions"] = [
      { id: "workshop", level: 1n },
      { id: "drone_depot", level: 1n },
    ]
    depot["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "l1", "logistician", "drone_depot", "route"),
    ]
    depot["energy_stock"] = (baseEnergy * 95n) / 100n
    const depotTick = tickCity(cfg, depot)
    const depotRec = recOf(depotTick.recs, "e1")
    expect(depotRec !== undefined).toBe(true)
    if (depotRec !== undefined) {
      expect(asStr(depotRec["reason"])).toBe("")
      expect(asBig(depotRec["output"]) > 0n).toBe(true)
    }
    const yard = liveCity(cfg, pack)
    yard["functions"] = [
      { id: "workshop", level: 1n },
      { id: "fleet_yard", level: 1n },
    ]
    yard["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "l1", "logistician", "fleet_yard", "route"),
    ]
    yard["energy_stock"] = (baseEnergy * 95n) / 100n
    const yardTick = tickCity(cfg, yard)
    const yardRec = recOf(yardTick.recs, "e1")
    expect(yardRec !== undefined).toBe(true)
    if (yardRec !== undefined) {
      expect(asStr(yardRec["reason"])).toBe("")
    }
    const produceFat = liveCity(cfg, pack)
    produceFat["functions"] = [{ id: "workshop", level: 1n }]
    produceFat["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    produceFat["energy_stock"] = 1_000_000n
    const ocFat = liveCity(cfg, pack)
    ocFat["functions"] = [{ id: "workshop", level: 1n }]
    ocFat["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "overclock")]
    ocFat["energy_stock"] = 1_000_000n
    const produceReq = asBig(asDict(asDict(tickCity(cfg, produceFat).state["cities"])["a"])["request"])
    const ocReq = asBig(asDict(asDict(tickCity(cfg, ocFat).state["cities"])["a"])["request"])
    const ocOutMag = asBig(probe["overclock_out"])
    expect(ocReq > produceReq).toBe(true)
    expect(ocReq <= (produceReq * (unitBps + ocOutMag)) / unitBps).toBe(true)
    expect(ocReq < (produceReq * ocMul) / unitBps).toBe(true)
    const dry = liveCity(cfg, pack)
    dry["functions"] = [{ id: "workshop", level: 1n }]
    dry["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    dry["energy_stock"] = 0n
    const dryTick = tickCity(cfg, dry)
    const dryRec = recOf(dryTick.recs, "e1")
    expect(dryRec !== undefined).toBe(true)
    if (dryRec !== undefined) {
      expect(asStr(dryRec["reason"])).toBe(asStr(cfg["idle_energy"]))
      expect(asBig(dryRec["output"])).toBe(0n)
    }
    const node = liveCity(cfg, pack)
    node["functions"] = [{ id: "power_node", level: 1n }]
    node["agents"] = [agentRow(cfg, "e1", "engineer", "power_node", "produce")]
    node["energy_stock"] = 0n
    const nodeTick = tickCity(cfg, node)
    const nodeCity = asDict(asDict(nodeTick.state["cities"])["a"])
    const nodeRec = recOf(nodeTick.recs, "e1")
    expect(nodeRec !== undefined).toBe(true)
    if (nodeRec !== undefined) {
      expect(asStr(nodeRec["reason"])).toBe("")
    }
    expect(asBig(nodeCity["energy_stock"]) > 0n).toBe(true)
    const computeRows = asList(asDict(asDict(asDict(cfg["generated"])["balance"])["level_compute"])["ai_research_center"])
    const baseCompute = asBig(computeRows[0])
    expect(baseCompute > 0n).toBe(true)
    const affN = asBig(cfg["affinity_neighbour_bps"])
    const bps = asBig(cfg["bps"])
    const lab = liveCity(cfg, pack)
    lab["functions"] = [{ id: "ai_research_center", level: 1n }]
    lab["agents"] = [agentRow(cfg, "e1", "engineer", "ai_research_center", "produce")]
    lab["compute_stock"] = 0n
    const labTick = tickCity(cfg, lab)
    const labCity = asDict(asDict(labTick.state["cities"])["a"])
    const labRec = recOf(labTick.recs, "e1")
    expect(labRec !== undefined).toBe(true)
    if (labRec !== undefined) {
      expect(asStr(labRec["reason"])).toBe("")
    }
    const wantCompute = (((baseCompute * affN) / bps) * slotMult(cfg)) / bps
    expect(asBig(labCity["compute_stock"])).toBe(wantCompute)
    const sciMint = liveCity(cfg, pack)
    sciMint["functions"] = [
      { id: "ai_research_center", level: 1n },
      { id: "workshop", level: 1n },
    ]
    sciMint["agents"] = [
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
    ]
    const startCompute = 1_000_000n
    sciMint["compute_stock"] = startCompute
    sciMint["energy_stock"] = startCompute
    const sciMintTick = tickCity(cfg, sciMint)
    const sciMintCity = asDict(asDict(sciMintTick.state["cities"])["a"])
    const sciMintRec = recOf(sciMintTick.recs, "s1")
    expect(sciMintRec !== undefined).toBe(true)
    if (sciMintRec !== undefined) {
      expect(asStr(sciMintRec["reason"])).toBe("")
    }
    expect(asBig(sciMintCity["compute_stock"]) < startCompute).toBe(true)
    const trainDraw = startCompute - asBig(sciMintCity["compute_stock"])
    expect(trainDraw > asBig(cfg["workshop_energy"])).toBe(true)
    const pupil = agentOfCity(sciMintCity, "e1")
    expect(pupil !== undefined).toBe(true)
    if (pupil !== undefined) {
      expect(asBig(pupil["xp"])).toBe(2n)
      expect(asBig(pupil["xp_remainder"]) > 0n).toBe(true)
    }
    const planted = liveCity(cfg, pack)
    plantPrebuilt(cfg, planted)
    planted["functions"] = [
      { id: "ai_research_center", level: 1n },
      { id: "energy_plant", level: 1n },
    ]
    planted["agents"] = [
      agentRow(cfg, "e1", "engineer", "ai_research_center", "produce"),
      agentRow(cfg, "e2", "engineer", "energy_plant", "produce"),
    ]
    const plantedTick = tickCity(cfg, planted)
    const plantedCity = asDict(asDict(plantedTick.state["cities"])["a"])
    const plantedLab = recOf(plantedTick.recs, "e1")
    expect(plantedLab !== undefined).toBe(true)
    if (plantedLab !== undefined) {
      expect(asStr(plantedLab["reason"])).toBe("")
    }
    expect(asBig(plantedCity["compute_stock"]) > 0n).toBe(true)
    const wrongLab = liveCity(cfg, pack)
    wrongLab["functions"] = [{ id: "ai_research_center", level: 1n }]
    wrongLab["agents"] = [agentRow(cfg, "t1", "trader", "ai_research_center", "desk")]
    wrongLab["compute_stock"] = 0n
    const wrongLabTick = tickCity(cfg, wrongLab)
    const wrongLabCity = asDict(asDict(wrongLabTick.state["cities"])["a"])
    expect(asBig(wrongLabCity["compute_stock"])).toBe(0n)
    const pair = liveCity(cfg, pack)
    pair["functions"] = [
      { id: "power_node", level: 1n },
      { id: "workshop", level: 1n },
    ]
    pair["agents"] = [
      agentRow(cfg, "e1", "engineer", "power_node", "produce"),
      agentRow(cfg, "e2", "engineer", "workshop", "produce"),
    ]
    pair["energy_stock"] = 0n
    const pairTick = tickCity(cfg, pair)
    const shopRec = recOf(pairTick.recs, "e2")
    expect(shopRec !== undefined).toBe(true)
    if (shopRec !== undefined) {
      expect(asStr(shopRec["reason"])).toBe("")
      expect(asBig(shopRec["output"]) > 0n).toBe(true)
    }
    const frozen = liveCity(cfg, pack)
    frozen["functions"] = [{ id: "workshop", level: 1n, deactivated: 1n }]
    frozen["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    const frozenTick = tickCity(cfg, frozen)
    expect(frozenTick.recs.length).toBe(0)
    const frozenCity = asDict(asDict(frozenTick.state["cities"])["a"])
    expect(asBig(frozenCity["occupied_jobs"])).toBe(0n)
    const frozenAgentRaw = asList(frozenCity["agents"])[0]
    expect(frozenAgentRaw !== undefined).toBe(true)
    if (frozenAgentRaw !== undefined) {
      expect(asStr(asDict(frozenAgentRaw)["idle"])).toBe(asStr(cfg["idle_agent"]))
    }
    const raising = liveCity(cfg, pack)
    raising["functions"] = [{ id: "workshop", level: 1n, construction: 1n }]
    raising["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    raising["energy_stock"] = 1_000_000n
    const raisingTick = tickCity(cfg, raising)
    const raisingRec = recOf(raisingTick.recs, "e1")
    const raisingCity = asDict(asDict(raisingTick.state["cities"])["a"])
    expect(raisingRec !== undefined).toBe(true)
    if (raisingRec !== undefined) {
      expect(asStr(raisingRec["reason"])).toBe(asStr(cfg["idle_construction"]))
      expect(asBig(raisingRec["output"])).toBe(0n)
    }
    expect(asBig(raisingCity["occupied_jobs"])).toBe(0n)
    expect(asBig(asDict(asList(raisingCity["functions"])[0] ?? {})["construction"])).toBe(0n)
    const raisedTick = tickCity(cfg, raisingCity)
    const raisedRec = recOf(raisedTick.recs, "e1")
    expect(raisedRec !== undefined).toBe(true)
    if (raisedRec !== undefined) {
      expect(asStr(raisedRec["reason"])).toBe("")
      expect(asBig(raisedRec["output"]) > 0n).toBe(true)
    }
    const retailIdx = retailOpenTick(cfg)
    const shop = liveCity(cfg, pack)
    shop["functions"] = [{ id: "flagship_store", level: 1n }]
    shop["agents"] = [agentRow(cfg, "t1", "trader", "flagship_store", "desk")]
    shop["population"] = asBig(asDict(cfg["population_thresholds"])["2"])
    shop["energy_stock"] = 1_000_000n
    const shopTick = tickCity(cfg, shop, retailIdx)
    const flagshipRec = recOf(shopTick.recs, "t1")
    expect(flagshipRec !== undefined).toBe(true)
    if (flagshipRec !== undefined) {
      expect(asStr(flagshipRec["reason"])).toBe("")
      expect(asBig(flagshipRec["output"]) > 0n).toBe(true)
    }
    const emptyShop = liveCity(cfg, pack)
    emptyShop["functions"] = [{ id: "flagship_store", level: 1n }]
    emptyShop["agents"] = [agentRow(cfg, "t1", "trader", "flagship_store", "desk")]
    emptyShop["population"] = 0n
    emptyShop["energy_stock"] = 1_000_000n
    const emptyShopTick = tickCity(cfg, emptyShop, retailIdx)
    const emptyShopRec = recOf(emptyShopTick.recs, "t1")
    expect(emptyShopRec !== undefined).toBe(true)
    if (emptyShopRec !== undefined) {
      expect(asStr(emptyShopRec["reason"])).toBe("")
      expect(asBig(emptyShopRec["output"])).toBe(0n)
    }
    const wrongShop = liveCity(cfg, pack)
    wrongShop["functions"] = [{ id: "flagship_store", level: 1n }]
    wrongShop["agents"] = [agentRow(cfg, "e1", "engineer", "flagship_store", "produce")]
    wrongShop["population"] = asBig(asDict(cfg["population_thresholds"])["2"])
    const wrongShopTick = tickCity(cfg, wrongShop, retailIdx)
    const wrongShopRec = recOf(wrongShopTick.recs, "e1")
    expect(wrongShopRec !== undefined).toBe(true)
    if (wrongShopRec !== undefined) {
      expect(asStr(wrongShopRec["reason"])).toBe(asStr(cfg["idle_wrong_role"]))
      expect(asBig(wrongShopRec["output"])).toBe(0n)
    }
    const shopConv = liveCity(cfg, pack)
    shopConv["functions"] = [{ id: "flagship_store", level: 1n }]
    shopConv["agents"] = [agentRow(cfg, "t1", "trader", "flagship_store", "desk")]
    shopConv["population"] = asBig(asDict(cfg["population_thresholds"])["2"])
    shopConv["energy_stock"] = 1_000_000n
    shopConv["nodes"] = [{ key: "population_conversion_bps", magnitude: 500n }]
    const shopConvTick = tickCity(cfg, shopConv, retailIdx)
    const shopConvCity = asDict(asDict(shopConvTick.state["cities"])["a"])
    const shopBaseReq = asBig(asDict(asDict(shopTick.state["cities"])["a"])["request"])
    expect(asStr(recOf(shopConvTick.recs, "t1")?.["reason"])).toBe("")
    expect(asBig(shopConvCity["request"])).toBe((shopBaseReq * (asBig(cfg["bps"]) + 500n)) / asBig(cfg["bps"]))
    const shopIced = liveCity(cfg, pack)
    shopIced["functions"] = [{ id: "flagship_store", level: 1n }]
    shopIced["agents"] = [agentRow(cfg, "t1", "trader", "flagship_store", "desk")]
    shopIced["population"] = asBig(asDict(cfg["population_thresholds"])["2"])
    shopIced["energy_stock"] = 1_000_000n
    shopIced["nodes"] = [{ id: "div_energy_1", key: "population_conversion_bps", magnitude: 500n }]
    shopIced["district_freeze_until"] = { TSLA: 1n }
    const shopIcedCity = asDict(asDict(tickCity(cfg, shopIced, retailIdx).state["cities"])["a"])
    expect(asBig(shopIcedCity["request"])).toBe(shopBaseReq)
    const wsBare = liveCity(cfg, pack)
    wsBare["functions"] = [{ id: "workshop", level: 1n }]
    wsBare["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    wsBare["energy_stock"] = 1_000_000n
    const wsConv = liveCity(cfg, pack)
    wsConv["functions"] = [{ id: "workshop", level: 1n }]
    wsConv["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    wsConv["energy_stock"] = 1_000_000n
    wsConv["nodes"] = [{ key: "population_conversion_bps", magnitude: 500n }]
    const wsBarePay = asBig(asDict(asDict(tickCity(cfg, wsBare).state["cities"])["a"])["payout"])
    const wsConvPay = asBig(asDict(asDict(tickCity(cfg, wsConv).state["cities"])["a"])["payout"])
    expect(wsConvPay).toBe(wsBarePay)
    const wsCosts = asList(asDict(asDict(asDict(cfg["generated"])["balance"])["level_cost"])["workshop"])
    const wsL1 = asBig(wsCosts[0])
    expect(wsL1 > 0n).toBe(true)
    expect(scaleByModifierKey(cfg, liveCity(cfg, pack), "build_cost_bps", wsL1, 0n)).toBe(wsL1)
    const cheapBuild = liveCity(cfg, pack)
    cheapBuild["nodes"] = [{ key: "build_cost_bps", magnitude: -1000n }]
    expect(scaleByModifierKey(cfg, cheapBuild, "build_cost_bps", wsL1, 0n)).toBe(
      (wsL1 * (asBig(cfg["bps"]) - 1000n)) / asBig(cfg["bps"]),
    )
    expect(scaleByModifierKey(cfg, cheapBuild, "build_cost_bps", 0n, 0n)).toBe(0n)
    const t3Wide = liveCity(cfg, pack)
    const t3Cheap = liveCity(cfg, pack)
    t3Cheap["nodes"] = [{ key: "build_cost_bps", magnitude: -1000n }]
    expect(asBig(asDict(asDict(tickCity(cfg, t3Cheap).state["cities"])["a"])["payout"])).toBe(
      asBig(asDict(asDict(tickCity(cfg, t3Wide).state["cities"])["a"])["payout"]),
    )
    const times = asDict(cfg["research_time_ticks"])
    const focusId = asStr(Object.keys(times).sort()[0])
    expect(focusId.length > 0).toBe(true)
    const freeResearch = liveCity(cfg, pack)
    freeResearch["functions"] = [{ id: "workshop", level: 1n }]
    freeResearch["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    freeResearch["objective"] = asStr(cfg["research_objective"])
    freeResearch["research_focus"] = focusId
    freeResearch["research_progress"] = 0n
    const freeTick = tickCity(cfg, freeResearch)
    const freeCity = asDict(asDict(freeTick.state["cities"])["a"])
    expect(asBig(freeCity["research_progress"])).toBe(0n)
    expect(asList(freeCity["research_unlocked"]).includes(focusId)).toBe(false)
    const trainMask = liveCity(cfg, pack)
    trainMask["functions"] = [{ id: "ai_research_center", level: 1n }]
    trainMask["agents"] = [
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
    ]
    trainMask["objective"] = asStr(cfg["research_objective"])
    trainMask["research_focus"] = focusId
    trainMask["research_progress"] = 0n
    trainMask["compute_stock"] = 1_000_000n
    const maskTick = tickCity(cfg, trainMask)
    const maskCity = asDict(asDict(maskTick.state["cities"])["a"])
    expect(asBig(maskCity["research_progress"])).toBe(0n)
    const paidResearch = liveCity(cfg, pack)
    paidResearch["functions"] = [{ id: "ai_research_center", level: 1n }]
    paidResearch["agents"] = [agentRow(cfg, "s1", "scientist", "ai_research_center", "research")]
    paidResearch["objective"] = asStr(cfg["research_objective"])
    paidResearch["research_focus"] = focusId
    paidResearch["research_progress"] = 0n
    paidResearch["compute_stock"] = 1_000_000n
    const paidTick = tickCity(cfg, paidResearch)
    const paidCity = asDict(asDict(paidTick.state["cities"])["a"])
    const paidRec = recOf(paidTick.recs, "s1")
    expect(paidRec !== undefined).toBe(true)
    if (paidRec !== undefined) {
      expect(asStr(paidRec["reason"])).toBe("")
    }
    expect(asBig(paidCity["research_progress"]) > 0n || asList(paidCity["research_unlocked"]).includes(focusId)).toBe(
      true,
    )
    const bareResearch = liveCity(cfg, pack)
    bareResearch["functions"] = [{ id: "ai_research_center", level: 1n }]
    bareResearch["agents"] = [agentRow(cfg, "s1", "scientist", "ai_research_center", "research")]
    bareResearch["compute_stock"] = 1_000_000n
    bareResearch["energy_stock"] = 1_000_000n
    const bareTick = tickCity(cfg, bareResearch)
    const bareCity = asDict(asDict(bareTick.state["cities"])["a"])
    const bareRec = recOf(bareTick.recs, "s1")
    expect(bareRec !== undefined).toBe(true)
    if (bareRec !== undefined) {
      expect(asStr(bareRec["reason"])).toBe(asStr(cfg["idle_research_focus"]))
    }
    expect(asBig(bareCity["compute_stock"])).toBe(1_000_000n)
    expect(asBig(bareCity["research_progress"])).toBe(0n)
    expect(asList(bareCity["research_unlocked"]).includes(focusId)).toBe(false)
    const doneFocus = liveCity(cfg, pack)
    doneFocus["functions"] = [{ id: "ai_research_center", level: 1n }]
    doneFocus["agents"] = [agentRow(cfg, "s1", "scientist", "ai_research_center", "research")]
    doneFocus["research_focus"] = focusId
    doneFocus["research_unlocked"] = [focusId]
    doneFocus["compute_stock"] = 1_000_000n
    doneFocus["energy_stock"] = 1_000_000n
    const doneTick = tickCity(cfg, doneFocus)
    const doneCity = asDict(asDict(doneTick.state["cities"])["a"])
    const doneRec = recOf(doneTick.recs, "s1")
    expect(doneRec !== undefined).toBe(true)
    if (doneRec !== undefined) {
      expect(asStr(doneRec["reason"])).toBe(asStr(cfg["idle_research_focus"]))
    }
    expect(asBig(doneCity["compute_stock"])).toBe(1_000_000n)
    expect(asStr(doneCity["research_focus"])).toBe("")
    const nextId = asStr(Object.keys(times).sort()[1])
    if (nextId.length > 0) {
      expect(asList(doneCity["research_unlocked"]).includes(nextId)).toBe(false)
    }
    const auto = liveCity(cfg, pack)
    auto["functions"] = [{ id: "workshop", level: 1n }]
    auto["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    auto["nodes"] = [
      { id: "n_off", key: "offline_cap_hours", magnitude: 6n },
      { id: "n_slots", key: "agent_slots", magnitude: 2n },
    ]
    auto["city_level"] = 1n
    const autoTick = tickCity(cfg, auto)
    const autoCity = asDict(asDict(autoTick.state["cities"])["a"])
    expect(asBig(autoCity["offline_cap_hours"])).toBe(6n)
    const packL1 = asBig(asDict(cfg["slots_at_city_level"])["1"])
    expect(asBig(autoCity["agent_slots"])).toBe(packL1 + 2n)
    const tower = liveCity(cfg, pack)
    tower["functions"] = [{ id: "finance_tower", level: 3n }]
    tower["agents"] = []
    const towerTick = tickCity(cfg, tower)
    const towerCity = asDict(asDict(towerTick.state["cities"])["a"])
    expect(asBig(towerCity["bank_level"])).toBe(3n)
    const frozenTower = liveCity(cfg, pack)
    frozenTower["functions"] = [{ id: "finance_tower", level: 3n, frozen: 1n }]
    frozenTower["agents"] = []
    const icedTowerTick = tickCity(cfg, frozenTower)
    const icedTowerCity = asDict(asDict(icedTowerTick.state["cities"])["a"])
    expect(asBig(icedTowerCity["bank_level"])).toBe(1n)
    const computeTicker = asStr(
      asDict(asDict(asDict(asDict(cfg["data"])["districts"])["districts"])["compute"])["ticker"],
    )
    const icedArc = liveCity(cfg, pack)
    icedArc["functions"] = [{ id: "ai_research_center", level: 1n }]
    icedArc["agents"] = [agentRow(cfg, "e1", "engineer", "ai_research_center", "produce")]
    icedArc["energy_stock"] = 1_000_000n
    icedArc["district_freeze_until"] = { [computeTicker]: 1n }
    const icedArcTick = tickCity(cfg, icedArc)
    const icedArcCity = asDict(asDict(icedArcTick.state["cities"])["a"])
    const icedArcRec = recOf(icedArcTick.recs, "e1")
    expect(icedArcRec !== undefined).toBe(true)
    if (icedArcRec !== undefined) {
      expect(asStr(icedArcRec["reason"])).toBe(asStr(cfg["idle_district_frozen"]))
    }
    expect(asBig(icedArcCity["occupied_jobs"])).toBe(0n)
    expect(asList(icedArcCity["codes"]).includes("DISTRICT_FROZEN")).toBe(true)
    const graceArc = liveCity(cfg, pack)
    graceArc["functions"] = [{ id: "ai_research_center", level: 1n }]
    graceArc["agents"] = [agentRow(cfg, "e1", "engineer", "ai_research_center", "produce")]
    graceArc["energy_stock"] = 1_000_000n
    graceArc["district_freeze_until"] = { [computeTicker]: asBig(cfg["anchor_hour"]) + 1000n }
    const graceArcRec = recOf(tickCity(cfg, graceArc).recs, "e1")
    expect(graceArcRec !== undefined).toBe(true)
    if (graceArcRec !== undefined) {
      expect(asStr(graceArcRec["reason"])).toBe("")
    }
    const shopNvda = liveCity(cfg, pack)
    shopNvda["functions"] = [{ id: "workshop", level: 1n }]
    shopNvda["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    shopNvda["energy_stock"] = 1_000_000n
    shopNvda["district_freeze_until"] = { [computeTicker]: 1n }
    const shopNvdaRec = recOf(tickCity(cfg, shopNvda).recs, "e1")
    expect(shopNvdaRec !== undefined).toBe(true)
    if (shopNvdaRec !== undefined) {
      expect(asStr(shopNvdaRec["reason"])).toBe("")
      expect(asBig(shopNvdaRec["output"]) > 0n).toBe(true)
    }
    const coinTicker = asStr(
      asDict(asDict(asDict(asDict(cfg["data"])["districts"])["districts"])["finance"])["ticker"],
    )
    const shareWarm = liveCity(cfg, pack)
    shareWarm["functions"] = [{ id: "workshop", level: 1n }]
    shareWarm["agents"] = []
    shareWarm["nodes"] = [{ id: "div_finance_1", key: "fund_share_bps", magnitude: 500n }]
    expect(asBig(asDict(asDict(tickCity(cfg, shareWarm).state["cities"])["a"])["fund_share_bps"]) > 0n).toBe(true)
    const shareIced = liveCity(cfg, pack)
    shareIced["functions"] = [{ id: "workshop", level: 1n }]
    shareIced["agents"] = []
    shareIced["nodes"] = [{ id: "div_finance_1", key: "fund_share_bps", magnitude: 500n }]
    shareIced["district_freeze_until"] = { [coinTicker]: 1n }
    expect(asBig(asDict(asDict(tickCity(cfg, shareIced).state["cities"])["a"])["fund_share_bps"])).toBe(0n)
    const coinTower = liveCity(cfg, pack)
    coinTower["functions"] = [{ id: "finance_tower", level: 3n }]
    coinTower["agents"] = []
    coinTower["district_freeze_until"] = { [coinTicker]: 1n }
    expect(asBig(asDict(asDict(tickCity(cfg, coinTower).state["cities"])["a"])["bank_level"])).toBe(1n)
    const scaleRow = asDict(asDict(asDict(cfg["generated"])["progression"])["progression_nodes"])["n_compute_scale"]
    const scaleMag = asBig(asDict(scaleRow)["magnitude"])
    expect(scaleMag > 0n).toBe(true)
    const t3Bare = liveCity(cfg, pack)
    t3Bare["output_base"] = asBig(cfg["workshop_out"])
    const t3Warm = liveCity(cfg, pack)
    t3Warm["output_base"] = asBig(cfg["workshop_out"])
    t3Warm["nodes"] = [{ id: "n_compute_scale", key: "output_bps", magnitude: scaleMag }]
    const t3Iced = liveCity(cfg, pack)
    t3Iced["output_base"] = asBig(cfg["workshop_out"])
    t3Iced["nodes"] = [{ id: "n_compute_scale", key: "output_bps", magnitude: scaleMag }]
    t3Iced["district_freeze_until"] = { [computeTicker]: 1n }
    const t3BareReq = asBig(asDict(asDict(tickCity(cfg, t3Bare).state["cities"])["a"])["request"])
    const t3WarmTick = tickCity(cfg, t3Warm)
    const t3WarmCity = asDict(asDict(t3WarmTick.state["cities"])["a"])
    const t3WarmReq = asBig(t3WarmCity["request"])
    const t3IcedTick = tickCity(cfg, t3Iced)
    const t3IcedCity = asDict(asDict(t3IcedTick.state["cities"])["a"])
    expect(t3BareReq > 0n).toBe(true)
    expect(t3WarmReq > t3BareReq).toBe(true)
    const bpsT3 = asBig(cfg["bps"])
    const residualT3 = asBig(cfg["residual_idle_bps"])
    expect(t3WarmReq).toBe(
      (((asBig(cfg["workshop_out"]) * (bpsT3 + scaleMag)) / bpsT3) * (bpsT3 - residualT3)) / bpsT3,
    )
    expect(asBig(t3IcedCity["request"])).toBe(t3BareReq)
    expect(asBig(t3IcedCity["mod_bps"])).toBe(asBig(cfg["bps"]))
    expect(asList(t3IcedCity["codes"]).includes("DISTRICT_FROZEN")).toBe(true)
    const t3Wrong = liveCity(cfg, pack)
    t3Wrong["output_base"] = asBig(cfg["workshop_out"])
    t3Wrong["nodes"] = [{ id: "n_compute_scale", key: "output_bps", magnitude: scaleMag }]
    t3Wrong["district_freeze_until"] = { [coinTicker]: 1n }
    expect(asBig(asDict(asDict(tickCity(cfg, t3Wrong).state["cities"])["a"])["request"])).toBe(t3WarmReq)
    const t3Grace = liveCity(cfg, pack)
    t3Grace["output_base"] = asBig(cfg["workshop_out"])
    t3Grace["nodes"] = [{ id: "n_compute_scale", key: "output_bps", magnitude: scaleMag }]
    t3Grace["district_freeze_until"] = { [computeTicker]: asBig(cfg["anchor_hour"]) + 1000n }
    expect(asBig(asDict(asDict(tickCity(cfg, t3Grace).state["cities"])["a"])["request"])).toBe(t3WarmReq)
    const t3Ghost = liveCity(cfg, pack)
    t3Ghost["output_base"] = asBig(cfg["workshop_out"])
    t3Ghost["nodes"] = [{ key: "output_bps", magnitude: scaleMag }]
    t3Ghost["district_freeze_until"] = { [computeTicker]: 1n }
    expect(asBig(asDict(asDict(tickCity(cfg, t3Ghost).state["cities"])["a"])["request"])).toBe(t3WarmReq)
    const t3Sticky = liveCity(cfg, pack)
    t3Sticky["output_base"] = asBig(cfg["workshop_out"])
    t3Sticky["nodes"] = [{ id: "n_compute_scale", key: "output_bps", magnitude: scaleMag }]
    const t3First = tickCity(cfg, t3Sticky)
    expect(asBig(asDict(asDict(t3First.state["cities"])["a"])["request"])).toBe(t3WarmReq)
    t3Sticky["district_freeze_until"] = { [computeTicker]: 1n }
    const t3Second = tickCity(cfg, t3Sticky, 1n)
    expect(asBig(asDict(asDict(t3Second.state["cities"])["a"])["request"])).toBe(t3BareReq)
    const gridMag = asBig(asDict(asDict(cfg["research_nodes"])["grid"])["effect_bps"])
    const circuitsMag = asBig(asDict(asDict(cfg["research_nodes"])["circuits"])["effect_bps"])
    const handbookMag = asBig(asDict(asDict(cfg["research_nodes"])["handbook"])["effect_bps"])
    const latheMag = asBig(asDict(asDict(cfg["research_nodes"])["lathe"])["effect_bps"])
    expect(gridMag < 0n).toBe(true)
    expect(circuitsMag < 0n).toBe(true)
    expect(handbookMag > 0n).toBe(true)
    expect(latheMag > 0n).toBe(true)
    const gridOff = liveCity(cfg, pack)
    gridOff["functions"] = [{ id: "workshop", level: 1n }]
    gridOff["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    gridOff["energy_stock"] = 1_000_000n
    const gridOn = liveCity(cfg, pack)
    gridOn["functions"] = [{ id: "workshop", level: 1n }]
    gridOn["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    gridOn["energy_stock"] = 1_000_000n
    gridOn["research_unlocked"] = ["grid"]
    const gridOffCity = asDict(asDict(tickCity(cfg, gridOff).state["cities"])["a"])
    const gridOnCity = asDict(asDict(tickCity(cfg, gridOn).state["cities"])["a"])
    const gridOffUsed = 1_000_000n - asBig(gridOffCity["energy_stock"])
    const gridOnUsed = 1_000_000n - asBig(gridOnCity["energy_stock"])
    expect(gridOffUsed > 0n).toBe(true)
    expect(gridOnUsed > 0n).toBe(true)
    expect(gridOnUsed < gridOffUsed).toBe(true)
    expect(asBig(gridOnCity["request"])).toBe(asBig(gridOffCity["request"]))
    const energyNode = liveCity(cfg, pack)
    energyNode["functions"] = [{ id: "workshop", level: 1n }]
    energyNode["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    energyNode["energy_stock"] = 1_000_000n
    energyNode["nodes"] = [{ key: "energy_cost_bps", magnitude: gridMag }]
    const energyNodeCity = asDict(asDict(tickCity(cfg, energyNode).state["cities"])["a"])
    expect(1_000_000n - asBig(energyNodeCity["energy_stock"])).toBe(gridOnUsed)
    expect(asBig(energyNodeCity["request"])).toBe(asBig(gridOffCity["request"]))
    const t3Energy = liveCity(cfg, pack)
    t3Energy["output_base"] = asBig(cfg["workshop_out"])
    t3Energy["nodes"] = [{ key: "energy_cost_bps", magnitude: gridMag }]
    expect(asBig(asDict(asDict(tickCity(cfg, t3Energy).state["cities"])["a"])["request"])).toBe(t3BareReq)
    const nodeOff = liveCity(cfg, pack)
    nodeOff["functions"] = [{ id: "power_node", level: 1n }]
    nodeOff["agents"] = [agentRow(cfg, "e1", "engineer", "power_node", "produce")]
    nodeOff["energy_stock"] = 0n
    const nodeOn = liveCity(cfg, pack)
    nodeOn["functions"] = [{ id: "power_node", level: 1n }]
    nodeOn["agents"] = [agentRow(cfg, "e1", "engineer", "power_node", "produce")]
    nodeOn["energy_stock"] = 0n
    nodeOn["research_unlocked"] = ["grid"]
    expect(asBig(asDict(asDict(tickCity(cfg, nodeOn).state["cities"])["a"])["energy_stock"])).toBe(
      asBig(asDict(asDict(tickCity(cfg, nodeOff).state["cities"])["a"])["energy_stock"]),
    )
    const circOff = liveCity(cfg, pack)
    circOff["functions"] = [
      { id: "workshop", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    circOff["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
    ]
    circOff["compute_stock"] = 1_000_000n
    circOff["energy_stock"] = 1_000_000n
    const circOn = liveCity(cfg, pack)
    circOn["functions"] = [
      { id: "workshop", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    circOn["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
    ]
    circOn["compute_stock"] = 1_000_000n
    circOn["energy_stock"] = 1_000_000n
    circOn["research_unlocked"] = ["circuits"]
    const circOffCity = asDict(asDict(tickCity(cfg, circOff).state["cities"])["a"])
    const circOnCity = asDict(asDict(tickCity(cfg, circOn).state["cities"])["a"])
    const circOffUsed = 1_000_000n - asBig(circOffCity["compute_stock"])
    const circOnUsed = 1_000_000n - asBig(circOnCity["compute_stock"])
    expect(circOffUsed > 0n).toBe(true)
    expect(circOnUsed > 0n).toBe(true)
    expect(circOnUsed < circOffUsed).toBe(true)
    expect(asBig(circOnCity["request"])).toBe(asBig(circOffCity["request"]))
    const computeNode = liveCity(cfg, pack)
    computeNode["functions"] = [
      { id: "workshop", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    computeNode["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
    ]
    computeNode["compute_stock"] = 1_000_000n
    computeNode["energy_stock"] = 1_000_000n
    computeNode["nodes"] = [{ key: "compute_cost_bps", magnitude: circuitsMag }]
    const computeNodeCity = asDict(asDict(tickCity(cfg, computeNode).state["cities"])["a"])
    expect(1_000_000n - asBig(computeNodeCity["compute_stock"])).toBe(circOnUsed)
    expect(asBig(computeNodeCity["request"])).toBe(asBig(circOffCity["request"]))
    const paperWs = liveCity(cfg, pack)
    paperWs["functions"] = [{ id: "workshop", level: 1n }]
    paperWs["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    paperWs["energy_stock"] = 1_000_000n
    paperWs["nodes"] = [{ key: "fragment_rate_bps", magnitude: asBig(cfg["node_effect_base_bps"]) * 3n }]
    expect(asBig(asDict(asDict(tickCity(cfg, paperWs).state["cities"])["a"])["request"])).toBe(
      asBig(gridOffCity["request"]),
    )
    const bookOff = liveCity(cfg, pack)
    bookOff["functions"] = [{ id: "workshop", level: 1n }]
    bookOff["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    bookOff["energy_stock"] = 1_000_000n
    const bookOn = liveCity(cfg, pack)
    bookOn["functions"] = [{ id: "workshop", level: 1n }]
    bookOn["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    bookOn["energy_stock"] = 1_000_000n
    bookOn["research_unlocked"] = ["handbook"]
    const bookOffAgent = agentOfCity(asDict(asDict(tickCity(cfg, bookOff).state["cities"])["a"]), "e1")
    const bookOnAgent = agentOfCity(asDict(asDict(tickCity(cfg, bookOn).state["cities"])["a"]), "e1")
    expect(bookOffAgent !== undefined).toBe(true)
    expect(bookOnAgent !== undefined).toBe(true)
    if (bookOffAgent !== undefined && bookOnAgent !== undefined) {
      expect(asBig(bookOffAgent["xp_remainder"])).toBe(0n)
      expect(asBig(bookOnAgent["xp_remainder"])).toBe(handbookMag)
    }
    const latheCity = liveCity(cfg, pack)
    latheCity["research_unlocked"] = ["lathe"]
    const spendBps = asBig(cfg["bps"])
    expect(constructionTicks(cfg, liveCity(cfg, pack), 11n)).toBe(11n)
    expect(constructionTicks(cfg, latheCity, 11n)).toBe((11n * spendBps) / (spendBps + latheMag))
    expect(constructionTicks(cfg, latheCity, 1n)).toBe(1n)
    expect(constructionTicks(cfg, latheCity, 0n)).toBe(0n)
    const depthCity = liveCity(cfg, pack)
    depthCity["nodes"] = [{ key: "upgrade_speed_bps", magnitude: latheMag }]
    expect(constructionTicks(cfg, depthCity, 11n)).toBe((11n * spendBps) / (spendBps + latheMag))
    const bothSpeed = liveCity(cfg, pack)
    bothSpeed["research_unlocked"] = ["lathe"]
    bothSpeed["nodes"] = [{ key: "upgrade_speed_bps", magnitude: latheMag }]
    const bothClip = ((spendBps + latheMag) * (spendBps + latheMag)) / spendBps
    expect(constructionTicks(cfg, bothSpeed, 11n)).toBe((11n * spendBps) / bothClip)
    const icedDepth = liveCity(cfg, pack)
    icedDepth["nodes"] = [{ id: "n_energy_depth", key: "upgrade_speed_bps", magnitude: latheMag }]
    icedDepth["district_freeze_until"] = { TSLA: 1n }
    expect(constructionTicks(cfg, icedDepth, 11n, 1n)).toBe(11n)
    expect(constructionTicks(cfg, icedDepth, 11n, 0n)).toBe((11n * spendBps) / (spendBps + latheMag))
    expect(constructionTicks(cfg, depthCity, 11n)).toBe(constructionTicks(cfg, latheCity, 11n))
    const zeroSpeed = liveCity(cfg, pack)
    zeroSpeed["nodes"] = [{ key: "upgrade_speed_bps", magnitude: 0n }]
    expect(constructionTicks(cfg, zeroSpeed, 11n)).toBe(11n)
    const wsSpeed = liveCity(cfg, pack)
    wsSpeed["functions"] = [{ id: "workshop", level: 1n }]
    wsSpeed["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    wsSpeed["energy_stock"] = 1_000_000n
    wsSpeed["nodes"] = [{ key: "upgrade_speed_bps", magnitude: latheMag }]
    const wsSpeedPay = asBig(asDict(asDict(tickCity(cfg, wsSpeed).state["cities"])["a"])["payout"])
    expect(wsSpeedPay).toBe(wsBarePay)
    const t3Speed = liveCity(cfg, pack)
    t3Speed["nodes"] = [{ key: "upgrade_speed_bps", magnitude: latheMag }]
    expect(asBig(asDict(asDict(tickCity(cfg, t3Speed).state["cities"])["a"])["payout"])).toBe(
      asBig(asDict(asDict(tickCity(cfg, liveCity(cfg, pack)).state["cities"])["a"])["payout"]),
    )
    const dbl = liveCity(cfg, pack)
    dbl["functions"] = [
      { id: "workshop", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    dbl["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", {
        train_target: "e1",
        compute_cost_mags: [10000n],
      }),
    ]
    dbl["compute_stock"] = 1_000_000n
    dbl["energy_stock"] = 1_000_000n
    const dblTick = tickCity(cfg, dbl)
    const dblCity = asDict(asDict(dblTick.state["cities"])["a"])
    const usedCompute = 1_000_000n - asBig(dblCity["compute_stock"])
    const plainSci = liveCity(cfg, pack)
    plainSci["functions"] = [
      { id: "workshop", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    plainSci["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "s1", "scientist", "ai_research_center", "train", { train_target: "e1" }),
    ]
    plainSci["compute_stock"] = 1_000_000n
    plainSci["energy_stock"] = 1_000_000n
    const plainTick = tickCity(cfg, plainSci)
    const plainCity = asDict(asDict(plainTick.state["cities"])["a"])
    const plainUsed = 1_000_000n - asBig(plainCity["compute_stock"])
    expect(usedCompute).toBe(plainUsed)
    expect(usedCompute > 0n).toBe(true)
    expect(asBig(asDict(agentOfCity(dblCity, "e1") ?? {})["xp"]) > 1n).toBe(true)
    const frozenDepot = liveCity(cfg, pack)
    frozenDepot["functions"] = [
      { id: "workshop", level: 1n },
      { id: "drone_depot", level: 1n, frozen: 1n },
    ]
    frozenDepot["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "l1", "logistician", "drone_depot", "route"),
    ]
    frozenDepot["energy_stock"] = (baseEnergy * 95n) / 100n
    const frozenDepotTick = tickCity(cfg, frozenDepot)
    const frozenDepotRec = recOf(frozenDepotTick.recs, "e1")
    expect(frozenDepotRec !== undefined).toBe(true)
    if (frozenDepotRec !== undefined) {
      expect(asStr(frozenDepotRec["reason"])).toBe(asStr(cfg["idle_energy"]))
    }
    const fatSlots = liveCity(cfg, pack)
    fatSlots["functions"] = [{ id: "workshop", level: 1n }]
    fatSlots["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    fatSlots["nodes"] = [{ id: "n_fat", key: "agent_slots", magnitude: 999n }]
    fatSlots["city_level"] = 1n
    const fatTick = tickCity(cfg, fatSlots)
    const fatCity = asDict(asDict(fatTick.state["cities"])["a"])
    expect(asBig(fatCity["agent_slots"])).toBe(asBig(cfg["slots_cap"]))
    const overTower = liveCity(cfg, pack)
    overTower["functions"] = [{ id: "finance_tower", level: asBig(cfg["bank_level_max"]) + 5n }]
    overTower["agents"] = []
    const overTick = tickCity(cfg, overTower)
    const overCity = asDict(asDict(overTick.state["cities"])["a"])
    expect(asBig(overCity["bank_level"])).toBe(asBig(cfg["bank_level_max"]))
  })

  it("slotted_payroll_and_vault", () => {
    const pack = loadPack()
    const cfg = loadConfig(pack)
    const toolsOn = liveCity(cfg, pack)
    toolsOn["functions"] = [{ id: "workshop", level: 1n }]
    toolsOn["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    toolsOn["research_unlocked"] = ["tools"]
    const toolsOff = liveCity(cfg, pack)
    toolsOff["functions"] = [{ id: "workshop", level: 1n }]
    toolsOff["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    const onTick = tickCity(cfg, toolsOn)
    const offTick = tickCity(cfg, toolsOff)
    const onReq = asBig(asDict(asDict(onTick.state["cities"])["a"])["request"])
    const offReq = asBig(asDict(asDict(offTick.state["cities"])["a"])["request"])
    expect(asBig(cfg["tools_effect_bps"]) > 0n).toBe(true)
    expect(onReq > offReq).toBe(true)
    const desk = liveCity(cfg, pack)
    desk["functions"] = [{ id: "bank", level: 1n }]
    desk["agents"] = [agentRow(cfg, "t1", "trader", "bank", "desk")]
    const openIdx = cityClock(cfg, 0n)[2] === asBig(cfg["bank_closed_weekday"]) ? 24n : 0n
    const deskTick = tickCity(cfg, desk, openIdx)
    const city = asDict(asDict(deskTick.state["cities"])["a"])
    if (asStr(recOf(deskTick.recs, "t1")?.["reason"]) === "") {
      expect(asBig(city["bank_markup_override"])).toBe(asBig(cfg["bank_markup_floor_bps"]))
    }
    const quoteEx = liveCity(cfg, pack)
    quoteEx["functions"] = [{ id: "exchange", level: 1n }]
    quoteEx["agents"] = [agentRow(cfg, "q1", "trader", "exchange", "quote")]
    quoteEx["energy_stock"] = 1_000_000n
    const quoteTick = tickCity(cfg, quoteEx, openIdx)
    const quoteCity = asDict(asDict(quoteTick.state["cities"])["a"])
    expect(asStr(recOf(quoteTick.recs, "q1")?.["reason"])).toBe("")
    expect(asBig(quoteCity["hop_quality"])).toBe(1n)
    const quoteBank = liveCity(cfg, pack)
    quoteBank["functions"] = [{ id: "bank", level: 1n }]
    quoteBank["agents"] = [agentRow(cfg, "q2", "trader", "bank", "quote")]
    quoteBank["energy_stock"] = 1_000_000n
    const quoteBankCity = asDict(asDict(tickCity(cfg, quoteBank, openIdx).state["cities"])["a"])
    expect(quoteBankCity["hop_quality"]).toBe(undefined)
    const deskEx = liveCity(cfg, pack)
    deskEx["functions"] = [{ id: "exchange", level: 1n }]
    deskEx["agents"] = [agentRow(cfg, "d1", "trader", "exchange", "desk")]
    deskEx["energy_stock"] = 1_000_000n
    const deskExCity = asDict(asDict(tickCity(cfg, deskEx, openIdx).state["cities"])["a"])
    expect(deskExCity["hop_quality"]).toBe(undefined)
    expect("bank_markup_override" in deskExCity).toBe(false)
    const bps = asBig(cfg["bps"])
    const q = asBig(cfg["node_effect_base_bps"])
    expect(q > 0n).toBe(true)
    const focusBase = liveCity(cfg, pack)
    focusBase["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    focusBase["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    focusBase["energy_stock"] = 1_000_000n
    const focusOn = liveCity(cfg, pack)
    focusOn["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    focusOn["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_production" }),
    ]
    focusOn["energy_stock"] = 1_000_000n
    const focusBaseReq = asBig(asDict(asDict(tickCity(cfg, focusBase).state["cities"])["a"])["request"])
    const focusOnTick = tickCity(cfg, focusOn)
    const focusOnCity = asDict(asDict(focusOnTick.state["cities"])["a"])
    const focusOnReq = asBig(focusOnCity["request"])
    expect(asStr(recOf(focusOnTick.recs, "m1")?.["reason"])).toBe("")
    expect(focusOnReq > focusBaseReq).toBe(true)
    const residualFocus = asBig(cfg["residual_idle_bps"])
    const linkMag = asBig(
      asDict(asDict(asDict(asDict(cfg["generated"])["buildings"])["output_links"])["city_hall"])["magnitude"],
    )
    expect(linkMag > 0n).toBe(true)
    const fusedFocus = ((bps + q) * (bps + linkMag)) / bps
    expect(focusOnReq).toBe(
      (((asBig(cfg["workshop_out"]) * fusedFocus) / bps) * (bps - residualFocus)) / bps,
    )
    const focusWrong = liveCity(cfg, pack)
    focusWrong["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    focusWrong["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_finance" }),
    ]
    focusWrong["energy_stock"] = 1_000_000n
    const linkOnly = (((asBig(cfg["workshop_out"]) * (bps + linkMag)) / bps) * (bps - residualFocus)) / bps
    expect(asBig(asDict(asDict(tickCity(cfg, focusWrong).state["cities"])["a"])["request"])).toBe(linkOnly)
    const focusBlank = liveCity(cfg, pack)
    focusBlank["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    focusBlank["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus"),
    ]
    focusBlank["energy_stock"] = 1_000_000n
    expect(asBig(asDict(asDict(tickCity(cfg, focusBlank).state["cities"])["a"])["request"])).toBe(linkOnly)
    const focusFree = liveCity(cfg, pack)
    focusFree["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    focusFree["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "m1", "manager", "", "focus", { focus: "work_production" }),
    ]
    focusFree["energy_stock"] = 1_000_000n
    expect(asBig(asDict(asDict(tickCity(cfg, focusFree).state["cities"])["a"])["request"])).toBe(focusBaseReq)
    const nightBase = liveCity(cfg, pack)
    nightBase["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    nightBase["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    nightBase["energy_stock"] = 1_000_000n
    const nightOn = liveCity(cfg, pack)
    nightOn["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    nightOn["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_production" }),
    ]
    nightOn["energy_stock"] = 1_000_000n
    const nightIdx = officeClosedTick(cfg)
    expect(asBig(asDict(asDict(tickCity(cfg, nightOn, nightIdx).state["cities"])["a"])["request"])).toBe(
      asBig(asDict(asDict(tickCity(cfg, nightBase, nightIdx).state["cities"])["a"])["request"]),
    )
    const focusTwin = liveCity(cfg, pack)
    focusTwin["functions"] = [
      { id: "workshop", level: 1n },
      { id: "city_hall", level: 1n },
      { id: "cloud_campus", level: 1n },
    ]
    focusTwin["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_production" }),
      agentRow(cfg, "m2", "manager", "cloud_campus", "focus", { focus: "work_production" }),
    ]
    focusTwin["energy_stock"] = 1_000_000n
    expect(asBig(asDict(asDict(tickCity(cfg, focusTwin).state["cities"])["a"])["request"])).toBe(focusOnReq)
    const adminOn = liveCity(cfg, pack)
    adminOn["functions"] = [{ id: "city_hall", level: 1n }]
    adminOn["agents"] = [agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_admin" })]
    adminOn["energy_stock"] = 1_000_000n
    const adminCity = asDict(asDict(tickCity(cfg, adminOn).state["cities"])["a"])
    expect(asBig(adminCity["fund_share_bps"])).toBe(q)
    const adminFat = liveCity(cfg, pack)
    adminFat["functions"] = [{ id: "city_hall", level: 1n }]
    adminFat["agents"] = [agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_admin" })]
    adminFat["nodes"] = [{ id: "n_fund", key: "fund_share_bps", magnitude: 50_000n }]
    adminFat["energy_stock"] = 1_000_000n
    const shareCap = asBig(cfg["fund_share_cap_bps"])
    expect(shareCap > 0n).toBe(true)
    expect(asBig(asDict(asDict(tickCity(cfg, adminFat).state["cities"])["a"])["fund_share_bps"])).toBe(shareCap)
    const finOn = liveCity(cfg, pack)
    finOn["functions"] = [{ id: "city_hall", level: 1n }]
    finOn["agents"] = [agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_finance" })]
    finOn["energy_stock"] = 1_000_000n
    const finCity = asDict(asDict(tickCity(cfg, finOn).state["cities"])["a"])
    expect(asBig(finCity["bank_share_bonus_bps"])).toBe(q)
    expect(asBig(finCity["fund_share_bps"])).toBe(0n)
    expect(finCity["hop_quality"]).toBe(undefined)
    expect("bank_markup_override" in finCity).toBe(false)
    const powerOff = liveCity(cfg, pack)
    powerOff["functions"] = [{ id: "power_node", level: 1n }, { id: "city_hall", level: 1n }]
    powerOff["agents"] = [agentRow(cfg, "e1", "engineer", "power_node", "produce")]
    const powerOn = liveCity(cfg, pack)
    powerOn["functions"] = [{ id: "power_node", level: 1n }, { id: "city_hall", level: 1n }]
    powerOn["agents"] = [
      agentRow(cfg, "e1", "engineer", "power_node", "produce"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_production" }),
    ]
    const powerOffStock = asBig(asDict(asDict(tickCity(cfg, powerOff).state["cities"])["a"])["energy_stock"])
    const powerOnStock = asBig(asDict(asDict(tickCity(cfg, powerOn).state["cities"])["a"])["energy_stock"])
    expect(powerOnStock > powerOffStock).toBe(true)
    expect(powerOnStock).toBe((powerOffStock * (bps + q)) / bps)
    const computeOff = liveCity(cfg, pack)
    computeOff["functions"] = [{ id: "ai_research_center", level: 1n }, { id: "city_hall", level: 1n }]
    computeOff["agents"] = [agentRow(cfg, "e1", "engineer", "ai_research_center", "produce")]
    computeOff["energy_stock"] = 1_000_000n
    const computeOn = liveCity(cfg, pack)
    computeOn["functions"] = [{ id: "ai_research_center", level: 1n }, { id: "city_hall", level: 1n }]
    computeOn["agents"] = [
      agentRow(cfg, "e1", "engineer", "ai_research_center", "produce"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_research" }),
    ]
    computeOn["energy_stock"] = 1_000_000n
    const computeOffStock = asBig(asDict(asDict(tickCity(cfg, computeOff).state["cities"])["a"])["compute_stock"])
    const computeOnStock = asBig(asDict(asDict(tickCity(cfg, computeOn).state["cities"])["a"])["compute_stock"])
    expect(computeOnStock > computeOffStock).toBe(true)
    expect(computeOnStock).toBe((computeOffStock * (bps + q)) / bps)
    const logiOff = liveCity(cfg, pack)
    logiOff["functions"] = [
      { id: "workshop", level: 1n },
      { id: "logistics_hub", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    logiOff["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "l1", "logistician", "logistics_hub", "route"),
    ]
    logiOff["energy_stock"] = 1_000_000n
    const logiOn = liveCity(cfg, pack)
    logiOn["functions"] = [
      { id: "workshop", level: 1n },
      { id: "logistics_hub", level: 1n },
      { id: "city_hall", level: 1n },
    ]
    logiOn["agents"] = [
      agentRow(cfg, "e1", "engineer", "workshop", "produce"),
      agentRow(cfg, "l1", "logistician", "logistics_hub", "route"),
      agentRow(cfg, "m1", "manager", "city_hall", "focus", { focus: "work_logistics" }),
    ]
    logiOn["energy_stock"] = 1_000_000n
    const logiOffDraw = asBig(asDict(asDict(tickCity(cfg, logiOff).state["cities"])["a"])["energy_draw"])
    const logiOnDraw = asBig(asDict(asDict(tickCity(cfg, logiOn).state["cities"])["a"])["energy_draw"])
    expect(logiOffDraw > 0n).toBe(true)
    expect(logiOnDraw < logiOffDraw).toBe(true)
    const cities: Dict = {}
    let n = 0n
    while (n < 200n) {
      const id = "c" + n.toString()
      const row = liveCity(cfg, pack, id)
      row["functions"] = [{ id: "workshop", level: 1n }]
      row["agents"] = [agentRow(cfg, "e" + n.toString(), "engineer", "workshop", "produce")]
      cities[id] = row
      n += 1n
    }
    const crowd = newState(cfg, cities, {})
    armFund(crowd, cfg, 200n)
    const crowdTick = tick(crowd, makeInputs(cfg, 0n))
    const crowdRatio = asBig(crowdTick[0]["payroll_ratio_bps"])
    expect(crowdRatio < asBig(cfg["bps"])).toBe(true)
    expect(crowdRatio <= asBig(cfg["payroll_boost_launch_bps"])).toBe(true)
    let paidAgents = 0
    for (const rec of crowdTick[1]) {
      if (asStr(rec["reason"]) !== "") continue
      if (asBig(rec["output"]) > 0n) paidAgents += 1
    }
    expect(paidAgents > 0).toBe(true)
    const empty = newState(cfg, {}, {})
    expect(mintFromBacking(cfg, empty, 0n, 0n, 0n, "fund")).toBe(0n)
    expect(() => mintFromBacking(cfg, empty, 0n, 0n, 0n, "probe_forbidden")).toThrow()
    const bags = newState(cfg, { a: liveCity(cfg, pack) }, {})
    const wei = asBig(cfg["wei"])
    mintFromBacking(cfg, bags, wei, 0n, 0n, "fund")
    const bagsCity = asDict(asDict(bags["cities"])["a"])
    const cap = asBig(bags["vault_corp"]) * asBig(cfg["capital_anchor"])
    bagsCity["capital"] = cap + 1n
    expect(() => applySpend(cfg, bags, bagsCity, 1n, 0n)).toThrow()
    const lonePlain = liveCity(cfg, pack)
    lonePlain["functions"] = [{ id: "workshop", level: 1n }]
    lonePlain["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    lonePlain["energy_stock"] = 1_000_000n
    const loneShare = liveCity(cfg, pack)
    loneShare["functions"] = [{ id: "workshop", level: 1n }]
    loneShare["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    loneShare["energy_stock"] = 1_000_000n
    loneShare["nodes"] = [{ id: "n_fund", key: "fund_share_bps", magnitude: 2500n }]
    const lonePlainTick = tickCity(cfg, lonePlain)
    const loneShareTick = tickCity(cfg, loneShare)
    const lonePlainPay = asBig(asDict(asDict(lonePlainTick.state["cities"])["a"])["capital"])
    const loneSharePay = asBig(asDict(asDict(loneShareTick.state["cities"])["a"])["capital"])
    expect(loneSharePay).toBe(lonePlainPay)
    expect(loneSharePay > 0n).toBe(true)
    expect(asBig(loneShareTick.state["payroll_ratio_bps"])).toBe(asBig(lonePlainTick.state["payroll_ratio_bps"]))
    const peerA = liveCity(cfg, pack, "a")
    peerA["functions"] = [{ id: "workshop", level: 1n }]
    peerA["agents"] = [agentRow(cfg, "ea", "engineer", "workshop", "produce")]
    peerA["energy_stock"] = 1_000_000n
    const peerB = liveCity(cfg, pack, "b")
    peerB["functions"] = [{ id: "workshop", level: 1n }]
    peerB["agents"] = [agentRow(cfg, "eb", "engineer", "workshop", "produce")]
    peerB["energy_stock"] = 1_000_000n
    peerB["nodes"] = [{ id: "n_fund", key: "fund_share_bps", magnitude: 2500n }]
    const peers = newState(cfg, { a: peerA, b: peerB }, {})
    armFund(peers, cfg, 2000n)
    const peerTick = tick(peers, makeInputs(cfg, 0n))
    const peerCapA = asBig(asDict(asDict(peerTick[0]["cities"])["a"])["capital"])
    const peerCapB = asBig(asDict(asDict(peerTick[0]["cities"])["b"])["capital"])
    expect(peerCapA > 0n).toBe(true)
    expect(peerCapB > peerCapA).toBe(true)
    expect(peerCapA + peerCapB <= asBig(peerTick[0]["tick_budget"])).toBe(true)
    const twinA = liveCity(cfg, pack, "a")
    twinA["functions"] = [{ id: "workshop", level: 1n }]
    twinA["agents"] = [agentRow(cfg, "ea", "engineer", "workshop", "produce")]
    twinA["energy_stock"] = 1_000_000n
    twinA["nodes"] = [{ id: "n_fund", key: "fund_share_bps", magnitude: 2500n }]
    const twinB = liveCity(cfg, pack, "b")
    twinB["functions"] = [{ id: "workshop", level: 1n }]
    twinB["agents"] = [agentRow(cfg, "eb", "engineer", "workshop", "produce")]
    twinB["energy_stock"] = 1_000_000n
    twinB["nodes"] = [{ id: "n_fund", key: "fund_share_bps", magnitude: 2500n }]
    const twins = newState(cfg, { a: twinA, b: twinB }, {})
    armFund(twins, cfg, 2000n)
    const twinTick = tick(twins, makeInputs(cfg, 0n))
    expect(asBig(asDict(asDict(twinTick[0]["cities"])["a"])["capital"])).toBe(
      asBig(asDict(asDict(twinTick[0]["cities"])["b"])["capital"]),
    )
    const shop = liveCity(cfg, pack)
    shop["functions"] = [{ id: "workshop", level: 1n }]
    shop["agents"] = [agentRow(cfg, "e1", "engineer", "workshop", "produce")]
    shop["energy_stock"] = 1_000_000n
    const shopTick = tickCity(cfg, shop)
    expect(asStr(recOf(shopTick.recs, "e1")?.["reason"])).toBe("")
    expect(asBig(asDict(asDict(shopTick.state["cities"])["a"])["fragments"])).toBe(0n)
    const plant = liveCity(cfg, pack)
    plant["functions"] = [{ id: "energy_plant", level: 1n }]
    plant["agents"] = [agentRow(cfg, "e2", "engineer", "energy_plant", "produce")]
    const plantTick = tickCity(cfg, plant)
    const plantCity = asDict(asDict(plantTick.state["cities"])["a"])
    expect(asStr(recOf(plantTick.recs, "e2")?.["reason"])).toBe("")
    expect(asBig(plantCity["fragments"]) > 0n).toBe(true)
    expect(asBig(asDict(plantCity["fragment_ledger"])["TSLA"])).toBe(asBig(plantCity["fragments"]))
    const dry = liveCity(cfg, pack)
    dry["functions"] = [{ id: "ai_research_center", level: 1n }]
    dry["agents"] = [agentRow(cfg, "e3", "engineer", "ai_research_center", "produce")]
    dry["energy_stock"] = 0n
    const dryTick = tickCity(cfg, dry)
    expect(asStr(recOf(dryTick.recs, "e3")?.["reason"])).toBe(asStr(cfg["idle_energy"]))
    expect(asBig(asDict(asDict(dryTick.state["cities"])["a"])["fragments"])).toBe(0n)
    const lab = liveCity(cfg, pack)
    lab["functions"] = [{ id: "ai_research_center", level: 1n }]
    lab["agents"] = [agentRow(cfg, "e4", "engineer", "ai_research_center", "produce")]
    lab["energy_stock"] = 1_000_000n
    const labTick = tickCity(cfg, lab)
    const labCity = asDict(asDict(labTick.state["cities"])["a"])
    expect(asStr(recOf(labTick.recs, "e4")?.["reason"])).toBe("")
    expect(asBig(labCity["fragments"]) > 0n).toBe(true)
    expect(asBig(asDict(labCity["fragment_ledger"])["NVDA"])).toBe(asBig(labCity["fragments"]))
    const two = liveCity(cfg, pack)
    two["functions"] = [
      { id: "energy_plant", level: 1n },
      { id: "ai_research_center", level: 1n },
    ]
    two["agents"] = [
      agentRow(cfg, "p1", "engineer", "energy_plant", "produce"),
      agentRow(cfg, "c1", "engineer", "ai_research_center", "produce"),
    ]
    two["energy_stock"] = 1_000_000n
    const twoCity = asDict(asDict(tickCity(cfg, two).state["cities"])["a"])
    const twoLed = asDict(twoCity["fragment_ledger"])
    expect(asBig(twoLed["TSLA"]) > 0n).toBe(true)
    expect(asBig(twoLed["NVDA"]) > 0n).toBe(true)
    expect(asBig(twoCity["fragments"])).toBe(asBig(twoLed["TSLA"]) + asBig(twoLed["NVDA"]))
    const iced = liveCity(cfg, pack)
    iced["functions"] = [{ id: "energy_plant", level: 1n }]
    iced["agents"] = [agentRow(cfg, "e5", "engineer", "energy_plant", "produce")]
    iced["district_freeze_until"] = { TSLA: 1n }
    expect(asBig(asDict(asDict(tickCity(cfg, iced).state["cities"])["a"])["fragments"])).toBe(0n)
    const site = liveCity(cfg, pack)
    site["functions"] = [{ id: "energy_plant", level: 1n, construction: 4n }]
    site["agents"] = [agentRow(cfg, "e6", "engineer", "energy_plant", "produce")]
    expect(asBig(asDict(asDict(tickCity(cfg, site).state["cities"])["a"])["fragments"])).toBe(0n)
    const wrong = liveCity(cfg, pack)
    wrong["functions"] = [{ id: "energy_plant", level: 1n }]
    wrong["agents"] = [agentRow(cfg, "t9", "trader", "energy_plant", "desk")]
    expect(asBig(asDict(asDict(tickCity(cfg, wrong).state["cities"])["a"])["fragments"])).toBe(0n)
    const syn = liveCity(cfg, pack)
    syn["functions"] = [{ id: "robotics_lab", level: 1n }]
    syn["agents"] = [agentRow(cfg, "e9", "engineer", "robotics_lab", "produce")]
    syn["energy_stock"] = 1_000_000n
    expect(asBig(asDict(asDict(tickCity(cfg, syn).state["cities"])["a"])["fragments"])).toBe(0n)
    const rated = liveCity(cfg, pack)
    rated["functions"] = [{ id: "energy_plant", level: 1n }]
    rated["agents"] = [agentRow(cfg, "e7", "engineer", "energy_plant", "produce")]
    rated["nodes"] = [{ key: "fragment_rate_bps", magnitude: 1500n }]
    const ratedFr = asBig(asDict(asDict(tickCity(cfg, rated).state["cities"])["a"])["fragments"])
    expect(ratedFr).toBe((asBig(plantCity["fragments"]) * 11500n) / 10000n)
    const broke = liveCity(cfg, pack)
    broke["functions"] = [{ id: "energy_plant", level: 1n }]
    broke["agents"] = [agentRow(cfg, "e8", "engineer", "energy_plant", "produce")]
    const brokeState = newState(cfg, { a: broke }, {})
    brokeState["fund"] = 0n
    brokeState["tick_budget"] = 0n
    brokeState["day_budget"] = 0n
    const brokeTick = tick(brokeState, makeInputs(cfg, 0n, { city_id: "a" }))
    const brokeCity = asDict(asDict(brokeTick[0]["cities"])["a"])
    expect(asBig(brokeCity["payout"])).toBe(0n)
    expect(asBig(brokeCity["fragments"]) > 0n).toBe(true)
    const defs = asDict(asDict(asDict(cfg["data"])["buildings"])["buildings"])
    const t3 = liveCity(cfg, pack)
    t3["building"] = {
      ...asDict(defs["ai_research_center"]),
      id: "ai_research_center",
      level: 1n,
    }
    const t3City = asDict(asDict(tickCity(cfg, t3).state["cities"])["a"])
    expect(asBig(t3City["fragments"]) > 0n).toBe(true)
    expect(asBig(asDict(t3City["fragment_ledger"])["NVDA"])).toBe(asBig(t3City["fragments"]))
    const t3shop = liveCity(cfg, pack)
    t3shop["building"] = { ...asDict(defs["workshop"]), id: "workshop", level: 1n }
    expect(asBig(asDict(asDict(tickCity(cfg, t3shop).state["cities"])["a"])["fragments"])).toBe(0n)
  })
})

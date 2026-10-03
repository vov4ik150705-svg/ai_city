import { tickJitterBps } from "./arith.js"
import { n2 } from "./literals.js"
import { applyStack } from "./stack.js"
import { seededPrng } from "./state.js"
import { asBig, asDict, asList, asStr, sortedKeys } from "./values.js"
import type { Dict } from "./values.js"
import { trainTargetOk, trainTargetOf } from "./xp.js"

export function cityUsesSlots(city: Dict): boolean {
  return "functions" in city || "agents" in city
}

export function tickerFrozen(city: Dict, ticker: string, cityTime: bigint): boolean {
  if (ticker.length === 0) return false
  const until = asBig(asDict(city["district_freeze_until"])[ticker])
  return until > 0n && cityTime >= until
}

function districtTickerOf(cfg: Dict, districtId: string): string {
  if (districtId.length === 0) return ""
  const bag = asDict(asDict(asDict(cfg["data"])["districts"])["districts"])
  return asStr(asDict(bag[districtId])["ticker"])
}

function nodeDistrictId(cfg: Dict, node: Dict): string {
  const id = asStr(node["id"])
  if (id.length === 0) return ""
  const prog = asDict(asDict(cfg["generated"])["progression"])
  const fromNode = asStr(asDict(asDict(prog["progression_nodes"])[id])["district"])
  if (fromNode.length > 0) return fromNode
  return asStr(asDict(asDict(prog["progression_dividends"])[id])["district"])
}

export function buildingDistrictIds(cfg: Dict, bid: string): readonly string[] {
  const def = buildingDef(cfg, bid)
  const one = asStr(def["district"])
  if (one.length > 0) return [one]
  const syn = asDict(asDict(asDict(cfg["data"])["districts"])["synergies"])
  const out: string[] = []
  for (const raw of asList(asDict(syn[bid])["requires"])) {
    if (typeof raw === "string" && raw.length > 0) out.push(raw)
  }
  return out
}

function buildingWeatherBps(cfg: Dict, city: Dict, bid: string, bps: bigint): bigint {
  const ids = buildingDistrictIds(cfg, bid)
  if (ids.length === 0) return bps
  const slots = asDict(city["district_efficiency"])
  let total = 0n
  let n = 0n
  for (const did of ids) {
    const eff = asBig(asDict(slots[did])["efficiency_bps"])
    total += eff > 0n ? eff : bps
    n += 1n
  }
  if (n <= 1n) return total
  return total / n
}

export function buildingDistrictFrozen(cfg: Dict, city: Dict, bid: string, cityTime: bigint): boolean {
  for (const did of buildingDistrictIds(cfg, bid)) {
    if (tickerFrozen(city, districtTickerOf(cfg, did), cityTime)) return true
  }
  return false
}

function researchUnlocked(city: Dict): Set<string> {
  const out = new Set<string>()
  for (const x of asList(city["research_unlocked"])) {
    if (typeof x === "string" && x.length > 0) out.add(x)
  }
  return out
}

function researchMagnitude(cfg: Dict, nodeId: string): bigint {
  return asBig(asDict(asDict(cfg["research_nodes"])[nodeId])["effect_bps"])
}

function applyHandbookXp(cfg: Dict, city: Dict): void {
  if (!researchUnlocked(city).has("handbook")) {
    delete city["xp_rate_mags"]
    return
  }
  const mag = researchMagnitude(cfg, "handbook")
  if (mag > 0n) city["xp_rate_mags"] = [mag]
  else delete city["xp_rate_mags"]
}

function withResearchCosts(cfg: Dict, city: Dict, rows: readonly Dict[]): Dict[] {
  const unlocked = researchUnlocked(city)
  const out: Dict[] = []
  for (const row of rows) out.push(row)
  if (unlocked.has("grid")) {
    const mag = researchMagnitude(cfg, "grid")
    if (mag !== 0n) out.push({ key: "energy_cost_bps", magnitude: mag })
  }
  if (unlocked.has("circuits")) {
    const mag = researchMagnitude(cfg, "circuits")
    if (mag !== 0n) out.push({ key: "compute_cost_bps", magnitude: mag })
  }
  return out
}

function latheModifierRows(cfg: Dict, city: Dict): Dict[] {
  if (!researchUnlocked(city).has("lathe")) return []
  const mag = researchMagnitude(cfg, "lathe")
  if (mag === 0n) return []
  return [{ key: "upgrade_speed_bps", magnitude: mag }]
}

/** Upgrade construction ticks. First build keeps the pack table. Lathe and live depth fuse. */
export function constructionTicks(cfg: Dict, city: Dict, base: bigint, cityTime: bigint = 0n): bigint {
  if (base <= 0n) return 0n
  const bps = asBig(cfg["bps"])
  const clipped = keyClipped(cfg, city, latheModifierRows(cfg, city), "upgrade_speed_bps", bps, cityTime)
  if (clipped <= 0n) return base
  const scaled = (base * bps) / clipped
  return scaled < 1n ? 1n : scaled
}

export function liveModifierNodes(cfg: Dict, city: Dict, cityTime: bigint): Dict[] {
  const rows: Dict[] = []
  for (const raw of asList(city["nodes"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const node = asDict(raw)
    const did = nodeDistrictId(cfg, node)
    if (did.length > 0 && tickerFrozen(city, districtTickerOf(cfg, did), cityTime)) continue
    rows.push(node)
  }
  return rows
}

export function payrollModifierRows(rows: readonly Dict[]): Dict[] {
  const out: Dict[] = []
  for (const r of rows) {
    if (asStr(r["key"]) === "output_bps") out.push(r)
  }
  return out
}

export function scaleByModifierKey(
  cfg: Dict,
  city: Dict,
  key: string,
  value: bigint,
  cityTime: bigint,
): bigint {
  if (value <= 0n) return value
  const bps = asBig(cfg["bps"])
  const clipped = keyClipped(cfg, city, [], key, bps, cityTime)
  if (clipped <= 0n) return value
  return (value * clipped) / bps
}

export function tagDistrictFrozen(city: Dict, cityTime: bigint): void {
  const freeze = asDict(city["district_freeze_until"])
  let frozen = false
  for (const ticker of Object.keys(freeze)) {
    if (tickerFrozen(city, ticker, cityTime)) {
      frozen = true
      break
    }
  }
  if (!frozen) return
  const codes = asList(city["codes"]).map((x) => asStr(x))
  if (codes.includes("DISTRICT_FROZEN")) return
  city["codes"] = [...codes, "DISTRICT_FROZEN"]
}

function clockFromCityTime(cfg: Dict, cityTime: bigint): readonly [bigint, bigint] {
  const ticksDay = asBig(cfg["ticks_day"])
  const hour = ticksDay === 0n ? 0n : cityTime % ticksDay
  const dayOffset = ticksDay === 0n ? 0n : cityTime / ticksDay
  const week = asBig(cfg["city_week_days"])
  const weekday = week === 0n ? 1n : ((asBig(cfg["anchor_weekday"]) - 1n + dayOffset) % week) + 1n
  return [hour, weekday]
}

export function applyCityScope(cfg: Dict, city: Dict, cityTime: bigint = 0n): void {
  const data = asDict(cfg["data"])
  const bps = asBig(cfg["bps"])
  const rows = liveModifierNodes(cfg, city, cityTime)
  let addSlots = 0n
  let addOffline = 0n
  let addShare = 0n
  if (rows.length > 0 && Object.keys(data).length > 0) {
    const stack = applyStack(data, rows, bps)
    const byKey = asDict(stack["by_key"])
    addSlots = asBig(asDict(byKey["agent_slots"])["clipped"])
    addOffline = asBig(asDict(byKey["offline_cap_hours"])["clipped"])
    addShare = asBig(asDict(byKey["fund_share_bps"])["clipped"])
  }
  const packSlots = asDict(cfg["slots_at_city_level"])
  const levelKey = asBig(city["city_level"], 1n).toString()
  let slots = asBig(packSlots[levelKey], asBig(cfg["slots_start"]))
  slots += addSlots
  const cap = asBig(cfg["slots_cap"])
  if (cap > 0n && slots > cap) slots = cap
  if (slots < 0n) slots = 0n
  city["agent_slots"] = slots
  city["offline_cap_hours"] = addOffline
  const q = asBig(cfg["node_effect_base_bps"])
  const clock = clockFromCityTime(cfg, cityTime)
  const focuses = liveFocusContours(cfg, city, clock[0], clock[1], cityTime)
  if (focuses.has("work_admin") && q > 0n) addShare += q
  const shareCap = asBig(cfg["fund_share_cap_bps"])
  if (shareCap > 0n && addShare > shareCap) addShare = shareCap
  city["fund_share_bps"] = addShare
  if (focuses.has("work_finance") && q > 0n) city["bank_share_bonus_bps"] = q
  else delete city["bank_share_bonus_bps"]
  let bank = 1n
  const maxBank = asBig(cfg["bank_level_max"], 1n)
  for (const raw of asList(city["functions"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const fn = asDict(raw)
    if (fnBlocked(fn)) continue
    if (asStr(fn["id"]) !== "finance_tower") continue
    if (buildingDistrictFrozen(cfg, city, "finance_tower", cityTime)) continue
    const lv = asBig(fn["level"], 1n)
    if (lv > bank) bank = lv
  }
  if (bank > maxBank) bank = maxBank
  city["bank_level"] = bank
  tagDistrictFrozen(city, cityTime)
  applyHandbookXp(cfg, city)
}

function curveAt(table: Dict, bid: string, level: bigint): bigint {
  const rows = asList(table[bid])
  if (rows.length === 0) return 0n
  let i = Number(level < 1n ? 1n : level)
  if (i > rows.length) i = rows.length
  return asBig(rows[i - 1])
}

function affinityCell(cfg: Dict, bid: string, role: string): string {
  const matrixWrap = asDict(cfg["affinity_matrix"])
  const matrix = asDict(matrixWrap["matrix"])
  const roles: string[] = []
  for (const item of asList(matrixWrap["roles"])) {
    if (typeof item === "string") roles.push(item)
  }
  const row = asList(matrix[bid])
  const idx = roles.indexOf(role)
  if (idx < 0 || idx >= row.length) return "none"
  return asStr(row[idx], "none")
}

function affinityBps(cfg: Dict, cell: string): bigint {
  if (cell === "home") return asBig(cfg["affinity_home_bps"])
  if (cell === "neighbour") return asBig(cfg["affinity_neighbour_bps"])
  if (cell === "accepted") return asBig(cfg["affinity_accepted_bps"])
  return 0n
}

function scheduleOpen(cfg: Dict, scheduleId: string, hour: bigint, weekday: bigint): readonly [bigint, string] {
  const schedules = asDict(cfg["schedules"])
  let sch = asDict(schedules[scheduleId])
  if (Object.keys(sch).length === 0) sch = asDict(schedules["always"])
  for (const x of asList(sch["closed_weekdays"])) {
    if (asBig(x) === weekday) return [0n, asStr(cfg["idle_hours"])]
  }
  if (hour < asBig(sch["open_hour"]) || hour >= asBig(sch["close_hour"])) {
    return [0n, asStr(cfg["idle_hours"])]
  }
  return [1n, ""]
}

function bankOpen(cfg: Dict, hour: bigint, weekday: bigint): bigint {
  if (weekday === asBig(cfg["bank_closed_weekday"])) return 0n
  if (hour < asBig(cfg["bank_open_hour"]) || hour >= asBig(cfg["bank_close_hour"])) return 0n
  return 1n
}

function isNight(cfg: Dict, hour: bigint): boolean {
  const dawn = asBig(cfg["dawn_hour"], asBig(cfg["bank_open_hour"]))
  const night = asBig(cfg["night_hour"], asBig(cfg["bank_close_hour"]))
  return hour >= night || hour < dawn
}

function fnBlocked(item: Dict): boolean {
  if (asBig(item["deactivated"]) > 0n || item["deactivated"] === true) return true
  if (asBig(item["frozen"]) > 0n || item["frozen"] === true) return true
  return false
}

function fnActive(item: Dict): boolean {
  if (fnBlocked(item)) return false
  if (asBig(item["construction"]) > 0n || item["construction"] === true) return false
  return true
}

function underConstruction(item: Dict): boolean {
  return asBig(item["construction"]) > 0n || item["construction"] === true
}

function agentOf(city: Dict, bid: string): Dict | undefined {
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    if (asStr(agent["building_id"]) === bid) return agent
  }
  return undefined
}

function outputPhase(cfg: Dict, city: Dict, bid: string): number {
  const kind = buildingDef(cfg, bid)["output"]
  if (kind === "energy") return 0
  if (kind === "compute") {
    const agent = agentOf(city, bid)
    if (agent === undefined) return 1
    if (asStr(agent["role"]) === "engineer") return 1
    return n2
  }
  return n2
}

function buildingDef(cfg: Dict, bid: string): Dict {
  const data = asDict(cfg["data"])
  return asDict(asDict(asDict(data["buildings"])["buildings"])[bid])
}

function functionOf(city: Dict, bid: string): Dict | undefined {
  for (const raw of asList(city["functions"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const fn = asDict(raw)
    if (asStr(fn["id"]) === bid) return fn
  }
  return undefined
}

function outputLinksOf(cfg: Dict): Dict {
  return asDict(asDict(asDict(cfg["generated"])["buildings"])["output_links"])
}

function contoursOf(bdef: Dict): Set<string> {
  const out = new Set<string>()
  const a = asStr(bdef["contour"])
  const b = asStr(bdef["contour_secondary"])
  if (a.length > 0) out.add(a)
  if (b.length > 0) out.add(b)
  return out
}

function contoursOverlap(a: Dict, b: Dict): boolean {
  const left = contoursOf(a)
  for (const x of contoursOf(b)) {
    if (left.has(x)) return true
  }
  return false
}

function linkTargetHits(
  cfg: Dict,
  emitterDef: Dict,
  recipientDef: Dict,
  recipientBid: string,
  target: string,
): boolean {
  const out = recipientDef["output"]
  if (target === "contour_table") {
    return out === "capital" && contoursOverlap(emitterDef, recipientDef)
  }
  if (target === "contour_pay") {
    return (out === "capital" || out === "capital_from_population") && contoursOverlap(emitterDef, recipientDef)
  }
  if (target === "compute_table") {
    if (out !== "capital") return false
    const row = asList(asDict(asDict(asDict(cfg["generated"])["balance"])["level_compute"])[recipientBid])
    if (row.length === 0) return false
    return asBig(row[0]) > 0n
  }
  if (target === "engineer_table") {
    if (out !== "capital") return false
    const cell = affinityCell(cfg, recipientBid, "engineer")
    return cell === "home" || cell === "neighbour"
  }
  if (target === "population") return out === "capital_from_population"
  if (target === "any_pay") return out === "capital" || out === "capital_from_population"
  if (target === "autonomous_table") return out === "capital" && recipientDef["autonomous"] === true
  return false
}

function outputLinkEmitterLive(
  cfg: Dict,
  city: Dict,
  bid: string,
  hour: bigint,
  weekday: bigint,
  cityTime: bigint,
  requireRole: string,
): boolean {
  const fn = functionOf(city, bid)
  if (fn === undefined || fnBlocked(fn) || underConstruction(fn)) return false
  if (buildingDistrictFrozen(cfg, city, bid, cityTime)) return false
  const schId = asStr(buildingDef(cfg, bid)["schedule"], "always")
  if (scheduleOpen(cfg, schId, hour, weekday)[0] === 0n) return false
  if (bid === "bank" && bankOpen(cfg, hour, weekday) === 0n) return false
  if (requireRole.length === 0) return false
  const agent = agentOf(city, bid)
  if (agent === undefined) return false
  if (asStr(agent["role"]) !== requireRole) return false
  if (affinityCell(cfg, bid, requireRole) === "none") return false
  return true
}

function liveOutputLinkIds(
  cfg: Dict,
  city: Dict,
  hour: bigint,
  weekday: bigint,
  cityTime: bigint,
): Set<string> {
  const live = new Set<string>()
  const links = outputLinksOf(cfg)
  for (const bid of sortedKeys(links)) {
    const spec = asDict(links[bid])
    if (outputLinkEmitterLive(cfg, city, bid, hour, weekday, cityTime, asStr(spec["require_role"]))) {
      live.add(bid)
    }
  }
  return live
}

function outputLinkRows(
  cfg: Dict,
  recipientBid: string,
  recipientDef: Dict,
  liveIds: ReadonlySet<string>,
): Dict[] {
  const links = outputLinksOf(cfg)
  const matching: { mag: bigint; bid: string; excl: string[] }[] = []
  for (const bid of sortedKeys(links)) {
    if (!liveIds.has(bid)) continue
    const spec = asDict(links[bid])
    const emitterDef = buildingDef(cfg, bid)
    if (!linkTargetHits(cfg, emitterDef, recipientDef, recipientBid, asStr(spec["target"]))) continue
    const excl: string[] = []
    for (const x of asList(spec["exclusive_with"])) {
      if (typeof x === "string" && x.length > 0) excl.push(x)
    }
    matching.push({ mag: asBig(spec["magnitude"]), bid, excl })
  }
  matching.sort((a, b) => {
    if (a.mag > b.mag) return -1
    if (a.mag < b.mag) return 1
    if (a.bid < b.bid) return -1
    if (a.bid > b.bid) return 1
    return 0
  })
  const taken = new Set<string>()
  const rows: Dict[] = []
  for (const row of matching) {
    let blocked = false
    for (const partner of row.excl) {
      if (taken.has(partner)) {
        blocked = true
        break
      }
    }
    if (blocked || row.mag <= 0n) continue
    rows.push({ key: "output_bps", magnitude: row.mag })
    taken.add(row.bid)
  }
  return rows
}

function packContours(cfg: Dict): Set<string> {
  return new Set(Object.keys(asDict(asDict(asDict(cfg["data"])["agents"])["contours"])))
}

function focusScale(value: bigint, cfg: Dict, remainder: boolean = false): bigint {
  const q = asBig(cfg["node_effect_base_bps"])
  const bps = asBig(cfg["bps"])
  if (value <= 0n || q <= 0n) return value
  const delta = remainder ? -q : q
  return (value * (bps + delta)) / bps
}

function contourFocused(bdef: Dict, focuses: ReadonlySet<string>): boolean {
  const contour = asStr(bdef["contour"])
  return contour.length > 0 && focuses.has(contour)
}

function liveFocusContours(
  cfg: Dict,
  city: Dict,
  hour: bigint,
  weekday: bigint,
  cityTime: bigint,
): Set<string> {
  const allowed = packContours(cfg)
  const out = new Set<string>()
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    if (asStr(agent["role"]) !== "manager") continue
    if (asStr(agent["objective"]) !== "focus") continue
    const contour = asStr(agent["focus"])
    if (contour.length === 0 || !allowed.has(contour)) continue
    const bid = asStr(agent["building_id"])
    if (bid.length === 0) continue
    const fn = functionOf(city, bid)
    if (fn === undefined || fnBlocked(fn) || underConstruction(fn)) continue
    if (buildingDistrictFrozen(cfg, city, bid, cityTime)) continue
    if (affinityCell(cfg, bid, "manager") === "none") continue
    const schId = asStr(buildingDef(cfg, bid)["schedule"], "always")
    if (scheduleOpen(cfg, schId, hour, weekday)[0] === 0n) continue
    if (bid === "bank" && bankOpen(cfg, hour, weekday) === 0n) continue
    out.add(contour)
  }
  return out
}

function modifierRows(cfg: Dict, agent: Dict | undefined, cell: string, night: boolean): Dict[] {
  if (agent === undefined) return []
  const traits = new Set<string>()
  for (const t of asList(agent["traits"])) {
    if (typeof t === "string") traits.add(t)
  }
  const objective = asStr(agent["objective"])
  const out: Dict[] = []
  const rowsMap = asDict(cfg["modifier_rows"])
  for (const rid of sortedKeys(rowsMap)) {
    const spec = asDict(rowsMap[rid])
    const source = asStr(spec["source"])
    const kind = asStr(spec["source_kind"])
    const when = asStr(spec["applies_when"], "always")
    if (kind === "trait" && !traits.has(source)) continue
    if (kind === "objective" && source !== objective) continue
    if (kind !== "trait" && kind !== "objective") continue
    // Night Owl's pack row is folded into night_owl_effective_premium_bps; applying both would double-count.
    if (when === "night") continue
    if (when === "affinity_home" && cell !== "home") continue
    if (when === "affinity_not_home" && cell === "home") continue
    void night
    out.push({ key: asStr(spec["key"]), magnitude: asBig(spec["magnitude"]) })
  }
  return out
}

function stackedModifierRows(cfg: Dict, city: Dict, rows: readonly Dict[], cityTime: bigint): Dict[] {
  const stacked = liveModifierNodes(cfg, city, cityTime)
  for (const r of rows) stacked.push(r)
  return stacked
}

function applyMul(draw: bigint, clipped: bigint, bps: bigint): bigint {
  if (draw <= 0n || clipped <= 0n) return draw
  return (draw * clipped) / bps
}

function fuse(cfg: Dict, rows: readonly Dict[], city: Dict, bps: bigint, cityTime: bigint): readonly [bigint, Dict] {
  const stage: Dict = { base: bps, post: bps }
  const stacked = payrollModifierRows(stackedModifierRows(cfg, city, rows, cityTime))
  if (stacked.length === 0) return [asBig(city["mod_bps"], bps), stage]
  const data = asDict(cfg["data"])
  if (Object.keys(data).length === 0) return [asBig(city["mod_bps"], bps), stage]
  const stack = applyStack(data, stacked, bps)
  return [asBig(stack["fused_bps"]), asDict(stack["stage_bps"])]
}

function keyClipped(
  cfg: Dict,
  city: Dict,
  rows: readonly Dict[],
  key: string,
  bps: bigint,
  cityTime: bigint,
): bigint {
  const stacked = stackedModifierRows(cfg, city, rows, cityTime)
  if (stacked.length === 0) return 0n
  const data = asDict(cfg["data"])
  if (Object.keys(data).length === 0) return 0n
  const stack = applyStack(data, stacked, bps)
  return asBig(asDict(asDict(stack["by_key"])[key])["clipped"])
}

function researchFocusLive(cfg: Dict, city: Dict): boolean {
  const focus = asStr(city["research_focus"])
  if (focus.length === 0) return false
  const times = asDict(cfg["research_time_ticks"])
  if (!(focus in times)) return false
  for (const x of asList(city["research_unlocked"])) {
    if (asStr(x) === focus) return false
  }
  return true
}

function consume(city: Dict, stockKey: string, draw: bigint): bigint {
  if (!(stockKey in city)) {
    if (stockKey === "energy_stock") return asBig(city["energy_ok"]) > 0n ? 1n : 0n
    return 0n
  }
  if (asBig(city[stockKey]) < draw) return 0n
  city[stockKey] = asBig(city[stockKey]) - draw
  return 1n
}

function restore(city: Dict, stockKey: string, draw: bigint): void {
  if (draw <= 0n || !(stockKey in city)) return
  city[stockKey] = asBig(city[stockKey]) + draw
}

function logisticianRelief(
  cfg: Dict,
  city: Dict,
  hour: bigint,
  weekday: bigint,
  bps: bigint,
  cityTime: bigint,
): bigint {
  let relief = 0n
  let chainOpen = false
  for (const raw of asList(city["functions"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const fn = asDict(raw)
    if (!fnActive(fn)) continue
    const bid = asStr(fn["id"])
    if (buildingDistrictFrozen(cfg, city, bid, cityTime)) continue
    if (buildingDef(cfg, bid)["output"] === "idle_reduction") chainOpen = true
  }
  const local = new Set(["workshop", "power_node", "energy_plant"])
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    if (asStr(agent["role"]) !== "logistician") continue
    const bid = asStr(agent["building_id"])
    if (bid.length === 0) continue
    if (!chainOpen && !local.has(bid)) continue
    const bdef = buildingDef(cfg, bid)
    const schId = asStr(bdef["schedule"], "always")
    const opened = scheduleOpen(cfg, schId, hour, weekday)
    if (opened[0] === 0n) continue
    const cell = affinityCell(cfg, bid, "logistician")
    if (cell === "none") continue
    const night = isNight(cfg, hour) && asDict(asDict(cfg["schedules"])[schId])["night_energy_premium"] === true
    const mrows = modifierRows(cfg, agent, cell, night)
    const idleKey = keyClipped(cfg, city, mrows, "idle_reduction_bps", bps, cityTime)
    if (idleKey > 0n && (relief === 0n || idleKey < relief)) relief = idleKey
  }
  if (relief > bps) relief = bps
  return relief
}

function traitSet(agent: Dict | undefined): Set<string> {
  const out = new Set<string>()
  if (agent === undefined) return out
  for (const t of asList(agent["traits"])) {
    if (typeof t === "string") out.add(t)
  }
  return out
}

export function collectSlotRequests(
  cfg: Dict,
  state: Dict,
  city: Dict,
  cid: string,
  hour: bigint,
  weekday: bigint,
  hap: bigint,
): Dict[] {
  const bps = asBig(cfg["bps"])
  const jitterOn = asBig(state["jitter_on"])
  const genBal = asDict(asDict(cfg["generated"])["balance"])
  const levelOut = asDict(genBal["level_output"])
  const levelEnergy = asDict(genBal["level_energy"])
  const levelCompute = asDict(genBal["level_compute"])
  const cityTime = asBig(state["city_time"])
  const q = asBig(cfg["node_effect_base_bps"])
  const focuses = liveFocusContours(cfg, city, hour, weekday, cityTime)
  const liveLinks = liveOutputLinkIds(cfg, city, hour, weekday, cityTime)
  let relief = logisticianRelief(cfg, city, hour, weekday, bps, cityTime)
  if (focuses.has("work_logistics") && relief > 0n) relief = focusScale(relief, cfg, true)
  const slotRows: Dict[] = []
  let cityRequest = 0n
  let cityIdle = ""
  let deskTrader = false
  let quoteTrader = false
  city["payout"] = 0n
  const fns = asList(city["functions"])
  const ordered: Dict[] = []
  for (const raw of fns) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    ordered.push(asDict(raw))
  }
  ordered.sort((a, b) => {
    const idA = asStr(a["id"])
    const idB = asStr(b["id"])
    const pa = outputPhase(cfg, city, idA)
    const pb = outputPhase(cfg, city, idB)
    if (pa < pb) return -1
    if (pa > pb) return 1
    if (idA < idB) return -1
    if (idA > idB) return 1
    return 0
  })
  const seenBids = new Set<string>()
  const seatedIds = new Set<string>()
  let energyDemand = 0n
  let computeDemand = 0n
  for (const fn of ordered) {
    if (fnBlocked(fn)) continue
    const bid = asStr(fn["id"])
    if (bid.length === 0 || seenBids.has(bid)) continue
    seenBids.add(bid)
    const bdef = buildingDef(cfg, bid)
    const autonomous = bdef["autonomous"] === true
    const outputKind = bdef["output"]
    const agent = agentOf(city, bid)
    const schId = asStr(bdef["schedule"], "always")
    let idle = ""
    let request = 0n
    let energyDraw = 0n
    let computeDraw = 0n
    let fused = bps
    let stage: Dict = { base: bps, post: bps }
    const role = agent === undefined ? "" : asStr(agent["role"])
    const objective = agent === undefined ? "" : asStr(agent["objective"])
    const agentId = agent === undefined ? "" : asStr(agent["id"])
    const seedId = agentId.length > 0 ? agentId : bid
    const cell = agent === undefined ? (autonomous ? "neighbour" : "none") : affinityCell(cfg, bid, role)
    if (underConstruction(fn)) {
      idle = asStr(cfg["idle_construction"], "IDLE_UNDER_CONSTRUCTION")
    } else if (buildingDistrictFrozen(cfg, city, bid, cityTime)) {
      idle = asStr(cfg["idle_district_frozen"], "IDLE_DISTRICT_FROZEN")
    }
    if (idle === asStr(cfg["idle_construction"], "IDLE_UNDER_CONSTRUCTION") || idle === asStr(cfg["idle_district_frozen"], "IDLE_DISTRICT_FROZEN")) {
      if (agent !== undefined) {
        seatedIds.add(agentId)
        agent["idle"] = idle
        agent["request"] = 0n
      }
      if (idle !== "" && cityIdle === "") cityIdle = idle
      slotRows.push({
        city_id: cid,
        agent_id: agentId,
        building_id: bid,
        objective,
        request: 0n,
        unit: 0n,
        weight: asBig(city["weight"], 1n),
        idle,
        energy: 0n,
        compute: 0n,
        stage,
        seed_id: seedId,
      })
      continue
    }
    if (agent === undefined && !autonomous) {
      idle = asStr(cfg["idle_agent"])
    } else {
      const opened = scheduleOpen(cfg, schId, hour, weekday)
      if (bid === "bank" && bankOpen(cfg, hour, weekday) === 0n) {
        idle = asStr(cfg["idle_bank"])
      } else if (opened[0] === 0n) {
        idle = opened[1]
      } else if (agent !== undefined && cell === "none") {
        idle = asStr(cfg["idle_wrong_role"], "IDLE_WRONG_ROLE")
      } else if (
        agent !== undefined &&
        role === "scientist" &&
        objective === "train" &&
        !trainTargetOk(city, agentId, trainTargetOf(agent, city))
      ) {
        idle = asStr(cfg["idle_train_target"], "IDLE_NO_TRAIN_TARGET")
      } else if (
        agent !== undefined &&
        role === "scientist" &&
        objective === "research" &&
        !researchFocusLive(cfg, city)
      ) {
        idle = asStr(cfg["idle_research_focus"], "IDLE_NO_RESEARCH_FOCUS")
      } else {
        const level = asBig(fn["level"], 1n)
        const energyCurve = curveAt(levelEnergy, bid, level)
        const computeCurve = curveAt(levelCompute, bid, level)
        computeDraw = outputKind === "compute" ? 0n : computeCurve
        energyDraw = outputKind === "energy" ? 0n : energyCurve
        const night =
          isNight(cfg, hour) && asDict(asDict(cfg["schedules"])[schId])["night_energy_premium"] === true
        if (night && energyDraw > 0n) {
          const traits = traitSet(agent)
          const prem = traits.has("night_owl")
            ? asBig(cfg["night_owl_effective_premium_bps"])
            : asBig(cfg["night_energy_premium_bps"])
          energyDraw = (energyDraw * (bps + prem)) / bps
        }
        let mrows = withResearchCosts(cfg, city, modifierRows(cfg, agent, cell, night))
        const energyCost = keyClipped(cfg, city, mrows, "energy_cost_bps", bps, cityTime)
        const computeCost = keyClipped(cfg, city, mrows, "compute_cost_bps", bps, cityTime)
        if (energyCost > 0n) energyDraw = applyMul(energyDraw, energyCost, bps)
        if (computeCost > 0n) computeDraw = applyMul(computeDraw, computeCost, bps)
        if (relief > 0n && energyDraw > 0n) energyDraw = applyMul(energyDraw, relief, bps)
        let tookEnergy = 0n
        if (energyDraw > 0n && consume(city, "energy_stock", energyDraw) === 0n) {
          idle = asStr(cfg["idle_energy"])
        } else {
          if (energyDraw > 0n) tookEnergy = energyDraw
          if (computeDraw > 0n && consume(city, "compute_stock", computeDraw) === 0n) {
            restore(city, "energy_stock", tookEnergy)
            idle = asStr(cfg["idle_compute"])
          } else if (
            agent !== undefined &&
            role === "scientist" &&
            (objective === "train" || objective === "research") &&
            computeDraw <= 0n
          ) {
            computeDraw = asBig(cfg["workshop_energy"])
            if (computeCost > 0n) computeDraw = applyMul(computeDraw, computeCost, bps)
            if (computeDraw <= 0n || consume(city, "compute_stock", computeDraw) === 0n) {
              restore(city, "energy_stock", tookEnergy)
              idle = asStr(cfg["idle_compute"])
            }
          }
        }
        if (idle === "") {
          if (contourFocused(bdef, focuses) && q > 0n) {
            mrows = [...mrows, { key: "output_bps", magnitude: q }]
          }
          const linkRows = outputLinkRows(cfg, bid, bdef, liveLinks)
          if (linkRows.length > 0) mrows = [...mrows, ...linkRows]
          const fusedPair = fuse(cfg, mrows, city, bps, cityTime)
          fused = fusedPair[0]
          stage = fusedPair[1]
          let aff = affinityBps(cfg, cell)
          if (agent === undefined && autonomous) aff = asBig(cfg["affinity_neighbour_bps"])
          const levelMult = agent === undefined ? bps : asBig(agent["level_mult_bps"], bps)
          const dist = buildingWeatherBps(cfg, city, bid, bps)
          const paysCapital =
            outputKind === "capital" && (agent === undefined || role === "engineer" || role === "trader")
          const paysRetail = outputKind === "capital_from_population" && agent !== undefined
          if (paysCapital || paysRetail) {
            let j = bps
            if (jitterOn > 0n) {
              j = tickJitterBps(
                seededPrng(cid, asBig(state["tick_index"]), seedId),
                asBig(cfg["jitter_width_bps"]),
                bps,
                traitSet(agent).has("steady"),
              )
            }
            let raw = curveAt(levelOut, bid, level)
            let scale = 1n
            if (paysRetail) {
              raw = asBig(cfg["workshop_out"]) * asBig(city["population"])
              scale = asBig(asDict(cfg["population_thresholds"])["2"])
              if (scale <= 0n) {
                raw = 0n
                scale = 1n
              }
            }
            request = (raw * aff) / (bps * scale)
            request = (request * levelMult) / bps
            request = (request * dist) / bps
            request = (request * j) / bps
            request = (request * fused) / bps
            request = (request * (bps - asBig(cfg["residual_idle_bps"]))) / bps
            if (asBig(cfg["happiness_penalty_live"]) > 0n && hap < asBig(cfg["happiness_penalty_threshold_bps"])) {
              request = (request * hap) / bps
            }
            if (paysRetail) {
              request = scaleByModifierKey(cfg, city, "population_conversion_bps", request, cityTime)
            }
          } else if (outputKind === "energy" && (agent === undefined || role === "engineer")) {
            let add = (((energyCurve * aff) / bps) * levelMult) / bps
            if (contourFocused(bdef, focuses)) add = focusScale(add, cfg, false)
            add = (add * buildingWeatherBps(cfg, city, bid, bps)) / bps
            city["energy_stock"] = asBig(city["energy_stock"]) + add
          } else if (outputKind === "compute" && (agent === undefined || role === "engineer")) {
            let add = (((computeCurve * aff) / bps) * levelMult) / bps
            if (contourFocused(bdef, focuses)) add = focusScale(add, cfg, false)
            add = (add * buildingWeatherBps(cfg, city, bid, bps)) / bps
            city["compute_stock"] = asBig(city["compute_stock"]) + add
          }
          if (agent !== undefined && role === "trader" && objective === "desk" && bid === "bank") {
            deskTrader = true
          }
          if (agent !== undefined && role === "trader" && objective === "quote" && bid === "exchange") {
            quoteTrader = true
          }
          const unlocked = new Set<string>()
          for (const x of asList(city["research_unlocked"])) {
            if (typeof x === "string") unlocked.add(x)
          }
          if (bid === "workshop" && unlocked.has("tools") && request > 0n) {
            request = (request * (bps + asBig(cfg["tools_effect_bps"]))) / bps
          }
          if (agent !== undefined && role === "scientist" && objective === "train") {
            const xpMags: bigint[] = []
            for (const r of mrows) {
              if (asStr(r["key"]) === "xp_rate_bps") xpMags.push(asBig(r["magnitude"]))
            }
            agent["xp_rate_mags"] = xpMags
          }
        }
      }
    }
    if (agent !== undefined) {
      seatedIds.add(agentId)
      agent["idle"] = idle
      agent["request"] = request
    }
    if (idle !== "" && cityIdle === "") cityIdle = idle
    cityRequest += request
    energyDemand += energyDraw
    computeDemand += computeDraw
    slotRows.push({
      city_id: cid,
      agent_id: agentId,
      building_id: bid,
      objective,
      request: request * asBig(city["weight"], 1n),
      unit: request,
      weight: asBig(city["weight"], 1n),
      idle,
      energy: energyDraw,
      compute: computeDraw,
      stage,
      seed_id: seedId,
    })
  }
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    const id = asStr(agent["id"])
    const bid = asStr(agent["building_id"])
    if (bid.length > 0 && seatedIds.has(id)) continue
    agent["idle"] = asStr(cfg["idle_agent"])
    agent["request"] = 0n
    agent["payout"] = 0n
  }
  city["energy_draw"] = energyDemand
  city["compute_draw"] = computeDemand
  let jobs = 0n
  const constructionIdle = asStr(cfg["idle_construction"], "IDLE_UNDER_CONSTRUCTION")
  const districtIdle = asStr(cfg["idle_district_frozen"], "IDLE_DISTRICT_FROZEN")
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    const id = asStr(agent["id"])
    if (!seatedIds.has(id)) continue
    const why = asStr(agent["idle"])
    if (why === constructionIdle || why === districtIdle) continue
    jobs += 1n
  }
  city["occupied_jobs"] = jobs
  city["idle"] = cityIdle
  city["request"] = cityRequest
  city["_slot_rows"] = slotRows
  if (deskTrader) city["bank_markup_override"] = asBig(cfg["bank_markup_floor_bps"])
  else delete city["bank_markup_override"]
  if (quoteTrader) city["hop_quality"] = 1n
  else delete city["hop_quality"]
  for (const raw of asList(city["functions"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const item = asDict(raw)
    const left = asBig(item["construction"])
    if (left > 0n) item["construction"] = left - 1n
  }
  const out: Dict[] = []
  for (const row of slotRows) {
    out.push({
      city_id: cid,
      agent_id: asStr(row["agent_id"]),
      building_id: asStr(row["building_id"]),
      request: asBig(row["request"]),
      unit: asBig(row["unit"]),
      weight: asBig(row["weight"]),
    })
  }
  return out
}

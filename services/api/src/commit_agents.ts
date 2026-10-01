import { agentLevelMultBps, applyCityScope, applySpend, buildingDistrictFrozen, seededPrng, trainTargetOk, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { type PackCtx } from "./pack_ctx.js"
import { errResult, okResult, type HttpResult } from "./envelope.js"
import { asBigint, asEngineDict, asObj, asText, walk, type Json } from "./values.js"

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function hireCost(ctx: PackCtx, n: bigint): bigint {
  const row = asObj(walk(ctx.pack, ["generated", "balance", "hire_cost", n.toString()]))
  return asBigint(row["cost"])
}

function agentSlots(ctx: PackCtx, level: bigint): bigint {
  const row = asObj(walk(ctx.pack, ["generated", "agents", "slots_at_city_level"]))
  return asBigint(row[level.toString()])
}

function paramBps(ctx: PackCtx, name: string): bigint {
  return asBigint(walk(ctx.pack, ["sections", "agents", "params", name, "v"]))
}

function roleIds(ctx: PackCtx): { readonly [id: string]: { readonly v1: boolean } } {
  return asObj(walk(ctx.pack, ["sections", "agents", "roles"])) as {
    readonly [id: string]: { readonly v1: boolean }
  }
}

function hireIdle(ctx: PackCtx, role: string, objective: string, trainTarget: string): string {
  if (role !== "scientist" || objective !== "train" || trainTarget.length > 0) return ""
  const code = ctx.cfg["idle_train_target"]
  return typeof code === "string" && code.length > 0 ? code : "IDLE_NO_TRAIN_TARGET"
}

function defaultObjective(ctx: PackCtx, role: string): string {
  const objectives = asObj(walk(ctx.pack, ["sections", "agents", "objectives"]))
  for (const id of Object.keys(objectives)) {
    const spec = objectives[id]
    if (spec === null || typeof spec !== "object" || Array.isArray(spec)) continue
    const row = asObj(spec)
    if (asText(row["role"]) !== role) continue
    if (row["is_default"] !== true) continue
    if (row["v1"] === false) continue
    return id
  }
  return ""
}

function traitIds(ctx: PackCtx): readonly string[] {
  return Object.keys(asObj(walk(ctx.pack, ["sections", "agents", "traits"]))).sort()
}

function rollPoolRole(ctx: PackCtx, cityId: string, tickIndex: bigint, agentId: string): string {
  const engineer = paramBps(ctx, "hire_pool_engineer_bps")
  const logistician = paramBps(ctx, "hire_pool_logistician_bps")
  const trader = paramBps(ctx, "hire_pool_trader_bps")
  const total = engineer + logistician + trader
  const roll = total <= 0n ? 0n : seededPrng(cityId, tickIndex, agentId, "hire") % total
  if (roll < engineer) return "engineer"
  if (roll < engineer + logistician) return "logistician"
  return "trader"
}

function rollTraits(ctx: PackCtx, cityId: string, tickIndex: bigint, agentId: string): readonly string[] {
  const ids = traitIds(ctx)
  if (ids.length === 0) return []
  const minN = paramBps(ctx, "traits_per_agent_min")
  const maxN = paramBps(ctx, "traits_per_agent_max")
  const span = maxN < minN ? 0n : maxN - minN + 1n
  const raw = seededPrng(cityId, tickIndex, agentId, "traits")
  const count = Number(minN + (span <= 0n ? 0n : raw % span))
  const start = Number(raw % BigInt(ids.length))
  const out: string[] = []
  for (let i = 0; i < count && i < ids.length; i += 1) {
    const id = ids[(start + i) % ids.length]
    if (id !== undefined) out.push(id)
  }
  return out
}

function liveRole(ctx: PackCtx, role: string): boolean {
  const roles = roleIds(ctx)
  const spec = roles[role]
  if (spec === undefined) return false
  return spec.v1 !== false
}

export function applyHire(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  cityId: string,
  body: { readonly [key: string]: Json },
): HttpResult {
  const agents = asList(city["agents"])
  const level = asBigint(city["city_level"], 1n)
  applyCityScope(ctx.cfg, city, asBigint(state["city_time"]))
  const cap = asBigint(city["agent_slots"], agentSlots(ctx, level))
  const used = BigInt(agents.length)
  if (used >= cap) return errResult(ctx, state, codes.NO_FREE_AGENT_SLOT)
  const n = used + 1n
  const cost = hireCost(ctx, n)
  if (asBigint(city["capital"]) < cost) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  const asked = asText(body["role"])
  const agentId = "h" + n.toString()
  const tickIndex = asBigint(state["tick_index"])
  let role = asked
  if (asked.length > 0) {
    if (!liveRole(ctx, asked)) return errResult(ctx, state, codes.API_MALFORMED)
  } else {
    role = rollPoolRole(ctx, cityId, tickIndex, agentId)
  }
  applySpend(ctx.cfg, state, city, cost, 0n)
  const bps = asBigint(ctx.cfg["bps"])
  const gain = asBigint(ctx.cfg["agent_level_gain_bps"])
  const objective = defaultObjective(ctx, role)
  const trainTarget = ""
  agents.push({
    id: agentId,
    role,
    level: 1n,
    xp: 0n,
    xp_remainder: 0n,
    level_mult_bps: agentLevelMultBps(1n, gain, bps),
    traits: rollTraits(ctx, cityId, tickIndex, agentId),
    building_id: "",
    objective,
    train_target: trainTarget,
    focus: "",
    idle: hireIdle(ctx, role, objective, trainTarget),
    request: 0n,
    payout: 0n,
  })
  city["agents"] = agents
  return okResult(ctx, state, { effect: "hire", role, capital: asBigint(city["capital"]) })
}

function flagOn(value: unknown): boolean {
  if (value === true) return true
  return asBigint(value, 0n) > 0n
}

function functionRow(city: Dict, bid: string): Dict | undefined {
  for (const item of asList(city["functions"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) === bid) return row
  }
  return undefined
}

function agentById(city: Dict, agentId: string): Dict | undefined {
  for (const item of asList(city["agents"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) === agentId) return row
  }
  return undefined
}

export function applyAssign(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
): HttpResult {
  const agentId = asText(body["agent_id"])
  const buildingId = asText(body["building_id"])
  if (agentId.length === 0 || buildingId.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const agent = agentById(city, agentId)
  if (agent === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const fn = functionRow(city, buildingId)
  if (fn === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (flagOn(fn["frozen"])) return errResult(ctx, state, codes.DISTRICT_FROZEN)
  if (buildingDistrictFrozen(ctx.cfg, city, buildingId, asBigint(state["city_time"]))) {
    return errResult(ctx, state, codes.DISTRICT_FROZEN)
  }
  if (flagOn(fn["construction"])) return errResult(ctx, state, codes.IDLE_UNDER_CONSTRUCTION)
  if (flagOn(fn["deactivated"])) return errResult(ctx, state, codes.API_MALFORMED)
  for (const item of asList(city["agents"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) === agentId) continue
    if (asText(row["building_id"]) === buildingId) row["building_id"] = ""
  }
  agent["building_id"] = buildingId
  return okResult(ctx, state, { effect: "assign", agent_id: agentId, building_id: buildingId })
}

export function applySetObjective(
  ctx: PackCtx,
  state: Dict,
  city: Dict,
  body: { readonly [key: string]: Json },
): HttpResult {
  const agentId = asText(body["agent_id"])
  const objective = asText(body["objective"])
  if (agentId.length === 0 || objective.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const agent = agentById(city, agentId)
  if (agent === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const objectives = asObj(walk(ctx.pack, ["sections", "agents", "objectives"]))
  const specRaw = objectives[objective]
  if (specRaw === undefined || specRaw === null || typeof specRaw !== "object" || Array.isArray(specRaw)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const spec = asObj(specRaw)
  if (asText(spec["role"]) !== asText(agent["role"])) return errResult(ctx, state, codes.API_MALFORMED)
  if (spec["v1"] === false) return errResult(ctx, state, codes.API_MALFORMED)
  const trainTarget = asText(body["train_target"])
  const focus = asText(body["focus"])
  if (objective === "train" && !trainTargetOk(city, agentId, trainTarget)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (objective === "focus") {
    if (focus.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
    const contours = asObj(walk(ctx.pack, ["sections", "agents", "contours"]))
    if (!(focus in contours)) return errResult(ctx, state, codes.API_MALFORMED)
    agent["focus"] = focus
  }
  agent["objective"] = objective
  if (objective === "train") {
    agent["train_target"] = trainTarget
    agent["idle"] = ""
  } else {
    agent["train_target"] = ""
    if (asText(agent["idle"]) === hireIdle(ctx, asText(agent["role"]), "train", "")) {
      agent["idle"] = ""
    }
  }
  return okResult(ctx, state, { effect: "set_objective", agent_id: agentId, objective })
}

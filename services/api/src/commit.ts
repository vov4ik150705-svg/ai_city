import { applySpend, claimEveryAsset, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { type PackCtx } from "./pack_ctx.js"
import { cityKind, errResult, okResult, type HttpResult } from "./envelope.js"
import { asBigint, asEngineDict, asObj, asText, LoadError, walk, type Json } from "./values.js"

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function cityOf(state: Dict, cityId: string): Dict | undefined {
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return undefined
  return asEngineDict(cities[cityId])
}

function hireCost(ctx: PackCtx, n: bigint): bigint {
  const row = asObj(walk(ctx.pack, ["generated", "balance", "hire_cost", n.toString()]))
  return asBigint(row["cost"])
}

function agentSlots(ctx: PackCtx, level: bigint): bigint {
  const row = asObj(walk(ctx.pack, ["generated", "agents", "slots_at_city_level"]))
  return asBigint(row[level.toString()])
}

function applyHire(ctx: PackCtx, state: Dict, city: Dict): HttpResult {
  const agents = asList(city["agents"])
  const level = asBigint(city["city_level"], 1n)
  const cap = agentSlots(ctx, level)
  const used = BigInt(agents.length)
  if (used >= cap) return errResult(ctx, state, codes.NO_FREE_AGENT_SLOT)
  const n = used + 1n
  const cost = hireCost(ctx, n)
  if (asBigint(city["capital"]) < cost) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  applySpend(ctx.cfg, state, city, cost, 0n)
  agents.push({ id: "h" + n.toString(), role: "engineer" })
  city["agents"] = agents
  return okResult(ctx, state, { effect: "hire", capital: asBigint(city["capital"]) })
}

function prizeAssets(ctx: PackCtx): readonly string[] {
  const raw = walk(ctx.pack, ["generated", "seasons", "prize_assets"])
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === "string") out.push(item)
  }
  return out
}

function applyClaimPrize(ctx: PackCtx, state: Dict, city: Dict, cityId: string): HttpResult {
  const kind = cityKind(state, cityId)
  if (kind === "demo") return errResult(ctx, state, codes.DEMO_NO_PRIZE)
  const assets = prizeAssets(ctx)
  const owedRaw = asEngineDict(city["prize_owed"] ?? {})
  const poolRaw = asEngineDict(city["prize_pool_in"] ?? {})
  const owed: { [asset: string]: bigint } = {}
  const poolIn: { [asset: string]: bigint } = {}
  for (const asset of assets) {
    try {
      owed[asset] = asBigint(owedRaw[asset], 0n)
    } catch {
      owed[asset] = 0n
    }
    try {
      poolIn[asset] = asBigint(poolRaw[asset], 0n)
    } catch {
      poolIn[asset] = 0n
    }
  }
  const rows = claimEveryAsset({
    assets,
    owed,
    poolIn,
    demo: false,
  })
  const listed: Json[] = []
  for (const row of rows) {
    listed.push({
      asset: row.asset,
      paid: row.paid,
      code: row.code,
      owed: row.owed,
      pool_in: row.assetPool,
    })
  }
  return okResult(ctx, state, { effect: "claim_prize", assets: listed })
}

function buildCost(ctx: PackCtx, bid: string): bigint {
  const costs = asObj(walk(ctx.pack, ["generated", "balance", "level_cost"]))
  const rows = costs[bid]
  if (!Array.isArray(rows) || rows.length === 0) return 0n
  return asBigint(rows[0])
}

function ordinaryActiveCount(city: Dict, defs: { readonly [key: string]: Json }): bigint {
  let n = 0n
  for (const item of asList(city["functions"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asBigint(row["deactivated"], 0n) > 0n || asBigint(row["frozen"], 0n) > 0n) continue
    if (row["deactivated"] === true || row["frozen"] === true) continue
    const aid = asText(row["id"])
    const spec = defs[aid]
    if (spec !== undefined && spec !== null && typeof spec === "object" && !Array.isArray(spec)) {
      const def = asObj(spec as { readonly [key: string]: Json })
      if (def["autonomous"] === true || def["prebuilt"] === true) continue
    }
    n += 1n
  }
  return n
}

function applyBuild(ctx: PackCtx, state: Dict, city: Dict, body: { readonly [key: string]: Json }): HttpResult {
  const bid = asText(body["building_id"])
  if (bid.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const deactivate = body["deactivate"] === true || body["active"] === false
  const defs = asObj(walk(ctx.pack, ["sections", "buildings", "buildings"]))
  const spec = defs[bid]
  if (spec === undefined || spec === null || typeof spec !== "object") {
    return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW)
  }
  const def = asObj(spec as { readonly [key: string]: Json })
  if (def["prebuilt"] === true || def["autonomous"] === true) {
    return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW)
  }
  const playable = asList(walk(ctx.pack, ["generated", "buildings", "buildings_playable_v1"]))
  if (!playable.includes(bid)) return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW)
  const needLevel = asBigint(def["city_level_req"], 1n)
  const cityLevel = asBigint(city["city_level"], 1n)
  if (cityLevel < needLevel) return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW)
  const functions = asList(city["functions"])
  if (deactivate) {
    for (const item of functions) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const row = asEngineDict(item)
      if (asText(row["id"]) !== bid) continue
      row["deactivated"] = 1n
    }
    city["functions"] = functions
    return okResult(ctx, state, { effect: "build", active: 0n, capital: asBigint(city["capital"]) })
  }
  let existing: Dict | undefined
  for (const item of functions) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const row = asEngineDict(item)
    if (asText(row["id"]) === bid) {
      existing = row
      break
    }
  }
  if (existing !== undefined && asBigint(existing["deactivated"], 0n) === 0n && existing["deactivated"] !== true) {
    return okResult(ctx, state, { effect: "build", active: 1n, capital: asBigint(city["capital"]) })
  }
  const cap = agentSlots(ctx, cityLevel) + 3n
  const used = ordinaryActiveCount(city, defs)
  if (existing === undefined && used >= cap) return errResult(ctx, state, codes.NO_FREE_BUILD_SLOT)
  const cost = existing === undefined ? buildCost(ctx, bid) : 0n
  if (asBigint(city["capital"]) < cost) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  if (cost > 0n) applySpend(ctx.cfg, state, city, cost, 0n)
  if (existing !== undefined) {
    existing["deactivated"] = 0n
  } else {
    functions.push({ id: bid, level: 1n })
  }
  city["functions"] = functions
  return okResult(ctx, state, { effect: "build", active: 1n, capital: asBigint(city["capital"]) })
}

function applySetObjective(ctx: PackCtx, state: Dict, city: Dict, body: { readonly [key: string]: Json }): HttpResult {
  const objective = asText(body["objective"])
  city["objective"] = objective
  const target = asText(body["train_target"])
  if (target.length > 0) city["train_target"] = target
  return okResult(ctx, state, { effect: "set_objective", objective })
}

/** Live hire, claim, and activate/deactivate of authored functions. Map is never mutated. */
export function applyLive(
  ctx: PackCtx,
  state: Dict,
  effect: string,
  body: { readonly [key: string]: Json },
  cityId: string,
): HttpResult | undefined {
  const city = cityOf(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  try {
    if (effect === "hire") return applyHire(ctx, state, city)
    if (effect === "claim_prize") return applyClaimPrize(ctx, state, city, cityId)
    if (effect === "build") return applyBuild(ctx, state, city, body)
    if (effect === "set_objective") return applySetObjective(ctx, state, city, body)
  } catch (e) {
    if (e instanceof LoadError) return errResult(ctx, state, codes.API_MALFORMED)
    throw e
  }
  return undefined
}

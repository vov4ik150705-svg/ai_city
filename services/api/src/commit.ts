import {
  applySpend,
  buildingDistrictFrozen,
  buildingDistrictIds,
  constructionTicks,
  scaleByModifierKey,
  type Dict,
} from "@corporator/engine"
import type { AssetPort } from "@corporator/chainport"
import { codes } from "@corporator/protocol"
import { applyDeposit, applyPresentVoucher, applyWithdraw, flushChainMint } from "./commit_bank.js"
import { applyBuyStock, type BuyStockHop } from "./commit_exchange.js"
import { applyClaimUnstake, applyOpenDistrict, applyPickNode, applyStake, applyUnlockTier, applyUnstake } from "./commit_districts.js"
import { applyMerge } from "./commit_merges.js"
import { applyClaimFragment } from "./commit_fragments.js"
import { applyHire, applyAssign, applySetObjective } from "./commit_agents.js"
import { applyClaimPrize, walletCallerOf } from "./commit_prize.js"
import { prizeCustodyLive } from "./custody.js"
import { type PackCtx } from "./pack_ctx.js"
import { errResult, okResult, type HttpResult } from "./envelope.js"
import { asBigint, asEngineDict, asObj, asText, LoadError, walk, type Json } from "./values.js"

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function cityOf(state: Dict, cityId: string): Dict | undefined {
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) return undefined
  return asEngineDict(cities[cityId])
}

function buildSlotCap(ctx: PackCtx, level: bigint): bigint {
  const table = asObj(walk(ctx.pack, ["generated", "balance", "build_slots"]))
  return asBigint(table[level.toString()])
}

function levelCost(ctx: PackCtx, bid: string, level: bigint): bigint | undefined {
  const costs = asObj(walk(ctx.pack, ["generated", "balance", "level_cost"]))
  const rows = costs[bid]
  if (!Array.isArray(rows)) return undefined
  let i = 1n
  for (const item of rows) {
    if (i === level) return asBigint(item)
    i += 1n
  }
  return undefined
}

function buildCost(ctx: PackCtx, bid: string): bigint {
  const cost = levelCost(ctx, bid, 1n)
  return cost === undefined ? 0n : cost
}

function buildingLevelMax(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["sections", "balance", "params", "building_level_max", "v"]))
}

function levelBuildTime(ctx: PackCtx, bid: string, level: bigint): bigint {
  const table = asObj(walk(ctx.pack, ["generated", "balance", "level_build_time"]))
  const rows = table[bid]
  if (!Array.isArray(rows) || rows.length === 0) return 1n
  const idx = Number(level) - 1
  if (idx < 0) return 1n
  const pick = idx >= rows.length ? rows[rows.length - 1] : rows[idx]
  const got = asBigint(pick, 0n)
  return got > 0n ? got : 1n
}

function flagOn(value: unknown): boolean {
  if (value === true) return true
  return asBigint(value, 0n) > 0n
}

function defsOf(ctx: PackCtx): { readonly [key: string]: Json } {
  return asObj(walk(ctx.pack, ["sections", "buildings", "buildings"]))
}

function playableBuilding(ctx: PackCtx, bid: string): boolean {
  return asList(walk(ctx.pack, ["generated", "buildings", "buildings_playable_v1"])).includes(bid)
}

function buildingDef(defs: { readonly [key: string]: Json }, bid: string): { readonly [key: string]: Json } | undefined {
  const spec = defs[bid]
  if (spec === undefined || spec === null || typeof spec !== "object" || Array.isArray(spec)) return undefined
  return asObj(spec as { readonly [key: string]: Json })
}

function functionRows(city: Dict): Dict[] {
  const out: Dict[] = []
  for (const item of asList(city["functions"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    out.push(asEngineDict(item))
  }
  return out
}

function findFunction(city: Dict, bid: string): Dict | undefined {
  for (const row of functionRows(city)) {
    if (asText(row["id"]) === bid) return row
  }
  return undefined
}

/** Placed buildings occupy a slot, including deactivated ones. Prebuilt does not. */
function occupiedBuildSlots(city: Dict, defs: { readonly [key: string]: Json }): bigint {
  let n = 0n
  for (const row of functionRows(city)) {
    const def = buildingDef(defs, asText(row["id"]))
    if (def !== undefined && def["prebuilt"] === true) continue
    n += 1n
  }
  return n
}

function districtOpened(city: Dict, districtId: string): boolean {
  for (const item of asList(city["districts"])) {
    if (item === districtId) return true
  }
  return false
}

/** Beacon district from buildingDistrictIds. Synergy joins are not a placement lock. */
function placementDistrictLocked(ctx: PackCtx, city: Dict, bid: string, def: { readonly [key: string]: Json }): boolean {
  if (asText(def["district"]).length === 0) return false
  for (const did of buildingDistrictIds(ctx.cfg, bid)) {
    if (!districtOpened(city, did)) return true
  }
  return false
}

function applyBuild(ctx: PackCtx, state: Dict, city: Dict, body: { readonly [key: string]: Json }): HttpResult {
  const bid = asText(body["building_id"])
  if (bid.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const deactivate = body["deactivate"] === true || body["active"] === false
  const defs = defsOf(ctx)
  const def = buildingDef(defs, bid)
  if (def === undefined || def["prebuilt"] === true || !playableBuilding(ctx, bid)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const needLevel = asBigint(def["city_level_req"], 1n)
  const cityLevel = asBigint(city["city_level"], 1n)
  if (cityLevel < needLevel) return errResult(ctx, state, codes.CITY_LEVEL_TOO_LOW)
  const functions = asList(city["functions"])
  const existing = findFunction(city, bid)
  if (deactivate) {
    if (existing === undefined) return errResult(ctx, state, codes.API_MALFORMED)
    existing["deactivated"] = 1n
    city["functions"] = functions
    return okResult(ctx, state, { effect: "build", active: 0n, capital: asBigint(city["capital"]) })
  }
  if (existing !== undefined && !flagOn(existing["deactivated"])) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (buildingDistrictFrozen(ctx.cfg, city, bid, asBigint(state["city_time"]))) {
    return errResult(ctx, state, codes.DISTRICT_FROZEN)
  }
  if (placementDistrictLocked(ctx, city, bid, def)) return errResult(ctx, state, codes.DISTRICT_LOCKED)
  if (existing === undefined && occupiedBuildSlots(city, defs) >= buildSlotCap(ctx, cityLevel)) {
    return errResult(ctx, state, codes.NO_FREE_BUILD_SLOT)
  }
  const cost = existing === undefined ? buildCost(ctx, bid) : 0n
  const priced = scaleByModifierKey(ctx.cfg, city, "build_cost_bps", cost, asBigint(state["city_time"]))
  if (asBigint(city["capital"]) < priced) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  if (priced > 0n) applySpend(ctx.cfg, state, city, priced, 0n)
  if (existing !== undefined) {
    existing["deactivated"] = 0n
  } else {
    functions.push({ id: bid, level: 1n, construction: levelBuildTime(ctx, bid, 1n) })
  }
  city["functions"] = functions
  return okResult(ctx, state, { effect: "build", active: 1n, capital: asBigint(city["capital"]) })
}

function applyUpgrade(ctx: PackCtx, state: Dict, city: Dict, body: { readonly [key: string]: Json }): HttpResult {
  const bid = asText(body["building_id"])
  if (bid.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const defs = defsOf(ctx)
  const def = buildingDef(defs, bid)
  if (def === undefined || def["prebuilt"] === true || !playableBuilding(ctx, bid)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const functions = asList(city["functions"])
  const existing = findFunction(city, bid)
  if (existing === undefined) return applyBuild(ctx, state, city, body)
  if (flagOn(existing["deactivated"])) return errResult(ctx, state, codes.API_MALFORMED)
  if (flagOn(existing["construction"])) return errResult(ctx, state, codes.IDLE_UNDER_CONSTRUCTION)
  if (flagOn(existing["frozen"])) return errResult(ctx, state, codes.DISTRICT_FROZEN)
  if (buildingDistrictFrozen(ctx.cfg, city, bid, asBigint(state["city_time"]))) {
    return errResult(ctx, state, codes.DISTRICT_FROZEN)
  }
  const current = asBigint(existing["level"], 1n)
  const max = buildingLevelMax(ctx)
  if (current >= max) return errResult(ctx, state, codes.TIER_NOT_UNLOCKED)
  const next = current + 1n
  const cost = levelCost(ctx, bid, next)
  if (cost === undefined) return errResult(ctx, state, codes.TIER_NOT_UNLOCKED)
  const priced = scaleByModifierKey(ctx.cfg, city, "build_cost_bps", cost, asBigint(state["city_time"]))
  if (asBigint(city["capital"]) < priced) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  if (priced > 0n) applySpend(ctx.cfg, state, city, priced, 0n)
  existing["level"] = next
  existing["construction"] = constructionTicks(
    ctx.cfg,
    city,
    levelBuildTime(ctx, bid, next),
    asBigint(state["city_time"]),
  )
  city["functions"] = functions
  return okResult(ctx, state, {
    effect: "upgrade",
    building_id: bid,
    level: next,
    capital: asBigint(city["capital"]),
  })
}

function researchLive(ctx: PackCtx): bigint {
  try {
    return asBigint(walk(ctx.pack, ["sections", "screens", "params", "research_nodes_live", "v"]), 0n)
  } catch {
    return 0n
  }
}

function researchCost(ctx: PackCtx, axis: string): bigint | undefined {
  const costs = asObj(walk(ctx.pack, ["generated", "balance", "research_node_cost"]))
  if (!(axis in costs)) return undefined
  return asBigint(costs[axis])
}

function unlockedAxes(city: Dict): readonly string[] {
  const out: string[] = []
  for (const item of asList(city["research_unlocked"])) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function applyResearchStart(ctx: PackCtx, state: Dict, city: Dict, body: { readonly [key: string]: Json }): HttpResult {
  if (researchLive(ctx) <= 0n) return errResult(ctx, state, codes.FEATURE_NOT_IN_V1)
  const axis = asText(body["axis_id"])
  if (axis.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const axes = asObj(walk(ctx.pack, ["sections", "research", "axes"]))
  if (!(axis in axes)) return errResult(ctx, state, codes.API_MALFORMED)
  const cost = researchCost(ctx, axis)
  if (cost === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  if (unlockedAxes(city).includes(axis) || asText(city["research_focus"]) === axis) {
    const objective = asText(ctx.cfg["research_objective"])
    if (asText(city["research_focus"]) === axis && objective.length > 0) city["objective"] = objective
    return okResult(ctx, state, {
      effect: "research_start",
      axis_id: axis,
      capital: asBigint(city["capital"]),
    })
  }
  if (asBigint(city["capital"]) < cost) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  if (cost > 0n) applySpend(ctx.cfg, state, city, cost, 0n)
  city["research_focus"] = axis
  city["research_progress"] = 0n
  const objective = asText(ctx.cfg["research_objective"])
  if (objective.length > 0) city["objective"] = objective
  return okResult(ctx, state, {
    effect: "research_start",
    axis_id: axis,
    capital: asBigint(city["capital"]),
  })
}

/** Live hire, claim, and activate/deactivate of authored functions. Map is never mutated. */
export async function applyLive(
  ctx: PackCtx,
  state: Dict,
  effect: string,
  body: { readonly [key: string]: Json },
  cityId: string,
  port?: AssetPort,
  hop?: BuyStockHop,
): Promise<HttpResult | undefined> {
  const city = cityOf(state, cityId)
  if (city === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  try {
    if (port !== undefined && prizeCustodyLive(port)) {
      const account = asText(city["wallet"])
      if (account.length > 0) await flushChainMint(port, city, account)
    }
    if (effect === "hire") return applyHire(ctx, state, city, cityId, body)
    if (effect === "assign") return applyAssign(ctx, state, city, body)
    if (effect === "claim_prize") {
      const custody =
        port === undefined
          ? undefined
          : {
              live: prizeCustodyLive(port),
              treasury: port.prizeTreasury,
              caller: walletCallerOf(city),
            }
      return applyClaimPrize(ctx, state, city, cityId, custody)
    }
    if (effect === "build") return applyBuild(ctx, state, city, body)
    if (effect === "set_objective") return applySetObjective(ctx, state, city, body)
    if (effect === "research_start") return applyResearchStart(ctx, state, city, body)
    if (effect === "open_district") return applyOpenDistrict(ctx, state, city, body, cityId)
    if (effect === "stake") return applyStake(ctx, state, city, body, port)
    if (effect === "unstake") return applyUnstake(ctx, state, city, body)
    if (effect === "claim_unstaked") return applyClaimUnstake(ctx, state, cityId)
    if (effect === "unlock_tier") return applyUnlockTier(ctx, state, city, body)
    if (effect === "pick_node") return applyPickNode(ctx, state, city, body)
    if (effect === "merge") return applyMerge(ctx, state, city, body)
    if (effect === "upgrade") return applyUpgrade(ctx, state, city, body)
    if (effect === "claim_fragment") return applyClaimFragment(ctx, state, city, cityId)
    if (effect === "deposit") return applyDeposit(ctx, state, city, body, cityId, port)
    if (effect === "withdraw") return applyWithdraw(ctx, state, city, body, cityId, port)
    if (effect === "present_voucher") return applyPresentVoucher(ctx, state, city, body, cityId)
    if (effect === "buy_stock") return applyBuyStock(ctx, state, city, body, cityId, hop)
  } catch (e) {
    if (e instanceof LoadError) return errResult(ctx, state, codes.API_MALFORMED)
    throw e
  }
  return undefined
}

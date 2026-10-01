import { applySpend, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import {
  districtByTicker,
  districtIds,
  districtSpec,
  districtTier,
  pushNode,
  resolveDistrictId,
} from "./commit_districts.js"
import { type PackCtx } from "./pack_ctx.js"
import { errResult, okResult, type HttpResult } from "./envelope.js"
import { asBigint, asObj, asText, walk, type Json } from "./values.js"

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function mergeCost(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["generated", "progression", "merge_cost"]))
}

function mergeActiveCap(ctx: PackCtx): bigint {
  return asBigint(walk(ctx.pack, ["generated", "progression", "merge_active_cap"]))
}

function mergeBag(ctx: PackCtx): { readonly [key: string]: Json } {
  return asObj(walk(ctx.pack, ["generated", "progression", "progression_merges"]))
}

function mergeDistrictList(row: { readonly [key: string]: Json }): readonly string[] {
  const out: string[] = []
  for (const item of asList(row["districts"])) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function mergeSpec(
  ctx: PackCtx,
  mergeId: string,
):
  | {
      readonly id: string
      readonly districts: readonly string[]
      readonly minTier: bigint
      readonly playable: boolean
      readonly effects: readonly { readonly district: string; readonly key: string; readonly magnitude: bigint }[]
    }
  | undefined {
  if (mergeId.length === 0) return undefined
  const raw = mergeBag(ctx)[mergeId]
  if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const row = asObj(raw)
  const districts = mergeDistrictList(row)
  if (districts.length !== 2) return undefined
  const effects: { district: string; key: string; magnitude: bigint }[] = []
  for (const item of asList(row["effects"])) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) continue
    const eff = asObj(item as Json)
    const district = asText(eff["district"])
    const key = asText(eff["key"])
    if (district.length === 0 || key.length === 0 || !("magnitude" in eff)) return undefined
    effects.push({ district, key, magnitude: asBigint(eff["magnitude"]) })
  }
  if (effects.length === 0) return undefined
  return {
    id: mergeId,
    districts,
    minTier: asBigint(row["min_tier"]),
    playable: row["playable_v1"] === true,
    effects,
  }
}

function mergeIdByDistricts(ctx: PackCtx, a: string, b: string): string {
  if (a.length === 0 || b.length === 0 || a === b) return ""
  const bag = mergeBag(ctx)
  for (const id of Object.keys(bag)) {
    const spec = mergeSpec(ctx, id)
    if (spec === undefined) continue
    if (spec.districts.includes(a) && spec.districts.includes(b)) return spec.id
  }
  return ""
}

function resolveMergeId(ctx: PackCtx, body: { readonly [key: string]: Json }): string {
  const raw = asText(body["merge_id"])
  if (mergeSpec(ctx, raw) !== undefined) return raw
  const plus = raw.indexOf("+")
  if (plus > 0) {
    const left = raw.slice(0, plus)
    const right = raw.slice(plus + 1)
    const fromPair = mergeIdByDistricts(ctx, left, right)
    if (fromPair.length > 0) return fromPair
  }
  const hinted = resolveDistrictId(ctx, body)
  const otherRaw = asText(body["other_district_id"])
  const other = districtSpec(ctx, otherRaw) !== undefined ? otherRaw : districtByTicker(ctx, otherRaw)
  return mergeIdByDistricts(ctx, hinted, other)
}

function cityMergeIds(city: Dict): readonly string[] {
  const out: string[] = []
  for (const item of asList(city["merges"])) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

function mergePartnerOf(ctx: PackCtx, city: Dict, districtId: string): string {
  for (const mid of cityMergeIds(city)) {
    const spec = mergeSpec(ctx, mid)
    if (spec === undefined) continue
    if (!spec.districts.includes(districtId)) continue
    for (const other of spec.districts) {
      if (other !== districtId) return other
    }
  }
  return ""
}

export function applyMerge(ctx: PackCtx, state: Dict, city: Dict, body: { readonly [key: string]: Json }): HttpResult {
  const mergeId = resolveMergeId(ctx, body)
  const merge = mergeSpec(ctx, mergeId)
  if (merge === undefined) return errResult(ctx, state, codes.API_MALFORMED)
  const hinted = resolveDistrictId(ctx, body)
  if (hinted.length > 0 && !merge.districts.includes(hinted)) return errResult(ctx, state, codes.API_MALFORMED)
  if (!merge.playable) return errResult(ctx, state, codes.DISTRICT_LOCKED)
  const opened = districtIds(city)
  for (const districtId of merge.districts) {
    const spec = districtSpec(ctx, districtId)
    if (spec === undefined) return errResult(ctx, state, codes.API_MALFORMED)
    if (!opened.includes(spec.id)) return errResult(ctx, state, codes.DISTRICT_LOCKED)
    if (districtTier(city, spec.id) < merge.minTier) return errResult(ctx, state, codes.TIER_NOT_UNLOCKED)
  }
  const active = cityMergeIds(city)
  if (active.includes(merge.id)) {
    return okResult(ctx, state, {
      effect: "merge",
      merge_id: merge.id,
      districts: [...merge.districts],
      capital: asBigint(city["capital"]),
    })
  }
  for (const districtId of merge.districts) {
    const other = mergePartnerOf(ctx, city, districtId)
    if (other.length > 0) return errResult(ctx, state, codes.MERGE_MATCHING_BLOCKED)
  }
  const cap = mergeActiveCap(ctx)
  if (BigInt(active.length) >= cap) return errResult(ctx, state, codes.MERGE_MATCHING_BLOCKED)
  const cost = mergeCost(ctx)
  if (asBigint(city["capital"]) < cost) return errResult(ctx, state, codes.NOT_ENOUGH_CAPITAL)
  if (cost > 0n) applySpend(ctx.cfg, state, city, cost, 0n)
  for (const eff of merge.effects) {
    pushNode(city, { id: merge.id + "_" + eff.district, key: eff.key, magnitude: eff.magnitude })
  }
  city["merges"] = [...active, merge.id]
  return okResult(ctx, state, {
    effect: "merge",
    merge_id: merge.id,
    districts: [...merge.districts],
    capital: asBigint(city["capital"]),
  })
}

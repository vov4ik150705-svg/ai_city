import { qualifyDays, faceWallet, type Dict } from "@corporator/engine"
import { type PackCtx } from "./pack_ctx.js"
import { asBigint, asEngineDict, asObj, asText, LoadError, walk, type Json } from "./values.js"

export type RankSlot = {
  wallet: string
  cityId: string
  influence: bigint
  gdp: bigint
  positiveDays: bigint
}

function flagOn(value: unknown): boolean {
  if (value === true) return true
  if (value === false || value === undefined || value === null) return false
  try {
    return asBigint(value) !== 0n
  } catch {
    return false
  }
}

function packBig(ctx: PackCtx, parts: readonly string[], fallback: bigint): bigint {
  try {
    return asBigint(walk(ctx.pack, parts), fallback)
  } catch (e) {
    if (e instanceof LoadError) return fallback
    throw e
  }
}

function seasonLabels(ctx: PackCtx, state: Dict): { readonly season: string; readonly period: string } | undefined {
  const seasonDays = asBigint(ctx.cfg["season_city_days"])
  const periods = packBig(ctx, ["sections", "seasons", "params", "prize_periods_per_season", "v"], 0n)
  if (seasonDays <= 0n) return undefined
  const day = asBigint(state["day"])
  const elapsed = day > 0n ? day - 1n : 0n
  const seasonIndex = elapsed / seasonDays + 1n
  const within = elapsed % seasonDays
  const periodLen = periods <= 0n ? seasonDays : seasonDays / periods
  const periodIndex = periodLen <= 0n ? 1n : within / periodLen + 1n
  return { season: "S" + seasonIndex.toString(), period: "P" + periodIndex.toString() }
}

function boardWallet(city: Dict): string {
  return faceWallet(city["wallet"])
}

function cityBig(city: Dict, key: string): bigint {
  try {
    return asBigint(city[key])
  } catch (e) {
    if (e instanceof LoadError || e instanceof SyntaxError) return 0n
    throw e
  }
}

export function walletOf(city: Dict, _cityId: string): string {
  return boardWallet(city)
}

export function isDemoCity(city: Dict): boolean {
  if (asText(city["account_kind"]) === "demo") return true
  return flagOn(city["demo"])
}

export function qualifyNeed(ctx: PackCtx): { readonly need: bigint; readonly requireStake: boolean } {
  const data = asEngineDict(asObj(ctx.pack)["sections"])
  const alpha = packBig(ctx, ["sections", "seasons", "params", "influence_intensity_exp_bps", "v"], asBigint(ctx.cfg["bps"]))
  return {
    need: qualifyDays(data, alpha),
    requireStake: flagOn(packBig(ctx, ["sections", "seasons", "params", "prize_require_live_stake", "v"], 0n)),
  }
}

function prizeQualified(city: Dict, need: bigint, requireStake: boolean): boolean {
  try {
    if (asBigint(city["positive_days"]) < need) return false
    if (requireStake && !flagOn(city["live_stake"])) return false
    return true
  } catch (e) {
    if (e instanceof LoadError || e instanceof SyntaxError) return false
    throw e
  }
}

function mergeSlots(state: Dict, keep: (city: Dict) => boolean): RankSlot[] {
  const cities = asEngineDict(state["cities"])
  const byWallet = new Map<string, RankSlot>()
  for (const cid of Object.keys(cities).sort()) {
    try {
      const other = asEngineDict(cities[cid])
      if (isDemoCity(other)) continue
      const wallet = boardWallet(other)
      if (wallet.length === 0) continue
      if (!keep(other)) continue
      const influence = asBigint(other["influence"])
      const gdp = asBigint(other["day_gdp"])
      const cur = byWallet.get(wallet)
      if (
        cur === undefined ||
        influence > cur.influence ||
        (influence === cur.influence && cid < cur.cityId)
      ) {
        byWallet.set(wallet, {
          wallet,
          cityId: cid,
          influence,
          gdp,
          positiveDays: asBigint(other["positive_days"]),
        })
      }
    } catch (e) {
      if (e instanceof LoadError || e instanceof SyntaxError) continue
      throw e
    }
  }
  return [...byWallet.values()]
}

function liveSlots(state: Dict): readonly RankSlot[] {
  return mergeSlots(state, () => true).sort((a, b) => {
    if (a.influence !== b.influence) return a.influence > b.influence ? -1 : 1
    if (a.gdp !== b.gdp) return a.gdp > b.gdp ? -1 : 1
    return a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0
  })
}

export function prizeSlotsOf(state: Dict, need: bigint, requireStake: boolean): readonly RankSlot[] {
  return mergeSlots(state, (city) => prizeQualified(city, need, requireStake)).sort((a, b) => {
    if (a.influence === b.influence) return a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0
    return a.influence > b.influence ? -1 : 1
  })
}

export function qualifiedPrizeSlots(ctx: PackCtx, state: Dict): readonly RankSlot[] {
  try {
    const q = qualifyNeed(ctx)
    return prizeSlotsOf(state, q.need, q.requireStake)
  } catch (e) {
    if (e instanceof LoadError) return []
    throw e
  }
}

function boardOf(
  slots: readonly RankSlot[],
  cities: Dict,
  viewerWallet: string,
  need: bigint,
  requireStake: boolean,
  markQualified: boolean,
): Json[] {
  const rows: Json[] = []
  let rank = 1n
  for (const slot of slots) {
    const city = asEngineDict(cities[slot.cityId])
    rows.push({
      rank,
      wallet: slot.wallet,
      influence: slot.influence,
      gdp: slot.gdp,
      positive_days: slot.positiveDays,
      qualified: markQualified && prizeQualified(city, need, requireStake) ? 1n : 0n,
      self: slot.wallet === viewerWallet ? 1n : 0n,
    })
    rank += 1n
  }
  return rows
}

export function publicRatingRows(ctx: PackCtx, state: Dict): Json[] {
  const cities = asEngineDict(state["cities"])
  const slots = liveSlots(state)
  let need = 0n
  let requireStake = false
  let markQualified = true
  try {
    const q = qualifyNeed(ctx)
    need = q.need
    requireStake = q.requireStake
  } catch (e) {
    if (!(e instanceof LoadError)) throw e
    markQualified = false
  }
  return boardOf(slots, cities, "", need, requireStake, markQualified)
}

export function projectRank(ctx: PackCtx, state: Dict, cityId: string, city: Dict): Json {
  const labels = seasonLabels(ctx, state)
  const influence = cityBig(city, "influence")
  const positiveDays = cityBig(city, "positive_days")
  const viewerWallet = walletOf(city, cityId)
  const cities = asEngineDict(state["cities"])
  const slots = liveSlots(state)
  const out: { [key: string]: Json } = {
    influence,
    positive_days: positiveDays,
    qualified: 0n,
    board: [],
  }
  if (labels !== undefined) {
    out["season_label"] = labels.season
    out["period_label"] = labels.period
  }
  let need = 0n
  let requireStake = false
  try {
    const q = qualifyNeed(ctx)
    need = q.need
    requireStake = q.requireStake
  } catch (e) {
    if (e instanceof LoadError) {
      out["board"] = boardOf(slots, cities, viewerWallet, 0n, false, false)
      return out
    }
    throw e
  }
  out["board"] = boardOf(slots, cities, viewerWallet, need, requireStake, true)
  if (isDemoCity(city)) return out
  if (!prizeQualified(city, need, requireStake)) return out
  out["qualified"] = 1n
  const prizeSlots = prizeSlotsOf(state, need, requireStake)
  let prizeRank = 1n
  for (const slot of prizeSlots) {
    if (viewerWallet.length > 0 && slot.wallet === viewerWallet) {
      out["rank"] = prizeRank
      break
    }
    prizeRank += 1n
  }
  return out
}

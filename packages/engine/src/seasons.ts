import { asBig, asDict, asList, asStr } from "./values.js"
import type { Dict } from "./values.js"

function seasonParam(data: Dict, name: string): bigint {
  return asBig(asDict(asDict(asDict(data["seasons"])["params"])[name])["v"])
}

function flagOn(value: unknown): boolean {
  if (value === true) return true
  if (value === false || value === undefined || value === null) return false
  return asBig(value) !== 0n
}

function bpsOf(data: Dict): bigint {
  return seasonParam(data, "prize_curve_alpha_bps")
}

export function shareFloor(pool: bigint, weight: bigint, total: bigint): bigint {
  if (total <= 0n || pool <= 0n || weight <= 0n) return 0n
  return (weight * pool) / total
}

export function zipfWeights(n: bigint, bps: bigint): bigint[] {
  const out: bigint[] = []
  let k = 1n
  while (k <= n) {
    out.push(bps / k)
    k += 1n
  }
  return out
}

export type ZipfPayout = {
  readonly payouts: readonly bigint[]
  readonly weights: readonly bigint[]
  readonly sumPayout: bigint
  readonly dust: bigint
}

export function zipfPayout(pool: bigint, n: bigint, bps: bigint): ZipfPayout {
  if (n <= 0n) {
    return { payouts: [], weights: [], sumPayout: 0n, dust: pool > 0n ? pool : 0n }
  }
  const weights = zipfWeights(n, bps)
  let total = 0n
  for (const w of weights) total += w
  const payouts: bigint[] = []
  let paid = 0n
  for (const w of weights) {
    const share = shareFloor(pool, w, total)
    payouts.push(share)
    paid += share
  }
  const leftover = pool - paid
  return { payouts, weights, sumPayout: paid, dust: leftover > 0n ? leftover : 0n }
}

type Slot = {
  wallet: string
  cityId: string
  influence: bigint
  positiveDays: bigint
  spend: bigint
}

export type PrizeRow = {
  readonly wallet: string
  readonly city_id: string
  readonly influence: bigint
  readonly rank: bigint
  readonly payout: bigint
  readonly amounts: Readonly<Record<string, bigint>>
}

export type AssetRankRow = {
  readonly wallet: string
  readonly city_id: string
  readonly rank: bigint
  readonly payout: bigint
}

export type AssetPayout = {
  readonly sum_payout: bigint
  readonly dust: bigint
  readonly pool: bigint
  readonly invariant_ok: bigint
  readonly payouts: readonly AssetRankRow[]
}

export type SeasonSettle = {
  readonly payouts: readonly PrizeRow[]
  readonly n_eligible: bigint
  readonly n_paid: bigint
  readonly sum_payout: bigint
  readonly dust: bigint
  readonly pool_left: bigint
  readonly dust_by_asset: Readonly<Record<string, bigint>>
  readonly by_asset: Readonly<Record<string, AssetPayout>>
  readonly codes: readonly string[]
  readonly assets: readonly string[]
  readonly asset: string
  readonly kettle: string
  readonly mints_capital: bigint
  readonly live: bigint
  readonly need_days: bigint
  readonly invariant_ok: bigint
  readonly qualify_rejected: bigint
  readonly share_cap_applied: bigint
  readonly share_cap_bps: bigint
}

function prizeAssets(data: Dict): readonly string[] {
  const seas = asDict(data["seasons"])
  const override = seas["prize_assets"]
  if (Array.isArray(override)) {
    const out: string[] = []
    for (const x of override) out.push(asStr(x))
    return out
  }
  const single = asStr(seas["prize_asset"])
  if (single.length > 0) return [single]
  const districts = asDict(asDict(data["districts"])["districts"])
  const out: string[] = []
  for (const did of Object.keys(districts)) {
    out.push(asStr(asDict(districts[did])["ticker"]))
  }
  return out
}

function shareCapBps(data: Dict, bps: bigint): bigint {
  const seas = asDict(data["seasons"])
  if (flagOn(seas["disable_share_cap"])) return 0n
  const seam = seas["prize_share_cap_over_contribution_bps"]
  if (seam !== undefined && seam !== null && seam !== "") return asBig(seam)
  const params = asDict(seas["params"])
  if ("prize_share_cap_over_contribution_bps" in params) {
    return asBig(asDict(params["prize_share_cap_over_contribution_bps"])["v"])
  }
  const archs = asDict(asDict(data["sim"])["archetypes"])
  const deps: bigint[] = []
  for (const id of Object.keys(archs)) {
    deps.push(asBig(asDict(asDict(asDict(archs[id])["deposit_multiple_bps"]))["v"]))
  }
  if (deps.length === 0) return 0n
  const pairN = 1n + 1n
  const rankRow = zipfPayout(bps, pairN, bps)
  const rank1 = rankRow.payouts.length > 0 ? (rankRow.payouts[0] ?? 0n) : 0n
  let k = 1n
  for (const dep of deps) {
    let other = 0n
    for (const d of deps) {
      if (d !== dep && d > other) other = d
    }
    if (other === 0n) other = dep
    const pair = dep + other
    if (pair <= 0n) continue
    const contrib = (dep * bps) / pair
    if (contrib <= 0n) continue
    const need = (rank1 * bps + contrib - 1n) / contrib
    if (need > k) k = need
  }
  return k
}

function poolMap(data: Dict, pool: bigint | Dict): Record<string, bigint> {
  const assets = prizeAssets(data)
  const out: Record<string, bigint> = {}
  if (typeof pool === "object" && pool !== null) {
    const src = asDict(pool)
    for (const a of assets) {
      out[a] = a in src ? asBig(src[a]) : 0n
    }
    return out
  }
  for (const a of assets) out[a] = pool
  return out
}

function shareCapMax(
  pool: bigint,
  contrib: bigint,
  totalContrib: bigint,
  kBps: bigint,
  nEligible: bigint,
  bps: bigint,
): bigint {
  if (nEligible <= 1n || pool <= 0n || kBps <= 0n) return pool
  if (totalContrib <= 0n || contrib <= 0n) return 0n
  return (pool * contrib * kBps) / (totalContrib * bps)
}

function qualifyDays(data: Dict, bps: bigint): bigint {
  const season = asBig(asDict(asDict(asDict(data["balance"])["params"])["season_city_days"])["v"])
  const periods = seasonParam(data, "prize_periods_per_season")
  if (periods <= 0n) return 0n
  const period = season / periods
  return (period * seasonParam(data, "season_qualify_bps")) / bps
}

function settleHour(data: Dict): bigint {
  return asBig(asDict(asDict(asDict(data["time"])["params"])["efficiency_recalc_hour"])["v"])
}

function periodDays(data: Dict): bigint {
  const season = asBig(asDict(asDict(asDict(data["balance"])["params"])["season_city_days"])["v"])
  const n = seasonParam(data, "prize_periods_per_season")
  if (n <= 0n) return 0n
  return season / n
}

export function intensityBps(gdp: bigint, capex: bigint, bps: bigint): bigint {
  return (gdp * bps) / (capex > 1n ? capex : 1n)
}

export function coverageBps(producing: bigint, opened: bigint, bps: bigint): bigint {
  if (opened <= 0n) return bps
  return (producing * bps) / opened
}

export function stabilityBps(validTicks: bigint, ticksDay: bigint, bps: bigint): bigint {
  if (ticksDay <= 0n) return 0n
  return (validTicks * bps) / ticksDay
}

export function iDay(intensity: bigint, stability: bigint, efficiency: bigint, coverage: bigint, bps: bigint): bigint {
  let x = (intensity * stability) / bps
  x = (x * efficiency) / bps
  x = (x * coverage) / bps
  return x
}

export function positiveDay(gdpDay: bigint): boolean {
  return gdpDay > 0n
}

export function accumulateDay(
  city: Dict,
  gdpDay: bigint,
  validTicks: bigint,
  createdDay: bigint,
  closedDay: bigint,
  ticksDay: bigint,
  bps: bigint,
): bigint {
  if (createdDay > 0n && closedDay < createdDay) return 0n
  const capex = asBig(city["capex"], asBig(city["deposit_spent"]))
  const intensity = intensityBps(gdpDay, capex, bps)
  const stability = ticksDay <= 0n ? 0n : (validTicks * bps) / ticksDay
  let eff = asBig(city["district_efficiency_bps"], bps)
  const districts = city["district_efficiency"]
  if (districts && typeof districts === "object") {
    const slots = asDict(districts)
    const keys = Object.keys(slots)
    if (keys.length > 0) {
      let sum = 0n
      let n = 0n
      for (const did of keys) {
        sum += asBig(asDict(slots[did])["efficiency_bps"], bps)
        n += 1n
      }
      if (n > 0n) eff = sum / n
    }
  }
  const opened = BigInt(asList(city["districts"]).length)
  const producing = asBig(city["producing"], opened)
  const coverage = coverageBps(producing, opened, bps)
  const delta = iDay(intensity, stability, eff, coverage, bps)
  city["influence"] = asBig(city["influence"]) + delta
  if (positiveDay(gdpDay)) city["positive_days"] = asBig(city["positive_days"]) + 1n
  return delta
}

export function consumeAfterSettle(city: Dict): void {
  city["influence"] = 0n
  city["positive_days"] = 0n
  city["spend_protocol_period"] = 0n
}

export function periodSettleDue(data: Dict, cityDay: bigint, hour: bigint): boolean {
  if (hour !== settleHour(data)) return false
  const pd = periodDays(data)
  if (pd <= 0n || cityDay <= 1n) return false
  return (cityDay - 1n) % pd === 0n
}

export function seasonSettleDue(data: Dict, cityDay: bigint, hour: bigint): boolean {
  if (hour !== settleHour(data)) return false
  const sd = asBig(asDict(asDict(asDict(data["balance"])["params"])["season_city_days"])["v"])
  if (sd <= 0n || cityDay <= 1n) return false
  return (cityDay - 1n) % sd === 0n
}

function settlementCodes(data: Dict, cityDay: bigint, hour: bigint): readonly string[] {
  const codes: string[] = []
  if (periodSettleDue(data, cityDay, hour)) codes.push("PRIZE_PERIOD_SETTLED")
  if (seasonSettleDue(data, cityDay, hour)) codes.push("SEASON_SETTLED")
  return codes
}

export function seasonSettle(
  data: Dict,
  rows: readonly Dict[],
  pool: bigint | Dict,
  hopStale = false,
  cityDay = -1n,
  hour = -1n,
): SeasonSettle {
  const bps = bpsOf(data)
  const need = qualifyDays(data, bps)
  const requireStake = flagOn(seasonParam(data, "prize_require_live_stake"))
  const livePay = flagOn(seasonParam(data, "season_prizes_live"))
  const topN = seasonParam(data, "prize_top_n")
  const demoReal = flagOn(asDict(data["seasons"])["demo_prize_real"])
  const demoAfter = flagOn(asDict(data["seasons"])["demo_after_qualify"])
  const scope = asStr(asDict(asDict(asDict(data["seasons"])["scope"])["leaderboard_scope"])["v"])
  const cityScope = scope === "city"
  const codes: string[] = []
  const assets = prizeAssets(data)
  const kBps = shareCapBps(data, bps)
  const forceCapN1 = flagOn(asDict(data["seasons"])["force_share_cap_n1"])

  const isDemo = (row: Dict): boolean => flagOn(row["demo"]) || demoReal

  const bySlot = new Map<string, Slot>()
  const ingest = (row: Dict, skipDemo: boolean): void => {
    const cityId = asStr(row["city_id"])
    const wallet = asStr(row["wallet"], cityId)
    const influence = asBig(row["influence"])
    const pos = asBig(row["positive_days"])
    const stake = flagOn(row["live_stake"])
    const spend = asBig(row["spend_protocol"])
    if (isDemo(row)) {
      if (!skipDemo) codes.push("DEMO_NO_PRIZE")
      return
    }
    if (pos < need) {
      codes.push("PRIZE_NOT_QUALIFIED")
      return
    }
    if (requireStake && !stake) {
      codes.push("PRIZE_STAKE_REQUIRED")
      return
    }
    const slotKey = cityScope ? cityId : wallet
    const cur = bySlot.get(slotKey)
    if (cur === undefined) {
      bySlot.set(slotKey, { wallet, cityId, influence, positiveDays: pos, spend })
    } else if (!cityScope) {
      codes.push("PRIZE_WALLET_MERGED")
      cur.spend += spend
      if (influence > cur.influence || (influence === cur.influence && cityId < cur.cityId)) {
        cur.influence = influence
        cur.cityId = cityId
        cur.positiveDays = pos
      }
    }
  }

  if (demoAfter) {
    for (const row of rows) ingest(row, true)
    for (const row of rows) {
      if (isDemo(row)) codes.push("DEMO_NO_PRIZE")
    }
  } else {
    for (const row of rows) {
      if (isDemo(row)) codes.push("DEMO_NO_PRIZE")
    }
    for (const row of rows) ingest(row, true)
  }

  const eligible = [...bySlot.values()].sort((a, b) => {
    if (a.influence === b.influence) return a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0
    return a.influence > b.influence ? -1 : 1
  })
  const pools = poolMap(data, pool)
  if (hopStale) {
    codes.push("PRIZE_HOP_STALE")
    for (const a of assets) pools[a] = 0n
  }
  let allEmpty = true
  for (const a of assets) {
    if ((pools[a] ?? 0n) > 0n) allEmpty = false
  }
  if (allEmpty) codes.push("PRIZE_POOL_EMPTY")
  const nEligible = BigInt(eligible.length)
  const nPay = nEligible < topN ? nEligible : topN
  const capN = forceCapN1 && nEligible <= 1n ? 1n + 1n : nEligible
  const shareCapApplied = kBps > 0n && capN > 1n ? 1n : 0n
  let totalContrib = 0n
  for (const rec of eligible) totalContrib += rec.spend

  const payoutRows: PrizeRow[] = []
  const dustByAsset: Record<string, bigint> = {}
  const byAsset: Record<string, AssetPayout> = {}
  let paid = 0n
  if (nPay <= 0n) {
    codes.push("PRIZE_NO_ELIGIBLE")
    for (const a of assets) {
      const empty = zipfPayout(pools[a] ?? 0n, 0n, bps)
      dustByAsset[a] = empty.dust
      byAsset[a] = {
        sum_payout: 0n,
        dust: empty.dust,
        pool: pools[a] ?? 0n,
        invariant_ok: 1n,
        payouts: [],
      }
    }
  } else {
    const ranked: Slot[] = []
    let take = 0n
    for (const rec of eligible) {
      if (take >= nPay) break
      ranked.push(rec)
      take += 1n
    }
    const amountsByRank: Record<string, bigint>[] = []
    let fill = 0
    while (fill < ranked.length) {
      amountsByRank.push({})
      fill += 1
    }
    for (const a of assets) {
      const zipf = zipfPayout(pools[a] ?? 0n, nPay, bps)
      let assetPaid = 0n
      const assetRows: AssetRankRow[] = []
      let i = 0
      for (const rec of ranked) {
        let amt = 0n
        if (livePay) {
          amt = zipf.payouts[i] ?? 0n
          if (shareCapApplied === 1n) {
            const capAmt = shareCapMax(pools[a] ?? 0n, rec.spend, totalContrib, kBps, capN, bps)
            if (amt > capAmt) {
              amt = capAmt
              codes.push("PRIZE_SHARE_CAPPED")
            }
          }
        }
        const slot = amountsByRank[i]
        if (slot !== undefined) slot[a] = amt
        assetPaid += amt
        assetRows.push({
          wallet: rec.wallet,
          city_id: rec.cityId,
          rank: BigInt(i) + 1n,
          payout: amt,
        })
        i += 1
      }
      let dustA = (pools[a] ?? 0n) - assetPaid
      if (dustA < 0n) dustA = 0n
      dustByAsset[a] = dustA
      byAsset[a] = {
        sum_payout: assetPaid,
        dust: dustA,
        pool: pools[a] ?? 0n,
        invariant_ok: assetPaid <= (pools[a] ?? 0n) ? 1n : 0n,
        payouts: assetRows,
      }
      paid += assetPaid
    }
    if (flagOn(asDict(data["seasons"])["cross_asset_dust"]) && assets.length > 1) {
      const a0 = assets[0]
      const a1 = assets[1]
      if (a0 !== undefined && a1 !== undefined) {
        const moved = dustByAsset[a0] ?? 0n
        dustByAsset[a0] = 0n
        dustByAsset[a1] = (dustByAsset[a1] ?? 0n) + moved
        const left = byAsset[a0]
        const right = byAsset[a1]
        if (left !== undefined) {
          byAsset[a0] = { ...left, dust: 0n }
        }
        if (right !== undefined) {
          byAsset[a1] = { ...right, dust: dustByAsset[a1] ?? 0n }
        }
      }
    }
    let rank = 1n
    let ri = 0
    for (const rec of ranked) {
      const amounts = amountsByRank[ri] ?? {}
      let sumAmt = 0n
      for (const a of assets) sumAmt += amounts[a] ?? 0n
      payoutRows.push({
        wallet: rec.wallet,
        city_id: rec.cityId,
        influence: rec.influence,
        rank,
        payout: sumAmt,
        amounts,
      })
      rank += 1n
      ri += 1
    }
  }
  if (cityDay < 0n) {
    codes.push("SEASON_SETTLED")
  } else {
    const settleAt = hour < 0n ? settleHour(data) : hour
    for (const c of settlementCodes(data, cityDay, settleAt)) codes.push(c)
  }
  let dust = 0n
  for (const a of assets) dust += dustByAsset[a] ?? 0n
  let invariantOk = 1n
  for (const a of assets) {
    if ((byAsset[a]?.invariant_ok ?? 1n) === 0n) invariantOk = 0n
  }
  let qualifyRejected = 0n
  for (const c of codes) {
    if (c === "PRIZE_NOT_QUALIFIED") qualifyRejected = 1n
  }
  const kettleMonth = "month"
  return {
    payouts: payoutRows,
    n_eligible: nEligible,
    n_paid: BigInt(payoutRows.length),
    sum_payout: paid,
    dust: dust > 0n ? dust : 0n,
    pool_left: dust > 0n ? dust : 0n,
    dust_by_asset: dustByAsset,
    by_asset: byAsset,
    codes,
    assets: [...assets],
    asset: assets.length === 1 ? (assets[0] ?? "") : assets.join(","),
    kettle: kettleMonth,
    mints_capital: 0n,
    live: livePay ? 1n : 0n,
    need_days: need,
    invariant_ok: invariantOk,
    qualify_rejected: qualifyRejected,
    share_cap_applied: shareCapApplied,
    share_cap_bps: kBps,
  }
}

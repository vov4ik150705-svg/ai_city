import { bi2, bi10000 } from "./literals.js"
import { asBig, asBool, asDict, asList, asStr, sortedKeys } from "./values.js"
import type { Dict } from "./values.js"

const BPS = bi10000
const CODE_NO_CLAIMS = "FRAGMENT_NO_CLAIMS"
const CODE_POOL_EMPTY = "FRAGMENT_POOL_EMPTY"
const CODE_CITY_CAPPED = "FRAGMENT_CITY_CAPPED"
const CODE_WINDOW_SETTLED = "FRAGMENT_WINDOW_SETTLED"
const CODE_SHARE_CAPPED = "PRIZE_SHARE_CAPPED"

function districtPlayable(data: Dict, did: string): boolean {
  if (!did) return false
  const row = asDict(asDict(asDict(data["districts"])["districts"])[did])
  return asBool(row["playable_v1"])
}

function tickAccrues(data: Dict, building: Dict, status: string, idle: boolean, paid: string): boolean {
  if (asBool(building["force_fragment_accrual"])) return true
  if (idle || status !== paid) return false
  if (asStr(building["tier"]) !== "beacon") return false
  const did = asStr(building["district"])
  if (!did) return false
  return districtPlayable(data, did)
}

function composedRate(mags: readonly bigint[], bps: bigint): bigint {
  if (mags.length === 0) return bps
  let num = 1n
  for (const m of mags) num *= bps + m
  let den = 1n
  let i = 1
  while (i < mags.length) {
    den *= bps
    i += 1
  }
  return den === 0n ? num : num / den
}

export function accrueAmount(
  data: Dict,
  grossOutput: bigint,
  rateMags: readonly bigint[],
  building: Dict,
  status: string,
  idle: boolean,
  bps: bigint,
  paid: string,
): bigint {
  if (!tickAccrues(data, building, status, idle, paid)) return 0n
  const composed = composedRate(rateMags, bps)
  if (grossOutput <= 0n || composed <= 0n) return 0n
  return (grossOutput * composed) / bps
}

export function windowDays(data: Dict): bigint {
  return asBig(asDict(asDict(asDict(data["fragments"])["params"])["fragment_window_city_days"])["v"])
}

export function windowSettleDue(data: Dict, cityDay: bigint, hour: bigint): boolean {
  const settleHour = asBig(asDict(asDict(asDict(data["time"])["params"])["efficiency_recalc_hour"])["v"])
  if (hour !== settleHour) return false
  const days = windowDays(data)
  if (days <= 0n || cityDay <= 1n) return false
  return (cityDay - 1n) % days === 0n
}

function mulPow(base: bigint, growth: bigint, exp: bigint, bps: bigint): bigint {
  let out = base
  let i = 0n
  while (i < exp) {
    out = (out * growth) / bps
    i += 1n
  }
  return out
}

export function fragmentGrossBase(
  authored: unknown,
  costL1: bigint,
  outputWeightBps: bigint | undefined,
  outputGrowthBps: bigint,
  level: bigint,
  payback: bigint,
  bps: bigint,
): bigint {
  if (authored !== undefined && authored !== null) {
    if (typeof authored === "object" && !Array.isArray(authored)) {
      const row = asDict(authored)
      const key = level.toString()
      if (key in row) return asBig(row[key])
      if ("v" in row) return asBig(row["v"])
    }
    return asBig(authored)
  }
  const ow = outputWeightBps && outputWeightBps > 0n ? outputWeightBps : bps
  if (payback <= 0n || costL1 <= 0n) return 0n
  const out1 = (costL1 * ow) / (bps * payback)
  const exp = level > 0n ? level - 1n : 0n
  return mulPow(out1, outputGrowthBps > 0n ? outputGrowthBps : bps, exp, bps)
}

function flagOn(value: unknown): boolean {
  if (value === true) return true
  if (value === false || value === undefined || value === null) return false
  return asBig(value) !== 0n
}

function payoutRaw(frag: bigint, pool: bigint, total: bigint, rounding: "floor" | "ceil"): bigint {
  if (total <= 0n || frag <= 0n || pool <= 0n) return 0n
  if (rounding === "ceil") return (frag * pool + total - 1n) / total
  return (frag * pool) / total
}

export function settle(
  fragments: readonly bigint[],
  pool: bigint,
  capBps: bigint,
  bps: bigint,
  wipePoolOnZero = false,
  redistributeDust = false,
  contributions?: readonly bigint[],
  shareCapBps = 0n,
  applyCap?: boolean,
  applyShareCap?: boolean,
  rounding: "floor" | "ceil" = "floor",
): Dict {
  let nClaim = 0n
  let total = 0n
  for (const f of fragments) {
    total += f
    if (f > 0n) nClaim += 1n
  }
  const codes: string[] = []
  if (total <= 0n) {
    if (wipePoolOnZero) {
      return {
        payouts: fragments.map(() => 0n),
        dust: 0n,
        pool_left: 0n,
        capped: fragments.map(() => 0n),
        n_claiming: 0n,
        codes: [CODE_NO_CLAIMS],
        sum_payout: 0n,
        cap_applied: 0n,
      }
    }
    return {
      payouts: fragments.map(() => 0n),
      dust: pool,
      pool_left: pool,
      capped: fragments.map(() => 0n),
      n_claiming: 0n,
      codes: [CODE_NO_CLAIMS],
      sum_payout: 0n,
      cap_applied: 0n,
    }
  }
  if (pool <= 0n) {
    return {
      payouts: fragments.map(() => 0n),
      dust: 0n,
      pool_left: 0n,
      capped: fragments.map(() => 0n),
      n_claiming: nClaim,
      codes: [CODE_POOL_EMPTY],
      sum_payout: 0n,
      cap_applied: 0n,
    }
  }
  const useCap = applyCap === undefined ? nClaim >= bi2 : applyCap
  const capAmt = useCap ? (pool * capBps) / bps : pool
  const payouts: bigint[] = []
  const capped: bigint[] = []
  for (const f of fragments) {
    const raw = payoutRaw(f, pool, total, rounding)
    if (useCap && raw > capAmt) {
      payouts.push(capAmt)
      capped.push(1n)
      codes.push(CODE_CITY_CAPPED)
    } else {
      payouts.push(raw)
      capped.push(0n)
    }
  }
  const useShare = applyShareCap === undefined ? nClaim > 1n : applyShareCap
  if (contributions !== undefined && contributions.length === fragments.length && shareCapBps > 0n && useShare) {
    let totalC = 0n
    for (const c of contributions) totalC += c
    for (let i = 0; i < fragments.length; i++) {
      const contrib = contributions[i] ?? 0n
      const maxI = totalC <= 0n || contrib <= 0n ? 0n : (pool * contrib * shareCapBps) / (totalC * bps)
      const pay = payouts[i] ?? 0n
      if (pay > maxI) {
        payouts[i] = maxI
        codes.push(CODE_SHARE_CAPPED)
      }
    }
  }
  let paid = 0n
  for (const p of payouts) paid += p
  let dust = pool - paid
  if (redistributeDust && dust > 0n && nClaim > 0n) {
    const extra = dust / nClaim
    if (extra > 0n) {
      for (let i = 0; i < fragments.length; i++) {
        const frag = fragments[i] ?? 0n
        if (frag > 0n) payouts[i] = (payouts[i] ?? 0n) + extra
      }
      paid = 0n
      for (const p of payouts) paid += p
      dust = pool - paid
    }
  }
  if (paid > pool) codes.push("PAYOUT_EXCEEDS_POOL")
  codes.push(CODE_WINDOW_SETTLED)
  const left = dust > 0n ? dust : 0n
  return {
    payouts,
    dust: left,
    pool_left: left,
    capped,
    n_claiming: nClaim,
    codes,
    sum_payout: paid,
    cap_applied: useCap ? 1n : 0n,
  }
}

export function settleFromData(data: Dict, fragments: readonly bigint[], pool: bigint): Dict {
  const section = asDict(data["fragments"])
  const cap = asBig(asDict(asDict(section["params"])["fragment_city_cap_bps"])["v"])
  const rounding = asStr(section["rounding"]) === "ceil" ? "ceil" : "floor"
  return settle(
    fragments,
    pool,
    cap,
    BPS,
    flagOn(section["wipe_pool_on_zero_claims"]),
    flagOn(section["redistribute_dust"]),
    undefined,
    0n,
    flagOn(section["force_cap_n1"]) ? true : undefined,
    undefined,
    rounding,
  )
}

export function settleCities(data: Dict, cities: Dict, pools: Dict | bigint): Dict {
  const ids = sortedKeys(cities)
  const tickers = new Set<string>()
  for (const cid of ids) {
    const city = asDict(cities[cid])
    const ledger = city["fragment_ledger"]
    if (ledger && typeof ledger === "object" && !Array.isArray(ledger)) {
      for (const t of Object.keys(asDict(ledger))) tickers.add(t)
    }
  }
  if (tickers.size === 0) {
    const result: Dict = { tickers: {}, codes: [CODE_NO_CLAIMS] }
    for (const cid of ids) {
      const city = asDict(cities[cid])
      if (city["fragment_ledger"] !== undefined || city["fragment_pool"] !== undefined) {
        city["fragment_settlement"] = result
      }
    }
    return result
  }
  const poolMap = typeof pools === "object" ? asDict(pools) : {}
  const defaultPool = typeof pools === "object" ? 0n : asBig(pools)
  const byTicker: Dict = {}
  const codes: string[] = []
  for (const ticker of [...tickers].sort()) {
    const frags: bigint[] = []
    for (const cid of ids) {
      const ledger = asDict(asDict(cities[cid])["fragment_ledger"] ?? {})
      frags.push(asBig(ledger[ticker]))
    }
    let pool = asBig(poolMap[ticker], defaultPool)
    if (pool <= 0n) {
      for (const cid of ids) {
        pool = asBig(asDict(cities[cid])["fragment_pool"])
        if (pool > 0n) break
      }
    }
    const row = settleFromData(data, frags, pool)
    byTicker[ticker] = row
    for (const c of asList(row["codes"])) codes.push(asStr(c))
    const leftover = asBig(row["pool_left"])
    if (typeof pools === "object") poolMap[ticker] = leftover
    const payouts = asList(row["payouts"])
    for (let i = 0; i < ids.length; i++) {
      const cid = ids[i]
      if (cid === undefined) continue
      const city = asDict(cities[cid])
      const pay = asBig(payouts[i])
      const owed = asDict(city["fragment_owed"] ?? {})
      owed[ticker] = asBig(owed[ticker]) + pay
      city["fragment_owed"] = owed
      if (leftover > 0n && typeof pools !== "object") city["fragment_pool"] = leftover
    }
  }
  const compact: Dict = {}
  for (const t of Object.keys(byTicker)) {
    const row = asDict(byTicker[t])
    compact[t] = { payouts: row["payouts"], dust: row["dust"], n_claiming: row["n_claiming"] }
  }
  for (const cid of ids) {
    const city = asDict(cities[cid])
    city["fragment_ledger"] = {}
    city["fragment_settlement"] = { tickers: compact, codes }
  }
  return { tickers: byTicker, codes }
}

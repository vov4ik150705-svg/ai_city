import { asBig, asDict, asList, asStr } from "./values.js"
import type { Dict } from "./values.js"

export const STATUS_OPEN = "open"
export const STATUS_SETTLED = "settled"
export const STATUS_EXPIRED = "expired"

export function bankShareBps(levels: Dict, level: bigint): bigint {
  const row = levels[level.toString()]
  if (row !== undefined && row !== null && typeof row === "object" && !Array.isArray(row)) {
    return asBig(asDict(row)["share_bps"])
  }
  if (row !== undefined && row !== null) return asBig(row)
  return 0n
}

export function cityBankShareBps(cfg: Dict, city: Dict): bigint {
  let share = bankShareBps(asDict(cfg["bank_levels"]), asBig(city["bank_level"]))
  if (share <= 0n && asBig(city["bank_level"]) > 0n) share = asBig(cfg["bank_l1_share_bps"])
  share += asBig(city["bank_share_bonus_bps"])
  return share
}

export function globalCapWei(depthWei: bigint, poolShareBps: bigint, bps: bigint): bigint {
  if (depthWei <= 0n || poolShareBps <= 0n) return 0n
  return (depthWei * poolShareBps) / bps
}

export function personalCapWei(depthWei: bigint, poolShareBps: bigint, shareBps: bigint, bps: bigint): bigint {
  return (globalCapWei(depthWei, poolShareBps, bps) * shareBps) / bps
}

export function resetDayCounters(state: Dict, day: bigint): void {
  if (state["bank_day"] === day) return
  state["bank_day"] = day
  state["bank_used_today_wei"] = 0n
  state["bank_reserved_today_wei"] = 0n
  const cities = asDict(state["cities"])
  for (const cid of Object.keys(cities)) {
    const city = asDict(cities[cid])
    city["withdrawn_day"] = 0n
    city["reserved_day"] = 0n
  }
}

export function remainingGlobal(state: Dict, depthWei: bigint, poolShareBps: bigint, bps: bigint): bigint {
  const cap = globalCapWei(depthWei, poolShareBps, bps)
  const used = asBig(state["bank_used_today_wei"])
  const reservedToday = asBig(state["bank_reserved_today_wei"])
  let prior = 0n
  const day = state["bank_day"]
  for (const raw of asList(state["bank_reservations"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asDict(raw)
    if (asStr(row["status"]) !== STATUS_OPEN) continue
    if (row["day"] !== day) prior += asBig(row["eth"])
  }
  const left = cap - used - reservedToday - prior
  return left > 0n ? left : 0n
}

export function authorize(
  state: Dict,
  city: Dict,
  ethAsk: bigint,
  day: bigint,
  depthWei: bigint,
  poolShareBps: bigint,
  shareBps: bigint,
  vid: string,
  bps: bigint,
): Dict {
  resetDayCounters(state, day)
  const personal = personalCapWei(depthWei, poolShareBps, shareBps, bps)
  let roomP = personal - asBig(city["withdrawn_day"]) - asBig(city["reserved_day"])
  if (roomP < 0n) roomP = 0n
  const roomG = remainingGlobal(state, depthWei, poolShareBps, bps)
  const room = roomP < roomG ? roomP : roomG
  let take = ethAsk
  if (take > room) take = room
  if (take < 0n) take = 0n
  const row: Dict = {
    id: vid,
    city_id: asStr(city["id"]),
    eth: take,
    depth_snapshot: depthWei,
    day,
    status: STATUS_OPEN,
  }
  const bag = asList(state["bank_reservations"])
  bag.push(row)
  state["bank_reservations"] = bag
  state["bank_reserved_today_wei"] = asBig(state["bank_reserved_today_wei"]) + take
  city["reserved_day"] = asBig(city["reserved_day"]) + take
  return row
}

export function present(state: Dict, city: Dict, vid: string): Dict | undefined {
  for (const raw of asList(state["bank_reservations"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asDict(raw)
    if (asStr(row["id"]) !== vid) continue
    if (asStr(row["status"]) !== STATUS_OPEN) continue
    const eth = asBig(row["eth"])
    row["status"] = STATUS_SETTLED
    if (row["day"] === state["bank_day"]) {
      let reserved = asBig(state["bank_reserved_today_wei"]) - eth
      if (reserved < 0n) reserved = 0n
      state["bank_reserved_today_wei"] = reserved
      let cityRes = asBig(city["reserved_day"]) - eth
      if (cityRes < 0n) cityRes = 0n
      city["reserved_day"] = cityRes
      state["bank_used_today_wei"] = asBig(state["bank_used_today_wei"]) + eth
      city["withdrawn_day"] = asBig(city["withdrawn_day"]) + eth
    }
    return row
  }
  return undefined
}

export function expire(state: Dict, city: Dict, vid: string): Dict | undefined {
  const today = state["bank_day"]
  for (const raw of asList(state["bank_reservations"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asDict(raw)
    if (asStr(row["id"]) !== vid) continue
    if (asStr(row["status"]) !== STATUS_OPEN) return row
    const eth = asBig(row["eth"])
    row["status"] = STATUS_EXPIRED
    if (row["day"] === today) {
      let reserved = asBig(state["bank_reserved_today_wei"]) - eth
      if (reserved < 0n) reserved = 0n
      state["bank_reserved_today_wei"] = reserved
      let cityRes = asBig(city["reserved_day"]) - eth
      if (cityRes < 0n) cityRes = 0n
      city["reserved_day"] = cityRes
    }
    return row
  }
  return undefined
}

export function reservedAgainstCity(state: Dict, cityId: string): bigint {
  let total = 0n
  for (const raw of asList(state["bank_reservations"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const row = asDict(raw)
    if (asStr(row["status"]) !== STATUS_OPEN) continue
    if (asStr(row["city_id"]) !== cityId) continue
    total += asBig(row["eth"])
  }
  return total
}

export function refundAllowed(backing: bigint, amount: bigint, reservedWei: bigint, weiPerBacking: bigint): boolean {
  if (amount <= 0n || amount > backing) return false
  let covered = 0n
  if (weiPerBacking > 0n) covered = reservedWei / weiPerBacking
  return backing - covered >= amount
}

export function unstake(city: Dict, ticker: string, amount: bigint, cityTime: bigint, graceHours: bigint, sMin: bigint): Dict {
  const settled = asDict(city["stake_settled"] ?? {})
  const held = asBig(settled[ticker])
  if (amount <= 0n || amount > held) {
    return { ok: 0n, returned: 0n, code: "STAKE_BELOW_THRESHOLD" }
  }
  settled[ticker] = held - amount
  city["stake_settled"] = settled
  const tokens = asDict(city["tokens_held"] ?? {})
  tokens[ticker] = asBig(tokens[ticker]) + amount
  city["tokens_held"] = tokens
  if (asBig(settled[ticker]) < sMin) {
    const pending = asList(city["unstake_pending"])
    pending.push({ ticker, amount, ready_at: cityTime + graceHours })
    city["unstake_pending"] = pending
    const freeze = asDict(city["district_freeze_until"] ?? {})
    freeze[ticker] = cityTime + graceHours
    city["district_freeze_until"] = freeze
    const codes = asList(city["codes"])
    codes.push("DISTRICT_FREEZING")
    city["codes"] = codes
  }
  return { ok: 1n, returned: amount, code: "" }
}

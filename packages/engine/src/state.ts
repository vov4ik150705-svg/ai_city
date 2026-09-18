import { poolPriceWeiPerWhole, rateRawFromSamples } from "./config.js"
import { asBig, TickError, utf8 } from "./values.js"
import type { Dict } from "./values.js"
import { sha256, sha256First8Be, sha256HeadHex } from "./sha256.js"
import { canonical } from "./canonical.js"

export function seededPrng(cityId: string, tickIndex: bigint, agentId: string, stream: string = ""): bigint {
  const msg = stream
    ? `${cityId}:${tickIndex.toString()}:${agentId}:${stream}`
    : `${cityId}:${tickIndex.toString()}:${agentId}`
  return sha256First8Be(utf8(msg))
}

export function shiftSeedHex(cityId: string, tickIndex: bigint, agentId: string): string {
  return sha256HeadHex(utf8(`${cityId}:${tickIndex.toString()}:${agentId}`))
}

export function companionCommandsHash(commands: unknown): string {
  return hexFull(sha256(canonical(commands)))
}

function hexFull(data: Uint8Array): string {
  const hex = "0123456789abcdef"
  const shift = 1 + 1 + 1 + 1
  const mask = (1 << shift) - 1
  let out = ""
  for (let i = 0; i < data.length; i++) {
    const b = data[i] ?? 0
    out += hex[(b >> shift) & mask] ?? ""
    out += hex[b & mask] ?? ""
  }
  return out
}

export function cityClock(cfg: Dict, tickIndex: bigint): readonly [bigint, bigint, bigint] {
  const ticksDay = asBig(cfg["ticks_day"])
  const absHour = asBig(cfg["anchor_hour"]) + tickIndex
  const hour = ticksDay === 0n ? 0n : absHour % ticksDay
  const dayOffset = ticksDay === 0n ? 0n : absHour / ticksDay
  const day = asBig(cfg["anchor_day"]) + dayOffset
  const week = asBig(cfg["city_week_days"])
  const weekday =
    week === 0n ? 1n : ((asBig(cfg["anchor_weekday"]) - 1n + dayOffset) % week) + 1n
  return [day, hour, weekday]
}

export function resolveCityTime(cfg: Dict, inputs: Dict, fallbackIndex: bigint): readonly [bigint, bigint] {
  const length = asBig(cfg["tick_length_city_hours"])
  const anchor = asBig(cfg["anchor_hour"])
  if ("city_time" in inputs) {
    if (typeof inputs["city_time"] === "number") {
      throw new TickError("I9_FLOAT", fallbackIndex, "-", { bad: 1n })
    }
    const cityTime = asBig(inputs["city_time"])
    const derived = length === 0n ? 0n : (cityTime - anchor) / length
    if ("tick_index" in inputs && asBig(inputs["tick_index"]) !== derived) {
      throw new TickError("CITY_TIME", asBig(inputs["tick_index"]), "-", {
        city_time: cityTime,
        derived,
      })
    }
    return [derived, cityTime]
  }
  const tickIndex = asBig(inputs["tick_index"])
  return [tickIndex, anchor + tickIndex * length]
}

export function emptyDayMon(): Dict {
  return {
    turnover_usd_8dec: 0n,
    tax_eth: 0n,
    requests: 0n,
    bank_wei: 0n,
    drip_corp: 0n,
    drip_cork_corp: 0n,
    minted_fund: 0n,
    buyback_eth: 0n,
    buyback_minted: 0n,
  }
}

export function emptyAcc(): Dict {
  return {
    f_deposit: 0n,
    f_reserve: 0n,
    f_external: 0n,
    f_reinvest: 0n,
    f_entry: 0n,
    f_cork: 0n,
    payroll_paid: 0n,
    payout_ticks: 0n,
    turnover_usd_8dec: 0n,
    bank_cuts: 0n,
    weeks_open: 0n,
    weeks_closed: 0n,
    weeks_cap_bound: 0n,
    weeks_demand_bound: 0n,
    burn_capital: 0n,
    proto_capital: 0n,
    vault_fee_capital: 0n,
    withdrawn_capital: 0n,
    reserve_in_corp: 0n,
    reserve_out_corp: 0n,
    cork_capital: 0n,
    cork_reminted: 0n,
    minted_fund: 0n,
    buyback_eth: 0n,
    buyback_minted: 0n,
    tranche_binds: 0n,
    ratchet_binds: 0n,
    tax_spec_eth: 0n,
    tax_city_eth: 0n,
  }
}

export function newState(cfg: Dict, cities: Dict, flags: Dict = {}): Dict {
  const poolEth = asBig(cfg["pool_eth_seed"])
  const poolCorp = asBig(cfg["pool_corp_seed"])
  const raw = rateRawFromSamples(cfg, poolPriceWeiPerWhole(poolEth, poolCorp, asBig(cfg["wei"])), asBig(cfg["eth_usd_8dec"]))
  const rate = raw > 0n ? (raw < asBig(cfg["capital_anchor"]) ? raw : asBig(cfg["capital_anchor"])) : 0n
  const bps = asBig(cfg["bps"])
  return {
    cfg,
    tick_index: 0n,
    day: asBig(cfg["anchor_day"]),
    hour: asBig(cfg["anchor_hour"]),
    weekday: asBig(cfg["anchor_weekday"]),
    mint_rate: rate,
    rate_ref: raw,
    rate_raw_last: raw,
    ema_buf: raw > 0n ? [raw] : [],
    last_live_tick: 0n,
    stale_hours: 0n,
    pool_eth: poolEth,
    pool_corp: poolCorp,
    vault_corp: 0n,
    reserve_corp: 0n,
    reserve_cork: 0n,
    fund: 0n,
    capital_outstanding: 0n,
    capital_minted_total: 0n,
    corp_deposited_total: 0n,
    treasury_eth: 0n,
    treasury_fund_eth: 0n,
    treasury_basket_eth: 0n,
    treasury_leaderboard_eth: 0n,
    treasury_farm_eth: 0n,
    treasury_studio_eth: 0n,
    treasury_spec_eth: 0n,
    treasury_city_eth: 0n,
    day_budget: 0n,
    tick_budget: 0n,
    day_budget_day: null,
    week_index: 0n,
    week_start_reserve: 0n,
    week_start_virgin: 0n,
    week_start_cork: 0n,
    week_drained_corp: 0n,
    week_drained_virgin: 0n,
    week_shortfall_cap: 0n,
    week_gate: 0n,
    week_started: 0n,
    payroll_day_buf: [],
    day_payroll: 0n,
    day_mon: emptyDayMon(),
    payroll_ratio_bps: bps,
    codes: [],
    cities,
    acc: emptyAcc(),
    mon: {
      i1_slack_min: null,
      i1_slack_min_day: 0n,
      i1_slack_min_bps: null,
      i1_slack_min_bps_day: 0n,
      i7_cov_min: null,
      i7_cov_min_day: 0n,
      i7_cov_min_bps: null,
      i7_cov_min_bps_day: 0n,
      max_virgin_week_drain_bps: 0n,
    },
    bank_day: null,
    bank_used_today_wei: 0n,
    reserve_pays_fee: asBig(flags["reserve_pays_fee"]),
    jitter_on: asBig(flags["jitter_on"]),
  }
}

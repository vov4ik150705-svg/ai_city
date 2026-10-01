import economy from "../../../../../content/params/economy.json"
import time from "../../../../../content/params/time.json"

const BPS = 10000

type ParamFile = { readonly params: Readonly<Record<string, { readonly v: number }>> }

const econ = (economy as ParamFile).params
const clock = (time as ParamFile).params

function param(table: ParamFile["params"], key: string): number {
  const row = table[key]
  if (row === undefined) throw new Error(`book: missing ${key}`)
  return row.v
}

/** Same floor division as content/pack.py mul_bps. */
function mulBps(value: number, rate: number): number {
  return Math.floor((value * rate) / BPS)
}

/** Same steps as content/build.py round_trip. */
function roundTripBps(anchor: number, tax: number, vault: number, markup: number): number {
  const rate = mulBps(anchor, BPS + markup)
  let keep = BPS
  keep = mulBps(keep, BPS - tax)
  keep = mulBps(keep, BPS - vault)
  keep = Math.floor((keep * anchor) / rate)
  keep = mulBps(keep, BPS - tax)
  return BPS - keep
}

function percentFromBps(bps: number): string {
  const whole = Math.floor(bps / 100)
  const frac = bps % 100
  if (frac === 0) return String(whole)
  if (frac % 10 === 0) return `${whole}.${frac / 10}`
  return `${whole}.${String(frac).padStart(2, "0")}`
}

export type BookFacts = {
  readonly neighbourPct: number
  readonly offlineHours: number
  readonly boostLaunch: number
  readonly boostLaunchDays: number
  readonly boost: number
  readonly roundTripPct: string
  readonly unstakeDays: number
}

export function bookFacts(): BookFacts {
  const round = roundTripBps(
    param(econ, "capital_anchor"),
    param(econ, "creator_tax_bps"),
    param(econ, "vault_fee_bps"),
    param(econ, "bank_markup_bps"),
  )
  return {
    neighbourPct: param(econ, "affinity_neighbour_bps") / 100,
    offlineHours: param(clock, "offline_cap_city_hours_base"),
    boostLaunch: param(econ, "payroll_boost_launch_bps") / BPS,
    boostLaunchDays: param(econ, "payroll_boost_launch_city_days"),
    boost: param(econ, "payroll_boost_bps") / BPS,
    roundTripPct: percentFromBps(round),
    unstakeDays: param(econ, "unstake_cooldown_city_days"),
  }
}

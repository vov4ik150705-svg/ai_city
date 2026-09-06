import { asBig, asDict, asList, asStr } from "./values.js"
import type { Dict } from "./values.js"

export function spawnCity(
  cfg: Dict,
  archId: string,
  spec: Dict,
  cityId: string,
  weight: bigint,
  reinvestBps: bigint,
  applyResearch: bigint = 1n,
): Dict {
  const bps = asBig(cfg["bps"])
  const wsOut = asBig(cfg["workshop_out"])
  const policy = asStr(asDict(spec["upgrade_policy"])["v"])
  const multiple = asBig(asDict(spec["deposit_multiple_bps"])["v"])
  const opened = asList(asDict(spec["districts_opened"])["v"])
  const research = asList(asDict(spec["research_order"])["v"])
  let extraShare = 0n
  if (multiple > bps) extraShare = multiple - bps
  let nWs = bps
  if (policy === "width" && extraShare > 0n) nWs = bps + extraShare
  if (policy === "depth" && extraShare > 0n) nWs = bps + extraShare / (1n + 1n)
  let out = (wsOut * nWs) / bps
  let bonus = 0n
  if (applyResearch > 0n && opened.length > 0) {
    bonus = asBig(cfg["stake_bonus_max_bps"]) / (1n + 1n)
  }
  let tools = asBig(cfg["tools_effect_bps"])
  const hasTools = research.some((x) => x === "tools")
  if (applyResearch <= 0n || !hasTools) tools = 0n
  out = (out * (bps + bonus)) / bps
  out = (out * (bps + tools)) / bps
  const w = weight > 0n ? weight : 1n
  return {
    id: cityId,
    arch: archId,
    weight: w,
    capital: 0n,
    earned_life: 0n,
    earned_left: 0n,
    deposit_spent: 0n,
    earned_spent: 0n,
    output_base: out > 0n ? out : wsOut,
    energy_ok: 1n,
    affinity_bps: asBig(cfg["affinity_home_bps"]),
    level_mult_bps: bps,
    mod_bps: bps,
    schedule: "always",
    bank_level: 1n,
    bank_usage: asBig(asDict(spec["bank_usage"])["v"]),
    login_period: asBig(asDict(spec["login_period_city_hours"])["v"]),
    last_login: 0n,
    sell_share_bps: asBig(asDict(spec["sell_share_bps"])["v"]),
    reinvest_bps: reinvestBps,
    deposit_multiple_bps: multiple,
    withdraw_intent: 0n,
    spend_intent: 0n,
    spend_from_earned: 0n,
    withdrawn_day: 0n,
    withdrawn_life_wei: 0n,
    withdrawn_capital: 0n,
    idle: "",
    request: 0n,
    payout: 0n,
    districts: opened,
    offline_denied: 0n,
    corp_held: 0n,
    codes: [],
  }
}

export function archetypes(pack: Dict): Dict {
  const d = "sections" in pack ? asDict(pack["sections"]) : pack
  return asDict(asDict(d["sim"])["archetypes"])
}

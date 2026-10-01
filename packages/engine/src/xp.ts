import { asBig, asDict, asList, asStr } from "./values.js"
import type { Dict } from "./values.js"

export const XP_BASE = 1n
export const TRAIN_XP = 1n

function xpToNext(level: bigint, curve: Dict): bigint {
  if (level <= 0n) return 0n
  return asBig(curve[level.toString()])
}

export function agentLevelMultBps(level: bigint, gainBps: bigint, bps: bigint): bigint {
  if (level <= 0n) return 0n
  return bps + (level - 1n) * gainBps
}

export function applyXp(agent: Dict, amount: bigint, curve: Dict, levelMax: bigint, gainBps: bigint, bps: bigint): Dict {
  if (amount <= 0n) return agent
  let xp = asBig(agent["xp"]) + amount
  let level = asBig(agent["level"], 1n)
  if (level < 1n) level = 1n
  while (level < levelMax) {
    const need = xpToNext(level, curve)
    if (need <= 0n || xp < need) break
    xp -= need
    level += 1n
  }
  if (level > levelMax) level = levelMax
  agent["xp"] = xp
  agent["level"] = level
  agent["level_mult_bps"] = agentLevelMultBps(level, gainBps, bps)
  return agent
}

export function grantWithRemainder(
  agent: Dict,
  whole: bigint,
  bonusBps: bigint,
  curve: Dict,
  levelMax: bigint,
  gainBps: bigint,
  bps: bigint,
): bigint {
  const rem = asBig(agent["xp_remainder"]) + bonusBps
  const extra = rem / bps
  agent["xp_remainder"] = rem % bps
  let granted = whole + extra
  if (granted < 0n) granted = 0n
  applyXp(agent, granted, curve, levelMax, gainBps, bps)
  return granted
}

export function bonusBpsFromMags(mags: readonly bigint[], bps: bigint): bigint {
  if (mags.length === 0) return 0n
  let num = 1n
  for (const m of mags) num *= bps + m
  let den = 1n
  let i = 1
  while (i < mags.length) {
    den *= bps
    i += 1
  }
  const composed = den === 0n ? num : num / den
  const extra = composed - bps
  return extra > 0n ? extra : 0n
}

export function trainComputeCost(baseDraw: bigint, mags: readonly bigint[], bps: bigint): bigint {
  if (mags.length === 0) return baseDraw
  return (baseDraw * (bonusBpsFromMags(mags, bps) + bps)) / bps
}

export function trainTargetOk(city: Dict, trainerId: string, targetId: string): boolean {
  if (!targetId || targetId === trainerId) return false
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    if (asStr(asDict(raw)["id"]) === targetId) return true
  }
  return false
}

export function trainTargetOf(trainer: Dict, city: Dict): string {
  if ("train_target" in trainer) return asStr(trainer["train_target"])
  return asStr(city["train_target"])
}

function magList(value: unknown): bigint[] {
  const out: bigint[] = []
  for (const m of asList(value)) out.push(asBig(m))
  return out
}

export function awardPaidTick(city: Dict, curve: Dict, levelMax: bigint, gainBps: bigint, bps: bigint, cityXpMags?: readonly bigint[]): bigint {
  const slotted = "functions" in city
  if (!slotted) {
    if (asStr(city["idle"]) !== "") return 0n
    if (asBig(city["payout"]) <= 0n && asBig(city["request"]) <= 0n) return 0n
  }
  const agents = asList(city["agents"])
  if (agents.length === 0) return 0n
  const cityBonus = bonusBpsFromMags(cityXpMags ?? magList(city["xp_rate_mags"]), bps)
  let total = 0n
  for (const raw of agents) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    if (asStr(agent["idle"]) !== "") continue
    if (slotted) {
      if (asStr(agent["building_id"]).length === 0) continue
      if (asBig(agent["payout"]) <= 0n && asBig(agent["request"]) <= 0n) continue
    }
    const recip = bonusBpsFromMags(magList(agent["xp_rate_mags"]), bps)
    total += grantWithRemainder(agent, XP_BASE, cityBonus + recip, curve, levelMax, gainBps, bps)
  }
  return total
}

export function awardTrain(
  city: Dict,
  trainer: Dict,
  curve: Dict,
  levelMax: bigint,
  gainBps: bigint,
  bps: bigint,
  cityXpMags?: readonly bigint[],
): bigint {
  const targetId = trainTargetOf(trainer, city)
  const trainerId = asStr(trainer["id"])
  if (!trainTargetOk(city, trainerId, targetId)) return 0n
  let target: Dict | undefined
  for (const raw of asList(city["agents"])) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) continue
    const agent = asDict(raw)
    if (asStr(agent["id"]) === targetId) {
      target = agent
      break
    }
  }
  if (target === undefined) return 0n
  const cityBonus = bonusBpsFromMags(cityXpMags ?? magList(city["xp_rate_mags"]), bps)
  const trainerBonus = bonusBpsFromMags(magList(trainer["xp_rate_mags"]), bps)
  return grantWithRemainder(target, TRAIN_XP, cityBonus + trainerBonus, curve, levelMax, gainBps, bps)
}

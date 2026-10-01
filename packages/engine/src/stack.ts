import { asBig, asDict, asList, asStr, paramV, sortedKeys } from "./values.js"
import type { Dict } from "./values.js"

function composeTerms(terms: readonly bigint[], bps: bigint): readonly [bigint, bigint] {
  const used = terms.length > 0 ? terms : [bps]
  let num = 1n
  for (const t of used) num *= t
  let den = 1n
  let i = 1
  while (i < used.length) {
    den *= bps
    i += 1
  }
  return [den === 0n ? num : num / den, 1n]
}

function composeKeyMags(magnitudes: readonly bigint[], stacking: string, bps: bigint): readonly [bigint, bigint] {
  if (stacking === "add") {
    let s = 0n
    for (const m of magnitudes) s += m
    return [s, 0n]
  }
  if (stacking === "mul") {
    const terms: bigint[] = []
    for (const m of magnitudes) terms.push(bps + m)
    return composeTerms(terms, bps)
  }
  if (stacking === "mul_remainder") {
    const terms: bigint[] = []
    for (const m of magnitudes) terms.push(bps - m)
    return composeTerms(terms, bps)
  }
  throw new Error(`unknown stacking ${stacking}`)
}

function clipComposed(
  value: bigint,
  stacking: string,
  capMin: bigint,
  capMax: bigint,
  bps: bigint,
): readonly [bigint, boolean] {
  if (stacking === "mul") {
    let clipped = value
    if (clipped < capMin) clipped = capMin
    if (clipped > capMax) clipped = capMax
    return [clipped, clipped !== value]
  }
  if (stacking === "mul_remainder") {
    const remainderLo = bps - capMax
    const remainderHi = bps
    let clipped = value
    if (clipped < remainderLo) clipped = remainderLo
    if (clipped > remainderHi) clipped = remainderHi
    if (clipped <= 0n) clipped = 1n
    return [clipped, clipped !== value]
  }
  let clipped = value
  if (clipped < 0n) clipped = 0n
  if (clipped > capMax) clipped = capMax
  return [clipped, clipped !== value]
}

function lookupParam(data: Dict, section: string, name: string): bigint {
  return paramV(asDict(data[section]), name)
}

function sum1To(n: bigint): bigint {
  return (n * (n + 1n)) / (1n + 1n)
}

function progressionV(data: Dict, name: string): bigint {
  return paramV(asDict(data["progression"]), name)
}

export function buildModifierCaps(data: Dict, bps: bigint): Dict {
  const keys = asDict(asDict(data["modifier_keys"])["keys"])
  const anchors = asDict(asDict(data["modifiers"])["cap_anchors"])
  const tiers = progressionV(data, "tier_count")
  const unit = progressionV(data, "countable_unit")
  const base = progressionV(data, "node_effect_base_bps")
  const slotsStart = paramV(asDict(data["agents"]), "slots_start")
  const slotsCap = paramV(asDict(data["agents"]), "slots_cap")
  const out: Dict = {}
  for (const kid of sortedKeys(anchors)) {
    const spec = asDict(anchors[kid])
    const meta = asDict(keys[kid])
    const stacking = asStr(meta["stacking"])
    const storedMax = spec["cap_max"]
    const storedMin = spec["cap_min"]
    let capMax = 0n
    let capMin = 0n
    if (storedMax !== undefined && storedMax !== null) {
      capMax = asBig(storedMax)
      capMin = storedMin !== undefined && storedMin !== null ? asBig(storedMin) : 0n
    } else if (stacking === "mul") {
      const srcSec = asStr(spec["max_section"], "balance")
      capMax = lookupParam(data, srcSec, asStr(spec["max_from"]))
      capMin = capMax > 0n ? (bps * bps) / capMax : 0n
    } else if (stacking === "mul_remainder") {
      const srcSec = asStr(spec["reduction_section"], "balance")
      const raw = lookupParam(data, srcSec, asStr(spec["reduction_from"]))
      if (asStr(spec["reduction_mode"]) === "complement") {
        capMax = bps - raw
      } else {
        capMax = raw
      }
      capMin = 0n
    } else if (kid === "agent_slots") {
      capMax = slotsCap - slotsStart
      capMin = 0n
    } else if (kid === "offline_cap_hours") {
      capMax = unit * sum1To(tiers)
      capMin = 0n
    } else if (kid === "fund_share_bps") {
      capMax = base * sum1To(tiers)
      if (asStr(spec["second_source"]) === "progression_merge") {
        capMax += base
      }
      capMin = 0n
    }
    if (capMax < 0n) capMax = 0n
    out[kid] = {
      cap_max: capMax,
      cap_min: capMin,
      stacking,
      stage: asStr(meta["stage"]),
      scope_kind: asStr(meta["scope_kind"], "building"),
    }
  }
  return out
}

const SKIP_FUSE = new Set([
  "affinity",
  "agent_level",
  "district_efficiency",
  "productivity",
  "objective",
  "base",
  "jitter",
])

export function applyStack(data: Dict, rows: readonly Dict[], bps: bigint): Dict {
  const keysMeta = asDict(asDict(data["modifier_keys"])["keys"])
  const stagesObj = asDict(asDict(data["modifier_keys"])["stages"])
  const stages: string[] = []
  for (const s of asList(stagesObj["order"])) {
    if (typeof s === "string") stages.push(s)
  }
  const caps = buildModifierCaps(data, bps)
  const byKey: { [k: string]: bigint[] } = {}
  const rowStage: { [k: string]: string } = {}
  for (const r of rows) {
    const key = asStr(r["key"])
    if (!byKey[key]) byKey[key] = []
    byKey[key].push(asBig(r["magnitude"]))
    rowStage[key] = asStr(asDict(keysMeta[key])["stage"], "post")
  }
  const modifiers = asDict(data["modifiers"])
  const wipe = modifiers["wipe_on_zero"] === true
  const byKeyOut: Dict = {}
  const clamps: Dict[] = []
  const stageMul: { [k: string]: bigint[] } = {}
  const stageAdd: { [k: string]: bigint } = {}
  for (const st of stages) {
    stageMul[st] = []
    stageAdd[st] = 0n
  }
  let divisions = 0n
  for (const kid of sortedKeys(keysMeta)) {
    const meta = asDict(keysMeta[kid])
    const stacking = asStr(meta["stacking"])
    const mags = byKey[kid] ?? []
    let composed = 0n
    if (wipe && (stacking === "mul" || stacking === "mul_remainder") && mags.some((m) => m === 0n)) {
      composed = 0n
      divisions += 1n
    } else {
      const got = composeKeyMags(mags, stacking, bps)
      composed = got[0]
      divisions += 1n
    }
    const cap = asDict(caps[kid])
    let clipped = composed
    let didClip = false
    const clip = clipComposed(composed, stacking, asBig(cap["cap_min"]), asBig(cap["cap_max"]), bps)
    clipped = clip[0]
    didClip = clip[1]
    if (stacking === "add" && kid === "agent_slots") {
      const slotsCap = paramV(asDict(data["agents"]), "slots_cap")
      const slotsStart = paramV(asDict(data["agents"]), "slots_start")
      let after = slotsStart + clipped
      if (after > slotsCap) after = slotsCap
      if (after !== slotsStart + clipped) {
        didClip = true
        const next = after - slotsStart
        clipped = next < 0n ? 0n : next
      }
    }
    if (didClip) {
      clamps.push({ key: kid, before: composed, after: clipped, code: "MODIFIER_CAP_CLAMPED" })
    }
    byKeyOut[kid] = {
      composed,
      clipped,
      clamped: didClip ? 1n : 0n,
      stacking,
    }
    const st = rowStage[kid] ?? asStr(meta["stage"], "post")
    if (stacking === "add") {
      stageAdd[st] = (stageAdd[st] ?? 0n) + clipped
    } else {
      const bucket = stageMul[st]
      if (bucket) bucket.push(clipped)
      else stageMul[st] = [clipped]
    }
  }
  const mulTerms: bigint[] = []
  const stageFused: { [k: string]: bigint } = {}
  for (const st of stages) {
    if (SKIP_FUSE.has(st)) {
      mulTerms.push(bps)
      stageFused[st] = bps
      continue
    }
    const terms = stageMul[st] ?? []
    if (terms.length === 0) {
      mulTerms.push(bps)
      stageFused[st] = bps
      continue
    }
    const fusedStage = composeTerms(terms, bps)[0]
    mulTerms.push(fusedStage)
    stageFused[st] = fusedStage
  }
  const fusedPair = composeTerms(mulTerms, bps)
  const fused = fusedPair[0]
  divisions += fusedPair[1]
  return {
    by_key: byKeyOut,
    fused_bps: fused,
    clamps,
    divisions,
    stage_add: stageAdd,
    stage_fused: stageFused,
    stage_bps: {
      base: stageFused["base"] ?? bps,
      post: stageFused["post"] ?? bps,
    },
    codes: clamps.map(() => "MODIFIER_CAP_CLAMPED"),
  }
}

import { codes } from "@corporator/protocol"
import type { ActionRow } from "../demo.js"
import type { ClientPack } from "../packview.js"
import type { HudView } from "./model.js"
import type { RefusalView } from "./parts/refusal.js"

export type ActionGate =
  | { readonly kind: "ok" }
  | { readonly kind: "missing"; readonly token: string; readonly code: "UI_UNAVAILABLE" }
  | { readonly kind: "blocked"; readonly refusal: RefusalView }

type TokResult = "pass" | "fail" | "missing"

const SELECT_PREFIX = "districts_select_"

export function evaluateActionGate(args: {
  readonly pack: ClientPack
  readonly action: ActionRow
  readonly view: HudView
  readonly demo: boolean
  readonly extraFailed?: ReadonlySet<string> | undefined
  readonly lookId?: string | undefined
}): ActionGate {
  if (args.action.v1 === "stub") {
    return { kind: "blocked", refusal: { code: codes.FEATURE_NOT_IN_V1, rest: [] } }
  }
  if (args.action.id === "building_build") {
    const district = args.lookId
    const opened = args.view.gate?.openedDistricts
    if (district !== undefined && district.length > 0 && opened !== undefined && !opened.includes(district)) {
      return { kind: "blocked", refusal: { code: codes.DISTRICT_LOCKED, rest: [] } }
    }
  }
  const extra = args.extraFailed ?? new Set<string>()
  const skipDemo = !(args.demo && args.pack.demoIsolated && args.action.demoBlocked)
  const failed: string[] = []
  let firstMissing: string | undefined
  let firstFail: string | undefined
  for (const tok of args.action.requires) {
    const cap = args.pack.capabilities[tok]
    if (cap === undefined) {
      if (firstMissing === undefined && firstFail === undefined) firstMissing = tok
      continue
    }
    if (cap.kind !== "blocking") continue
    if (skipDemo && tok.startsWith("not_demo_")) continue
    const hit = tokenResult(tok, args.pack, args.action, args.view, extra, args.lookId)
    if (hit === "pass") continue
    if (hit === "missing") {
      if (firstMissing === undefined && firstFail === undefined) firstMissing = tok
      continue
    }
    failed.push(tok)
    if (firstFail === undefined && firstMissing === undefined) firstFail = tok
  }
  if (firstMissing !== undefined) {
    return { kind: "missing", token: firstMissing, code: "UI_UNAVAILABLE" }
  }
  if (firstFail === undefined) return { kind: "ok" }
  const shown: string[] = []
  const rest: string[] = []
  let n = 0n
  for (const tok of failed) {
    const cap = args.pack.capabilities[tok]
    if (cap === undefined) continue
    if (n < args.pack.refusalShowCount) shown.push(cap.code)
    else rest.push(cap.code)
    n += 1n
  }
  return { kind: "blocked", refusal: { code: shown[0], rest } }
}

function tokenResult(
  tok: string,
  pack: ClientPack,
  action: ActionRow,
  view: HudView,
  extraFailed: ReadonlySet<string>,
  lookId: string | undefined,
): TokResult {
  switch (tok) {
    case "wallet":
      return view.accountKind === "wallet" ? "pass" : "fail"
    case "wallet_chain": {
      const wrong = view.gate?.chainWrong
      if (wrong === undefined) return "missing"
      return wrong ? "fail" : "pass"
    }
    case "not_demo_withdraw":
    case "not_demo_claim":
    case "not_demo_prize":
      return "fail"
    case "v1_feature":
      return "fail"
    case "city_level":
      return levelTok(view.cityLevelValue)
    case "build_tile":
      return extraFailed.has("build_tile") ? "fail" : "pass"
    case "district_open":
      return districtOpenTok(action.id, lookId, view)
    case "stake_threshold":
      return districtFlag(action.id, lookId, view, "stakeThresholdMet")
    case "tier_unlocked":
      return districtFlag(action.id, lookId, view, "tierUnlocked")
    case "stake_mult":
      return districtFlag(action.id, lookId, view, "stakeMultMet")
    case "node_side":
      return districtFlag(action.id, lookId, view, "nodeSideOpen")
    case "merge_free":
      return districtFlag(action.id, lookId, view, "mergeFree")
    case "season_qualified":
      return flag(view.influenceQualified)
    case "season_stake":
      if (view.stake === undefined) return "missing"
      return view.stake > 0n ? "pass" : "fail"
    case "build_slot":
      return slotTok(pack, view.cityLevelValue, occupiedBuildSlots(pack, view), true)
    case "agent_slot":
      if (view.agentsKind === "unavailable") return "missing"
      return slotTok(pack, view.cityLevelValue, BigInt(view.agents.length), false)
    case "capital":
      if (extraFailed.has("capital")) return "fail"
      if (view.treasury.kind === "unavailable") return "missing"
      return view.treasury.exact === "0" ? "fail" : "pass"
    case "corp":
      if (view.corp === undefined) return "missing"
      return view.corp > 0n ? "pass" : "fail"
    case "bank_open":
      return view.plaque.key === "BANK_SUNDAY" ? "pass" : view.plaque.key === "BANK_CLOSED" ? "fail" : "pass"
    case "bank_weekday":
      return view.plaque.key === "BANK_SUNDAY" ? "fail" : "pass"
    case "bank_limit":
      if (view.bankLimitLive === undefined) return "missing"
      return view.bankLimitLive > 0n ? "pass" : "fail"
    case "hop_priced":
      if (view.quoteLive === undefined) return "missing"
      if (view.quoteAgeMs === 0n) return "fail"
      return view.quoteLive ? "pass" : "fail"
    default:
      return extraFailed.has(tok) ? "fail" : "missing"
  }
}

function districtFlag(
  actionId: string,
  lookId: string | undefined,
  view: HudView,
  key: "stakeThresholdMet" | "tierUnlocked" | "stakeMultMet" | "nodeSideOpen" | "mergeFree",
): TokResult {
  const cityWide = view.gate?.[key]
  const district =
    lookId !== undefined && lookId.length > 0
      ? lookId
      : actionId.startsWith(SELECT_PREFIX)
        ? actionId.slice(SELECT_PREFIX.length)
        : undefined
  if (district !== undefined && district.length > 0) {
    const rows = view.gate?.districts
    if (rows !== undefined) {
      for (const row of rows) {
        if (row.id !== district) continue
        return flag(row[key])
      }
      return "missing"
    }
  }
  return flag(cityWide)
}

function flag(value: boolean | undefined): TokResult {
  if (value === undefined) return "missing"
  return value ? "pass" : "fail"
}

function levelTok(level: bigint | undefined): TokResult {
  if (level === undefined) return "missing"
  return level < 1n ? "fail" : "pass"
}

function slotTok(
  pack: ClientPack,
  level: bigint | undefined,
  used: bigint | undefined,
  build: boolean,
): TokResult {
  if (level === undefined || used === undefined) return "missing"
  const cap = build ? pack.buildSlotsByLevel[level.toString()] : pack.slotsAtCityLevel[level.toString()]
  if (cap === undefined) return "missing"
  return used >= cap ? "fail" : "pass"
}

/** Placed buildings occupy a slot, including deactivated ones. Prebuilt does not. */
function occupiedBuildSlots(pack: ClientPack, view: HudView): bigint | undefined {
  if (view.functionsTotal === undefined) return undefined
  let n = 0n
  for (const row of view.functions) {
    const meta = pack.buildingMeta[row.id]
    if (meta !== undefined && meta.prebuilt) continue
    n += 1n
  }
  return n
}

function districtOpenTok(actionId: string, lookId: string | undefined, view: HudView): TokResult {
  const district =
    lookId !== undefined && lookId.length > 0
      ? lookId
      : actionId.startsWith(SELECT_PREFIX)
        ? actionId.slice(SELECT_PREFIX.length)
        : undefined
  if (district === undefined || district.length === 0) return "missing"
  const opened = view.gate?.openedDistricts
  if (opened === undefined) return "missing"
  return opened.includes(district) ? "pass" : "fail"
}

import { fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { commandRoutes, codes } from "@corporator/protocol"
import { scopedIntentId, postCommand, type PostFn } from "../command.js"
import { asObj } from "../values.js"
import type { ClientSnapshot } from "./snapshot.js"

/** Live mutation effects with an authoritative client snapshot response. */
export const LIVE_MUTATION_EFFECTS = [
  "build",
  "hire",
  "assign",
  "set_objective",
  "research_start",
  "open_district",
  "stake",
  "unlock_tier",
  "pick_node",
  "merge",
  "upgrade",
  "claim_fragment",
  "deposit",
  "withdraw",
  "present_voucher",
  "buy_stock",
  "unstake",
  "claim_unstaked",
] as const

export type LiveMutationEffect = (typeof LIVE_MUTATION_EFFECTS)[number]

export type LiveTransportKind = "live" | "refusal-only" | "unsupported" | "local"

/** Player intent at the HUD boundary. Not a generated command route. */
export type UiIntentKind =
  | "hire"
  | "build"
  | "activate"
  | "deactivate"
  | "set_objective"
  | "claim_prize"
  | "deposit"
  | "withdraw"
  | "buy_stock"
  | "open_district"
  | "stake"
  | "unlock_tier"
  | "pick_node"
  | "merge"
  | "upgrade"
  | "research_start"
  | "claim_fragment"
  | "noop"
  | "present_voucher"
  | "assign"
  | "unstake"
  | "claim_unstaked"
  | "navigate"
  | "local"

export type CommitExtra = { readonly [key: string]: Json }

export type UiIntent =
  | { readonly kind: "hire"; readonly role?: string }
  | { readonly kind: "build"; readonly buildingId: string }
  | { readonly kind: "activate"; readonly buildingId: string }
  | { readonly kind: "deactivate"; readonly buildingId: string }
  | {
      readonly kind: "set_objective"
      readonly agentId?: string
      readonly objective: string
      readonly trainTarget: string
      readonly focus?: string
    }
  | { readonly kind: "claim_prize" }
  | { readonly kind: "deposit"; readonly amount: string }
  | { readonly kind: "withdraw"; readonly amount: string }
  | { readonly kind: "buy_stock"; readonly ticker: string; readonly amount: string }
  | { readonly kind: "open_district"; readonly districtId: string }
  | { readonly kind: "stake"; readonly districtId: string; readonly amount: string }
  | { readonly kind: "unlock_tier"; readonly districtId: string }
  | { readonly kind: "pick_node"; readonly districtId: string; readonly nodeId: string }
  | { readonly kind: "merge"; readonly mergeId: string }
  | { readonly kind: "upgrade"; readonly buildingId: string }
  | { readonly kind: "research_start"; readonly axisId: string }
  | { readonly kind: "claim_fragment" }
  | { readonly kind: "noop" }
  | { readonly kind: "present_voucher"; readonly voucherId?: string }
  | { readonly kind: "assign"; readonly agentId?: string; readonly buildingId?: string }
  | { readonly kind: "unstake" }
  | { readonly kind: "claim_unstaked"; readonly districtId: string }
  | { readonly kind: "navigate"; readonly target: string }
  | { readonly kind: "local"; readonly effect: string }

export type ActionMapRow = {
  readonly intent: UiIntentKind
  readonly effect: string | undefined
  readonly support: LiveTransportKind
}

export type LiveAdapter = {
  readonly dispatch: (intent: UiIntent, extra?: CommitExtra) => Promise<LiveAdapterResult>
}

export type LiveAdapterResult =
  | {
      readonly kind: "applied"
      readonly intent: UiIntentKind
      readonly effect: string
      readonly snapshot: ClientSnapshot
      readonly intentId: string
    }
  | { readonly kind: "local"; readonly intent: UiIntentKind }
  | {
      readonly kind: "unavailable"
      readonly intent: UiIntentKind
      readonly reason: "no-live-route"
      readonly code: string
    }
  | {
      readonly kind: "failed"
      readonly intent: UiIntentKind
      readonly effect: string
      readonly code: string
      readonly httpStatus: number
      readonly retryable: false
      readonly intentId: string
    }

type PostCommandFn = typeof postCommand

const COMMAND_PREFIX = "/command/"

const BY_INTENT: { readonly [K in UiIntentKind]: { readonly effect: string | undefined; readonly support: LiveTransportKind } } =
  {
    hire: { effect: "hire", support: "live" },
    build: { effect: "build", support: "live" },
    activate: { effect: "build", support: "live" },
    deactivate: { effect: "build", support: "live" },
    set_objective: { effect: "set_objective", support: "live" },
    claim_prize: { effect: "claim_prize", support: "refusal-only" },
    deposit: { effect: "deposit", support: "live" },
    withdraw: { effect: "withdraw", support: "live" },
    buy_stock: { effect: "buy_stock", support: "live" },
    open_district: { effect: "open_district", support: "live" },
    stake: { effect: "stake", support: "live" },
    unlock_tier: { effect: "unlock_tier", support: "live" },
    pick_node: { effect: "pick_node", support: "live" },
    merge: { effect: "merge", support: "live" },
    upgrade: { effect: "upgrade", support: "live" },
    claim_fragment: { effect: "claim_fragment", support: "live" },
    noop: { effect: "noop", support: "refusal-only" },
    research_start: { effect: "research_start", support: "live" },
    present_voucher: { effect: "present_voucher", support: "live" },
    assign: { effect: "assign", support: "live" },
    unstake: { effect: "unstake", support: "live" },
    claim_unstaked: { effect: "claim_unstaked", support: "live" },
    navigate: { effect: undefined, support: "local" },
    local: { effect: undefined, support: "local" },
  }

const INTENT_ORDER: readonly UiIntentKind[] = [
  "hire",
  "build",
  "activate",
  "deactivate",
  "set_objective",
  "claim_prize",
  "deposit",
  "withdraw",
  "buy_stock",
  "open_district",
  "stake",
  "unlock_tier",
  "pick_node",
  "merge",
  "upgrade",
  "research_start",
  "claim_fragment",
  "noop",
  "present_voucher",
  "assign",
  "unstake",
  "claim_unstaked",
  "navigate",
  "local",
]

/** Inspectable intent → command effect → live | refusal-only | unsupported | local. */
export const HUD_ACTION_MAP: readonly ActionMapRow[] = INTENT_ORDER.map((intent) => {
  const row = BY_INTENT[intent]
  return { intent, effect: row.effect, support: row.support }
})

const ROUTE_SET: ReadonlySet<string> = new Set(commandRoutes)

export function transportOf(intent: UiIntentKind, launchReady = false): LiveTransportKind {
  if (intent === "claim_prize") return launchReady ? "live" : "refusal-only"
  return BY_INTENT[intent].support
}

export function commandEffectOf(intent: UiIntentKind): string | undefined {
  return BY_INTENT[intent].effect
}

export function commandRouteExists(effect: string): boolean {
  return ROUTE_SET.has(COMMAND_PREFIX + effect)
}

export function isLiveMutationEffect(effect: string, launchReady = false): boolean {
  if (effect === "claim_prize") return launchReady
  for (const row of LIVE_MUTATION_EFFECTS) {
    if (row === effect) return true
  }
  return false
}

const MONEY_REVIEW_INTENTS: ReadonlySet<UiIntentKind> = new Set(["deposit", "withdraw", "buy_stock"])

/** Bank/Exchange review submits. Confirm is live apply; hop Confirm only when the quote is hop-ready. */
export function isMoneyReviewIntent(kind: UiIntentKind): boolean {
  return MONEY_REVIEW_INTENTS.has(kind)
}

export function isUiLocalEffect(effect: string): boolean {
  return (
    effect.startsWith("filter:") ||
    effect.startsWith("toggle:") ||
    effect.startsWith("select:") ||
    effect.startsWith("external:")
  )
}

export function dispatchFromEffect(
  dispatch: LiveAdapter["dispatch"],
  effect: string,
  extra?: CommitExtra,
): Promise<LiveAdapterResult> {
  const intent = extra === undefined ? intentFromCommit(effect) : intentFromCommit(effect, extra)
  return extra === undefined ? dispatch(intent) : dispatch(intent, extra)
}

export function intentFromCommit(effect: string, extra?: CommitExtra): UiIntent {
  if (effect.startsWith("navigate:")) return { kind: "navigate", target: effect.slice("navigate:".length) }
  if (isUiLocalEffect(effect)) return { kind: "local", effect }
  switch (effect) {
    case "hire":
      return { kind: "hire", ...(textField(extra, "role").length > 0 ? { role: textField(extra, "role") } : {}) }
    case "build":
      return buildIntent(extra)
    case "activate":
      return { kind: "activate", buildingId: textField(extra, "building_id") }
    case "deactivate":
      return { kind: "deactivate", buildingId: textField(extra, "building_id") }
    case "set_objective":
      return {
        kind: "set_objective",
        ...(textField(extra, "agent_id").length > 0 ? { agentId: textField(extra, "agent_id") } : {}),
        objective: textField(extra, "objective"),
        trainTarget: textField(extra, "train_target"),
        ...(textField(extra, "focus").length > 0 ? { focus: textField(extra, "focus") } : {}),
      }
    case "claim_prize":
      return { kind: "claim_prize" }
    case "deposit":
      return { kind: "deposit", amount: textField(extra, "amount") }
    case "withdraw":
      return { kind: "withdraw", amount: textField(extra, "amount") }
    case "buy_stock":
      return { kind: "buy_stock", ticker: textField(extra, "ticker"), amount: textField(extra, "amount") }
    case "open_district":
      return { kind: "open_district", districtId: textField(extra, "district_id") }
    case "stake":
      return { kind: "stake", districtId: textField(extra, "district_id"), amount: textField(extra, "amount") }
    case "unlock_tier":
      return { kind: "unlock_tier", districtId: textField(extra, "district_id") }
    case "pick_node":
      return {
        kind: "pick_node",
        districtId: textField(extra, "district_id"),
        nodeId: textField(extra, "node_id"),
      }
    case "merge":
      return { kind: "merge", mergeId: textField(extra, "merge_id") }
    case "upgrade":
      return { kind: "upgrade", buildingId: textField(extra, "building_id") }
    case "research_start":
      return { kind: "research_start", axisId: textField(extra, "axis_id") }
    case "claim_fragment":
      return { kind: "claim_fragment" }
    case "noop":
      return { kind: "noop" }
    case "present_voucher":
      return { kind: "present_voucher" }
    case "assign":
      return {
        kind: "assign",
        ...(textField(extra, "agent_id").length > 0 ? { agentId: textField(extra, "agent_id") } : {}),
        ...(textField(extra, "building_id").length > 0 ? { buildingId: textField(extra, "building_id") } : {}),
      }
    case "unstake":
      return { kind: "unstake" }
    case "claim_unstaked":
      return { kind: "claim_unstaked", districtId: textField(extra, "district_id") }
    default:
      return { kind: "local", effect }
  }
}

export function createLiveAdapter(args: {
  readonly origin: string
  readonly cityId: string
  readonly sessionId: string
  readonly commandTemplate: string
  readonly post: PostFn
  readonly postCommand?: PostCommandFn
  readonly fetchSnapshot: () => Promise<ClientSnapshot>
  readonly cityTime: () => bigint
  readonly nextSeq: () => bigint
  readonly launchReady?: boolean
}): LiveAdapter {
  return {
    dispatch: (intent, extra) => dispatchLive(args, intent, extra),
  }
}

async function dispatchLive(
  args: {
    readonly origin: string
    readonly cityId: string
    readonly sessionId: string
    readonly commandTemplate: string
    readonly post: PostFn
    readonly postCommand?: PostCommandFn
    readonly fetchSnapshot: () => Promise<ClientSnapshot>
    readonly cityTime: () => bigint
    readonly nextSeq: () => bigint
    readonly launchReady?: boolean
  },
  intent: UiIntent,
  extra?: CommitExtra,
): Promise<LiveAdapterResult> {
  const launchReady = args.launchReady === true
  const support = transportOf(intent.kind, launchReady)
  if (support === "local") {
    if (intent.kind === "navigate") return { kind: "local", intent: intent.kind }
    if (intent.kind === "local" && isUiLocalEffect(intent.effect)) {
      return { kind: "local", intent: intent.kind }
    }
    return unavailable(intent.kind)
  }
  if (support === "unsupported" || support === "refusal-only") {
    return unavailable(intent.kind)
  }
  const effect = commandEffectOf(intent.kind)
  if (effect === undefined || !commandRouteExists(effect)) {
    return unavailable(intent.kind)
  }
  const liveEffect: string = effect
  if (support === "live" && !isLiveMutationEffect(liveEffect, launchReady)) {
    return unavailable(intent.kind)
  }
  const body = mergeExtra(intent, extra)
  const send = args.postCommand ?? postCommand
  async function postOnce(cityTime: bigint): Promise<{
    readonly intentId: string
    readonly posted: { readonly status: number; readonly body: Uint8Array }
  }> {
    const intentId = scopedIntentId(args.cityId, args.sessionId, cityTime, args.nextSeq())
    const cmd = {
      origin: args.origin,
      effect: liveEffect,
      commandTemplate: args.commandTemplate,
      cityId: args.cityId,
      sessionId: args.sessionId,
      intentId,
      expectedCityTime: cityTime,
      post: args.post,
    }
    const posted = body !== undefined ? await send({ ...cmd, extra: body }) : await send(cmd)
    return { intentId, posted }
  }
  let cityTime = args.cityTime()
  let intentId = ""
  let posted: { readonly status: number; readonly body: Uint8Array }
  try {
    const first = await postOnce(cityTime)
    intentId = first.intentId
    posted = first.posted
  } catch {
    return failed(intent.kind, liveEffect, "", codes.API_PACK_STALE, 0)
  }
  let envelopeCode = codeFromBody(posted.body)
  if (envelopeCode === codes.API_PACK_STALE) {
    try {
      const fresh = await args.fetchSnapshot()
      cityTime = fresh.cityTime
      const retry = await postOnce(cityTime)
      intentId = retry.intentId
      posted = retry.posted
      envelopeCode = codeFromBody(posted.body)
    } catch {
      return failed(intent.kind, liveEffect, intentId, codes.API_PACK_STALE, posted.status)
    }
  }
  if (envelopeCode !== undefined || posted.status < 200 || posted.status >= 300) {
    return failed(
      intent.kind,
      liveEffect,
      intentId,
      envelopeCode ?? statusFallback(posted.status),
      posted.status,
    )
  }
  if (liveEffect === "claim_prize" && !claimPrizePaid(posted.body)) {
    return failed(
      intent.kind,
      liveEffect,
      intentId,
      claimPrizeCode(posted.body),
      posted.status,
    )
  }
  try {
    const snapshot = await args.fetchSnapshot()
    return { kind: "applied", intent: intent.kind, effect: liveEffect, snapshot, intentId }
  } catch {
    return failed(intent.kind, liveEffect, intentId, codes.API_PACK_STALE, posted.status)
  }
}

function unavailable(intent: UiIntentKind): LiveAdapterResult {
  return {
    kind: "unavailable",
    intent,
    reason: "no-live-route",
    code: codes.FEATURE_NOT_IN_V1,
  }
}

function mergeExtra(intent: UiIntent, extra?: CommitExtra): CommitExtra | undefined {
  const fromIntent = extraFromIntent(intent)
  if (extra === undefined) return fromIntent
  if (fromIntent === undefined) return extra
  return { ...fromIntent, ...extra }
}

/** Body of a wallet prepare/confirm. Intent fields survive even when the caller passes no extra. */
export function chainPayload(
  intent: UiIntent,
  extra: CommitExtra | undefined,
  fields: { readonly [key: string]: Json },
): { readonly [key: string]: Json } {
  const payload: { [key: string]: Json } = { ...fields }
  const merged = mergeExtra(intent, extra)
  if (merged === undefined) return payload
  for (const key of Object.keys(merged)) {
    const val = merged[key]
    if (val !== undefined) payload[key] = val
  }
  return payload
}

function failed(
  intent: UiIntentKind,
  effect: string,
  intentId: string,
  code: string,
  httpStatus: number,
): LiveAdapterResult {
  return {
    kind: "failed",
    intent,
    effect,
    code,
    httpStatus,
    retryable: false,
    intentId,
  }
}

function statusFallback(status: number): string {
  if (status === 400) return codes.API_MALFORMED
  if (status === 401) return codes.API_UNAUTHORIZED
  if (status === 409) return codes.API_PACK_STALE
  if (status === 429) return codes.API_RATE_LIMITED
  return codes.API_PACK_STALE
}

function codeFromBody(body: Uint8Array): string | undefined {
  try {
    const row = asObj(parseJson(fromUtf8(body)))
    const code = row["code"]
    if (typeof code === "string" && code.length > 0) return code
    return undefined
  } catch {
    return undefined
  }
}

function paidAtoms(value: unknown): bigint {
  if (typeof value === "bigint") return value
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value)
  if (typeof value === "string" && value.length > 0) {
    try {
      return BigInt(value)
    } catch {
      return 0n
    }
  }
  return 0n
}

function claimPrizePaid(body: Uint8Array): boolean {
  try {
    const row = asObj(parseJson(fromUtf8(body)))
    const assets = row["assets"]
    if (!Array.isArray(assets)) return false
    for (const item of assets) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      if (paidAtoms(asObj(item)["paid"]) > 0n) return true
    }
    return false
  } catch {
    return false
  }
}

function claimPrizeCode(body: Uint8Array): string {
  try {
    const row = asObj(parseJson(fromUtf8(body)))
    const assets = row["assets"]
    if (!Array.isArray(assets)) return codes.PRIZE_CLAIM_UNCOVERED
    for (const item of assets) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) continue
      const code = asObj(item)["code"]
      if (typeof code === "string" && code.length > 0) return code
    }
  } catch {
    // uncovered
  }
  return codes.PRIZE_CLAIM_UNCOVERED
}

function buildIntent(extra?: CommitExtra): UiIntent {
  const buildingId = textField(extra, "building_id")
  if (extra !== undefined && (extra["deactivate"] === true || extra["active"] === false)) {
    return { kind: "deactivate", buildingId }
  }
  if (extra !== undefined && extra["active"] === true) {
    return { kind: "activate", buildingId }
  }
  return { kind: "build", buildingId }
}

function extraFromIntent(intent: UiIntent): CommitExtra | undefined {
  switch (intent.kind) {
    case "build":
      return { building_id: intent.buildingId }
    case "activate":
      return { building_id: intent.buildingId, active: true }
    case "deactivate":
      return { building_id: intent.buildingId, deactivate: true }
    case "hire":
      return intent.role !== undefined && intent.role.length > 0 ? { role: intent.role } : undefined
    case "set_objective": {
      const body: { [key: string]: Json } = {}
      if (intent.agentId !== undefined && intent.agentId.length > 0) body["agent_id"] = intent.agentId
      if (intent.objective.length > 0) body["objective"] = intent.objective
      if (intent.trainTarget.length > 0) body["train_target"] = intent.trainTarget
      if (intent.focus !== undefined && intent.focus.length > 0) body["focus"] = intent.focus
      return Object.keys(body).length > 0 ? body : undefined
    }
    case "research_start":
      return intent.axisId.length > 0 ? { axis_id: intent.axisId } : undefined
    case "open_district":
      return intent.districtId.length > 0 ? { district_id: intent.districtId } : undefined
    case "stake": {
      const body: { [key: string]: Json } = {}
      if (intent.districtId.length > 0) body["district_id"] = intent.districtId
      if (intent.amount.length > 0) body["amount"] = intent.amount
      return Object.keys(body).length > 0 ? body : undefined
    }
    case "unlock_tier":
      return intent.districtId.length > 0 ? { district_id: intent.districtId } : undefined
    case "pick_node": {
      const body: { [key: string]: Json } = {}
      if (intent.districtId.length > 0) body["district_id"] = intent.districtId
      if (intent.nodeId.length > 0) body["node_id"] = intent.nodeId
      return Object.keys(body).length > 0 ? body : undefined
    }
    case "merge":
      return intent.mergeId.length > 0 ? { merge_id: intent.mergeId } : undefined
    case "upgrade":
      return intent.buildingId.length > 0 ? { building_id: intent.buildingId } : undefined
    case "deposit":
      return intent.amount.length > 0 ? { amount: intent.amount } : undefined
    case "withdraw":
      return intent.amount.length > 0 ? { amount: intent.amount } : undefined
    case "buy_stock": {
      const body: { [key: string]: Json } = {}
      if (intent.ticker.length > 0) body["ticker"] = intent.ticker
      if (intent.amount.length > 0) body["amount"] = intent.amount
      return Object.keys(body).length > 0 ? body : undefined
    }
    case "assign": {
      const body: { [key: string]: Json } = {}
      if (intent.agentId !== undefined && intent.agentId.length > 0) body["agent_id"] = intent.agentId
      if (intent.buildingId !== undefined && intent.buildingId.length > 0) body["building_id"] = intent.buildingId
      return Object.keys(body).length > 0 ? body : undefined
    }
    case "present_voucher":
      return intent.voucherId !== undefined && intent.voucherId.length > 0
        ? { voucher_id: intent.voucherId }
        : undefined
    case "claim_prize":
    case "claim_fragment":
    case "noop":
    case "unstake":
      return undefined
    case "claim_unstaked":
      return intent.districtId.length > 0 ? { district_id: intent.districtId } : undefined
    case "navigate":
    case "local":
      return undefined
    default: {
      const miss: never = intent
      void miss
      return undefined
    }
  }
}

function textField(extra: CommitExtra | undefined, key: string): string {
  if (extra === undefined) return ""
  const val = extra[key]
  return typeof val === "string" ? val : ""
}

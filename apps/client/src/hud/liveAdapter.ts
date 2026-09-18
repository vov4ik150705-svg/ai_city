import { fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { commandRoutes, codes } from "@corporator/protocol"
import { scopedIntentId, postCommand, type PostFn } from "../command.js"
import { asObj } from "../values.js"
import type { ClientSnapshot } from "./snapshot.js"

/** Live mutation effects with an authoritative client snapshot response. */
export const LIVE_MUTATION_EFFECTS = ["build", "hire", "set_objective"] as const

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
  | "navigate"
  | "local"

export type CommitExtra = { readonly [key: string]: Json }

export type UiIntent =
  | { readonly kind: "hire" }
  | { readonly kind: "build"; readonly buildingId: string }
  | { readonly kind: "activate"; readonly buildingId: string }
  | { readonly kind: "deactivate"; readonly buildingId: string }
  | { readonly kind: "set_objective"; readonly objective: string; readonly trainTarget: string }
  | { readonly kind: "claim_prize" }
  | { readonly kind: "deposit"; readonly amount: string }
  | { readonly kind: "withdraw"; readonly amount: string }
  | { readonly kind: "buy_stock"; readonly ticker: string; readonly amount: string }
  | { readonly kind: "open_district" }
  | { readonly kind: "stake" }
  | { readonly kind: "unlock_tier" }
  | { readonly kind: "pick_node" }
  | { readonly kind: "merge" }
  | { readonly kind: "upgrade" }
  | { readonly kind: "research_start"; readonly axisId: string }
  | { readonly kind: "claim_fragment" }
  | { readonly kind: "noop" }
  | { readonly kind: "present_voucher" }
  | { readonly kind: "assign" }
  | { readonly kind: "unstake" }
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
    deposit: { effect: "deposit", support: "refusal-only" },
    withdraw: { effect: "withdraw", support: "refusal-only" },
    buy_stock: { effect: "buy_stock", support: "refusal-only" },
    open_district: { effect: "open_district", support: "refusal-only" },
    stake: { effect: "stake", support: "refusal-only" },
    unlock_tier: { effect: "unlock_tier", support: "refusal-only" },
    pick_node: { effect: "pick_node", support: "refusal-only" },
    merge: { effect: "merge", support: "refusal-only" },
    upgrade: { effect: "upgrade", support: "refusal-only" },
    claim_fragment: { effect: "claim_fragment", support: "refusal-only" },
    noop: { effect: "noop", support: "refusal-only" },
    research_start: { effect: undefined, support: "unsupported" },
    present_voucher: { effect: undefined, support: "unsupported" },
    assign: { effect: undefined, support: "unsupported" },
    unstake: { effect: undefined, support: "unsupported" },
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
  "navigate",
  "local",
]

/** Inspectable intent → command effect → live | refusal-only | unsupported | local. */
export const HUD_ACTION_MAP: readonly ActionMapRow[] = INTENT_ORDER.map((intent) => {
  const row = BY_INTENT[intent]
  return { intent, effect: row.effect, support: row.support }
})

const LIVE_SET: ReadonlySet<string> = new Set(LIVE_MUTATION_EFFECTS)

const ROUTE_SET: ReadonlySet<string> = new Set(commandRoutes)

export function transportOf(intent: UiIntentKind): LiveTransportKind {
  return BY_INTENT[intent].support
}

export function commandEffectOf(intent: UiIntentKind): string | undefined {
  return BY_INTENT[intent].effect
}

export function commandRouteExists(effect: string): boolean {
  return ROUTE_SET.has(COMMAND_PREFIX + effect)
}

export function isLiveMutationEffect(effect: string): boolean {
  for (const row of LIVE_MUTATION_EFFECTS) {
    if (row === effect) return true
  }
  return false
}

const MONEY_REVIEW_INTENTS: ReadonlySet<UiIntentKind> = new Set(["deposit", "withdraw", "buy_stock"])

/** Bank/Exchange review submits. Still refusal-only; never live custody. */
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
      return { kind: "hire" }
    case "build":
      return buildIntent(extra)
    case "activate":
      return { kind: "activate", buildingId: textField(extra, "building_id") }
    case "deactivate":
      return { kind: "deactivate", buildingId: textField(extra, "building_id") }
    case "set_objective":
      return {
        kind: "set_objective",
        objective: textField(extra, "objective"),
        trainTarget: textField(extra, "train_target"),
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
      return { kind: "open_district" }
    case "stake":
      return { kind: "stake" }
    case "unlock_tier":
      return { kind: "unlock_tier" }
    case "pick_node":
      return { kind: "pick_node" }
    case "merge":
      return { kind: "merge" }
    case "upgrade":
      return { kind: "upgrade" }
    case "research_start":
      return { kind: "research_start", axisId: textField(extra, "axis_id") }
    case "claim_fragment":
      return { kind: "claim_fragment" }
    case "noop":
      return { kind: "noop" }
    case "present_voucher":
      return { kind: "present_voucher" }
    case "assign":
      return { kind: "assign" }
    case "unstake":
      return { kind: "unstake" }
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
  },
  intent: UiIntent,
  extra?: CommitExtra,
): Promise<LiveAdapterResult> {
  const support = transportOf(intent.kind)
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
  if (support === "live" && !LIVE_SET.has(effect)) {
    return unavailable(intent.kind)
  }
  const cityTime = args.cityTime()
  const intentId = scopedIntentId(args.cityId, args.sessionId, cityTime, args.nextSeq())
  const body = mergeExtra(intent, extra)
  const cmd = {
    origin: args.origin,
    effect,
    commandTemplate: args.commandTemplate,
    cityId: args.cityId,
    sessionId: args.sessionId,
    intentId,
    expectedCityTime: cityTime,
    post: args.post,
  }
  const send = args.postCommand ?? postCommand
  let posted: { readonly status: number; readonly body: Uint8Array }
  try {
    posted = body !== undefined ? await send({ ...cmd, extra: body }) : await send(cmd)
  } catch {
    return failed(intent.kind, effect, intentId, codes.API_PACK_STALE, 0)
  }
  const envelopeCode = codeFromBody(posted.body)
  if (envelopeCode !== undefined || posted.status < 200 || posted.status >= 300) {
    return failed(
      intent.kind,
      effect,
      intentId,
      envelopeCode ?? statusFallback(posted.status),
      posted.status,
    )
  }
  try {
    const snapshot = await args.fetchSnapshot()
    return { kind: "applied", intent: intent.kind, effect, snapshot, intentId }
  } catch {
    return failed(intent.kind, effect, intentId, codes.API_PACK_STALE, posted.status)
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
    case "set_objective": {
      const body: { [key: string]: Json } = {}
      if (intent.objective.length > 0) body["objective"] = intent.objective
      if (intent.trainTarget.length > 0) body["train_target"] = intent.trainTarget
      return Object.keys(body).length > 0 ? body : undefined
    }
    case "research_start":
      return intent.axisId.length > 0 ? { axis_id: intent.axisId } : undefined
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
    case "hire":
    case "claim_prize":
    case "open_district":
    case "stake":
    case "unlock_tier":
    case "pick_node":
    case "merge":
    case "upgrade":
    case "claim_fragment":
    case "noop":
    case "present_voucher":
    case "assign":
    case "unstake":
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

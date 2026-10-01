import { useRef, useState, type ReactElement } from "react"
import type { Json } from "@corporator/contentpack"
import { navigateTarget } from "../../packview.js"
import { format, lookup, labelKey } from "../../strings.js"
import { resolveHudRoute } from "../navigation.js"
import { intentFromCommit, isMoneyReviewIntent, transportOf } from "../liveAdapter.js"
import { evaluateActionGate } from "../gates.js"
import { HudIcon, type HudGlyph } from "./HudIcon.js"
import { Refusal, refusalFromIntent, shownRefusalText } from "./refusal.js"
import type { ScreenProps } from "./ScreenFrame.js"

const COMMIT = "commit:"

/** One in-flight command. A second click does not open another intent. */
export function openIntentFlight(): { readonly enter: () => boolean; readonly leave: () => void } {
  let open = false
  return {
    enter: () => {
      if (open) return false
      open = true
      return true
    },
    leave: () => {
      open = false
    },
  }
}

export function ActionButton(
  props: ScreenProps & {
    readonly actionId: string
    readonly labelKey?: string
    readonly labelText?: string
    readonly locked?: boolean
    readonly icon?: HudGlyph
    readonly extra?: { readonly [key: string]: Json }
    readonly tone?: "primary" | "ghost"
    readonly warningKey?: string
    readonly warningText?: string
    readonly keepLabel?: boolean
    readonly refusalVars?: { readonly [key: string]: string }
  },
): ReactElement {
  const [commandCode, setCommandCode] = useState("")
  const [inflight, setInflight] = useState(false)
  const flight = useRef(openIntentFlight())
  const action = props.pack.actions[props.actionId]
  if (action === undefined) return <></>
  const effect = action.effect
  const used = new Set<string>()
  const override = props.labelKey
  const lookedUp = override === undefined ? lookup(props.strings, labelKey(action.label), used) : lookup(props.strings, override, used)
  const label = props.labelText !== undefined && props.labelText.length > 0 ? props.labelText : lookedUp
  const extraRole = props.extra?.["role"]
  const extraObjective = props.extra?.["objective"]
  const tone = props.tone === "ghost" ? "hud-btn--ghost" : "hud-btn--primary"
  const extraDistrict = props.extra?.["district_id"]
  const lookId =
    props.lookId !== undefined && props.lookId.length > 0
      ? props.lookId
      : typeof extraDistrict === "string" && extraDistrict.length > 0
        ? extraDistrict
        : undefined
  const gate = evaluateActionGate({
    pack: props.pack,
    action,
    view: props.view,
    demo: props.demo,
    extraFailed: props.failed,
    ...(lookId === undefined ? {} : { lookId }),
  })
  const dest = navigateTarget(effect)
  const routeClosed = dest !== undefined && resolveHudRoute(dest) === undefined
  const gateBlocked = gate.kind !== "ok"
  const blocked = gateBlocked || routeClosed
  const locked = props.locked === true
  const refusalCode = gate.kind === "blocked" ? gate.refusal.code : undefined
  const refusalRest = gate.kind === "blocked" ? gate.refusal.rest : []
  const codeRaw = refusalCode === undefined ? "" : lookup(props.strings, refusalCode, used)
  const codeText = refusalCaption(codeRaw, props.keepLabel === true, props.refusalVars)
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  const intent =
    effect.startsWith(COMMIT) ? intentFromCommit(effect.slice(COMMIT.length), props.extra) : undefined
  const support = intent === undefined ? undefined : transportOf(intent.kind, props.pack.launchDeployed)
  const unsupported = support === "unsupported"
  const refusalOnly = support === "refusal-only"
  const moneyReview = intent !== undefined && isMoneyReviewIntent(intent.kind)
  const notLive = unsupported || (refusalOnly && !moneyReview)
  const blockedCode =
    routeClosed || gate.kind === "missing"
      ? "UI_UNAVAILABLE"
      : refusalCode !== undefined && refusalCode.length > 0
        ? refusalCode
        : locked || notLive
          ? "UI_UNAVAILABLE"
          : ""
  function go(): void {
    if (blocked || locked || notLive || inflight) return
    if (effect.startsWith(COMMIT)) {
      if (intent === undefined) return
      if (!flight.current.enter()) return
      setInflight(true)
      const pending = props.extra === undefined ? props.onIntent(intent) : props.onIntent(intent, props.extra)
      void refusalFromIntent(pending)
        .then((code) => {
          setCommandCode(code)
        })
        .finally(() => {
          flight.current.leave()
          setInflight(false)
        })
      return
    }
    if (dest !== undefined) {
      const agentId = props.extra?.["agent_id"]
      if (typeof agentId === "string" && agentId.length > 0) props.onNavigate(dest, agentId)
      else props.onNavigate(dest)
      return
    }
    props.onLocal(effect)
  }
  const warningKey = props.warningKey
  const warningText = props.warningText
  const showWarning =
    !blocked &&
    !notLive &&
    warningKey !== undefined &&
    warningKey.length > 0 &&
    warningText !== undefined &&
    warningText.length > 0
  return (
    <button
      type="button"
      className={`hud-action hud-btn ${tone}`}
      data-action={props.actionId}
      data-intent={intent === undefined ? "" : intent.kind}
      data-blocked={blocked ? "1" : "0"}
      data-inflight={inflight ? "1" : "0"}
      data-blocked-code={blockedCode}
      data-gate={gate.kind}
      data-unsupported={notLive ? "1" : "0"}
      data-support={support ?? ""}
      data-key={override}
      {...(typeof extraRole === "string" && extraRole.length > 0 ? { "data-role": extraRole } : {})}
      {...(typeof extraObjective === "string" && extraObjective.length > 0 ? { "data-objective": extraObjective } : {})}
      disabled={blocked || locked || notLive || inflight}
      onClick={go}
    >
      {routeClosed || (gate.kind === "missing" && props.keepLabel !== true) ? (
        <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
          {unavailable}
        </span>
      ) : gate.kind === "missing" ? (
        <>
          <span className="hud-action__label">{label}</span>
          <span data-key="UI_UNAVAILABLE" className="hud-action__warn">
            {unavailable}
          </span>
        </>
      ) : blocked && refusalCode !== undefined ? (
        <>
          {props.keepLabel === true ? <span className="hud-action__label">{label}</span> : null}
          <Refusal code={refusalCode} text={codeText} rest={refusalRest} />
        </>
      ) : notLive ? (
        <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
          {unavailable}
        </span>
      ) : (
        <>
          {props.icon === undefined ? null : <HudIcon glyph={props.icon} size="sm" />}
          <span className="hud-action__label">{label}</span>
          {commandCode.length === 0 ? null : (
            <Refusal code={commandCode} text={shownRefusalText(lookup(props.strings, commandCode, used), commandCode)} rest={[]} />
          )}
          {showWarning ? (
            <span data-key={warningKey} data-tone="warn" className="hud-action__warn">
              {warningText}
            </span>
          ) : null}
        </>
      )}
    </button>
  )
}

function refusalCaption(
  raw: string,
  keepLabel: boolean,
  vars: { readonly [key: string]: string } | undefined,
): string {
  if (raw.length === 0) return ""
  if (vars !== undefined) return format(raw, vars)
  if (!raw.includes("{")) return raw
  const cut = raw.indexOf(":")
  const head = cut > 0 ? raw.slice(0, cut).trim() : ""
  if (head.length > 0) return head
  return keepLabel ? raw : ""
}

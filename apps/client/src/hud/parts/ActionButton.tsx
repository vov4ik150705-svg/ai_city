import type { ReactElement } from "react"
import type { Json } from "@corporator/contentpack"
import { navigateTarget } from "../../packview.js"
import { lookup, labelKey } from "../../strings.js"
import { resolveHudRoute } from "../navigation.js"
import { intentFromCommit, isMoneyReviewIntent, transportOf } from "../liveAdapter.js"
import { blockingRefusal, Refusal } from "./refusal.js"
import type { ScreenProps } from "./ScreenFrame.js"

const COMMIT = "commit:"

export function ActionButton(
  props: ScreenProps & {
    readonly actionId: string
    readonly labelKey?: string
    readonly locked?: boolean
    readonly extra?: { readonly [key: string]: Json }
  },
): ReactElement {
  const action = props.pack.actions[props.actionId]
  if (action === undefined) return <></>
  const effect = action.effect
  const used = new Set<string>()
  const override = props.labelKey
  const label = override === undefined ? lookup(props.strings, labelKey(action.label), used) : lookup(props.strings, override, used)
  const hit = blockingRefusal({
    action,
    capabilities: props.pack.capabilities,
    demo: props.demo,
    isolated: props.pack.demoIsolated,
    failed: props.failed,
    showCount: props.pack.refusalShowCount,
  })
  const dest = navigateTarget(effect)
  const routeClosed = dest !== undefined && resolveHudRoute(dest) === undefined
  const blocked = hit.code !== undefined || routeClosed
  const locked = props.locked === true
  const codeText = hit.code === undefined ? "" : lookup(props.strings, hit.code, used)
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  const intent =
    effect.startsWith(COMMIT) ? intentFromCommit(effect.slice(COMMIT.length), props.extra) : undefined
  const support = intent === undefined ? undefined : transportOf(intent.kind)
  const unsupported = support === "unsupported"
  const refusalOnly = support === "refusal-only"
  const moneyReview = intent !== undefined && isMoneyReviewIntent(intent.kind)
  const notLive = unsupported || (refusalOnly && !moneyReview)
  function go(): void {
    if (blocked || locked || notLive) return
    if (effect.startsWith(COMMIT)) {
      if (intent === undefined) return
      const done = props.extra === undefined ? props.onIntent(intent) : props.onIntent(intent, props.extra)
      if (done !== undefined) void done.then(undefined, () => undefined)
      return
    }
    if (dest !== undefined) {
      props.onNavigate(dest)
      return
    }
    props.onLocal(effect)
  }
  return (
    <button
      type="button"
      className="hud-action hud-btn hud-btn--primary"
      data-action={props.actionId}
      data-intent={intent === undefined ? "" : intent.kind}
      data-blocked={blocked ? "1" : "0"}
      data-blocked-code={hit.code ?? ""}
      data-unsupported={notLive ? "1" : "0"}
      data-support={support ?? ""}
      data-key={override}
      disabled={blocked || locked || notLive}
      onClick={go}
    >
      {routeClosed ? (
        <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
          {unavailable}
        </span>
      ) : blocked && hit.code !== undefined ? (
        <Refusal code={hit.code} text={codeText} rest={hit.rest} />
      ) : notLive ? (
        <span data-key="UI_UNAVAILABLE" className="hud-unavailable">
          {unavailable}
        </span>
      ) : (
        label
      )}
    </button>
  )
}

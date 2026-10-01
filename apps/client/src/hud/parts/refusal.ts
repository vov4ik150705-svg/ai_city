import { createElement, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import type { ActionRow, CapabilityRow } from "../../demo.js"

export type RefusalView = {
  readonly code: string | undefined
  readonly rest: readonly string[]
}

export function blockingRefusal(args: {
  readonly action: ActionRow
  readonly capabilities: { readonly [id: string]: CapabilityRow }
  readonly demo: boolean
  readonly isolated: boolean
  readonly failed: ReadonlySet<string>
  readonly showCount: bigint
}): RefusalView {
  if (args.action.v1 === "stub") {
    return { code: codes.FEATURE_NOT_IN_V1, rest: [] }
  }
  const failed = new Set(args.failed)
  const skipDemoTok = !(args.demo && args.isolated && args.action.demoBlocked)
  if (!skipDemoTok) {
    for (const tok of args.action.requires) {
      if (tok.startsWith("not_demo_")) failed.add(tok)
    }
  }
  const gates: { readonly token: string; readonly code: string; readonly tier: bigint }[] = []
  for (const tok of args.action.requires) {
    if (skipDemoTok && tok.startsWith("not_demo_")) continue
    const cap = args.capabilities[tok]
    if (cap === undefined || cap.kind !== "blocking") continue
    gates.push({ token: tok, code: cap.code, tier: cap.tier })
  }
  gates.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier < b.tier ? -1 : 1
    if (a.token < b.token) return -1
    if (a.token > b.token) return 1
    return 0
  })
  const fallen = gates.filter((g) => failed.has(g.token))
  const shown: string[] = []
  const rest: string[] = []
  let n = 0n
  for (const g of fallen) {
    if (n < args.showCount) shown.push(g.code)
    else rest.push(g.code)
    n += 1n
  }
  const first = shown[0]
  return { code: first, rest }
}

export function failedTokens(args: {
  readonly demo: boolean
  readonly walletConnected: boolean
  readonly capitalPositive: boolean
  readonly corpPositive: boolean
  readonly bankOpen: boolean
  readonly bankSunday: boolean
  readonly buildTileIllegal: boolean
}): ReadonlySet<string> {
  const out = new Set<string>()
  if (args.demo) {
    out.add("not_demo_withdraw")
    out.add("not_demo_claim")
    out.add("not_demo_prize")
  }
  if (!args.walletConnected) out.add("wallet")
  if (!args.capitalPositive) out.add("capital")
  if (!args.corpPositive) out.add("corp")
  if (args.bankSunday) out.add("bank_weekday")
  else if (!args.bankOpen) out.add("bank_open")
  if (args.buildTileIllegal) out.add("build_tile")
  out.add("v1_feature")
  return out
}

export function Refusal(props: {
  readonly code: string
  readonly text: string
  readonly rest: readonly string[]
}): ReactElement {
  return createElement(
    "span",
    { "data-refusal": props.code, className: "hud-refusal", title: props.rest.join(" ") },
    props.text,
  )
}

/** Code from a command result. A thrown error keeps the code LiveRoot puts in the message. */
export async function refusalFromIntent(done: void | Promise<unknown>): Promise<string> {
  try {
    const result = await done
    if (result === undefined || result === null || typeof result !== "object") return ""
    const row = result as { readonly kind?: unknown; readonly code?: unknown }
    if ((row.kind === "failed" || row.kind === "unavailable") && typeof row.code === "string") return row.code
    return ""
  } catch (err) {
    if (err instanceof Error && err.message.length > 0) return err.message
    return ""
  }
}

/** Lookup text. An unfilled `{slot}` is cut at the colon so the raw code is not the label. */
export function shownRefusalText(raw: string, code: string): string {
  if (raw.length === 0) return code
  if (!raw.includes("{")) return raw
  const cut = raw.indexOf(":")
  const head = cut > 0 ? raw.slice(0, cut).trim() : ""
  return head.length > 0 ? head : code
}

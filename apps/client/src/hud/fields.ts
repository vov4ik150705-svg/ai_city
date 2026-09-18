/** Value states for a single HUD field. Transaction kinds stay on UiTxnState. */
export const FIELD_KINDS = ["loading", "ready", "stale", "unavailable", "error"] as const

export type FieldKind = (typeof FIELD_KINDS)[number]

export type FieldView = {
  readonly kind: FieldKind
  readonly key: string
  readonly text: string
  readonly exact: string
}

export type StatusRowView = {
  readonly id: string
  readonly key: string
  readonly label: string
  readonly field: FieldView
  readonly tone: "ok" | "bad" | "warn"
}

export type ResourceView = {
  readonly id: string
  readonly key: string
  readonly label: string
  readonly availableLabel: string
  readonly availableLabelKey: string
  readonly demandLabel: string
  readonly demandLabelKey: string
  readonly available: FieldView
  readonly demand: FieldView
}

export type PayrollView = {
  readonly kind: "unavailable" | "ready"
  readonly key: string
  readonly label: string
  readonly text: string
  readonly paidLabel: string
  readonly requestedLabel: string
  readonly coverageLabel: string
  readonly paid: FieldView
  readonly requested: FieldView
  readonly coverage: FieldView
  readonly trim: { readonly key: string; readonly text: string } | undefined
}

export type FunctionsView = {
  readonly kind: "unavailable" | "empty" | "ready"
  readonly key: string
  readonly title: string
  readonly viewAllKey: string
  readonly viewAll: string
  readonly messageKey: string
  readonly message: string
  readonly rows: readonly {
    readonly id: string
    readonly nameKey: string
    readonly name: string
    readonly statusKey: string
    readonly status: string
  }[]
}

/** Localized event row. Mirrors ClientSnapshot.log plus text; no timestamp/entity fields. */
export type EventRowView = {
  readonly id: string
  readonly key: string
  readonly text: string
  readonly badgeKey: string
  readonly badgeText: string
  readonly root: string
  readonly cid: string
}

export type EventsViewKind = "loading" | "error" | "empty" | "ready" | "unavailable"

export type EventsView = {
  readonly kind: EventsViewKind
  readonly key: string
  readonly title: string
  readonly messageKey: string
  readonly message: string
  readonly rows: readonly EventRowView[]
}

export type OverviewTabId = "summary" | "functions" | "production" | "research"

export type OverviewTabView = {
  readonly id: OverviewTabId
  readonly key: string
  readonly label: string
}

export function readyField(key: string, text: string, exact: string): FieldView {
  return { kind: "ready", key, text, exact }
}

export function unavailableField(key: string, text: string): FieldView {
  return stateField("unavailable", key, text)
}

export function loadingField(key: string, text: string): FieldView {
  return stateField("loading", key, text)
}

export function staleField(key: string, text: string): FieldView {
  return stateField("stale", key, text)
}

export function errorField(key: string, text: string): FieldView {
  return stateField("error", key, text)
}

export function isReadyField(field: FieldView): boolean {
  return field.kind === "ready"
}

/** Exact numeric string only when kind is ready. Missing/state fields never become "0". */
export function readyExact(field: FieldView): string | undefined {
  return field.kind === "ready" ? field.exact : undefined
}

export function exactBigint(field: FieldView): bigint | undefined {
  const exact = readyExact(field)
  if (exact === undefined || exact.length === 0) return undefined
  return BigInt(exact)
}

export function formatShare(value: bigint, bps: bigint): string {
  if (bps <= 0n) return value.toString()
  const hundred = 10n * 10n
  return `${((value * hundred) / bps).toString()}%`
}

export function padClockPart(n: bigint): string {
  const s = n.toString()
  if (s.length >= 2) return s
  return `0${s}`
}

export function clockFaceText(hour: bigint): string {
  return `${padClockPart(hour)}:00`
}

/** Axis labels match the reference clock (8:00, not 08:00). */
export function clockBoundText(hour: bigint): string {
  return `${hour.toString()}:00`
}

export function clockDayLabel(raw: string): string {
  return raw.replace(/\s*·\s*/g, " ").replace(/\s+/g, " ").trim()
}

export function clockAxisSpan(openHour: bigint, closeHour: bigint): bigint {
  return closeHour > openHour ? closeHour - openHour : 1n
}

export function clockAxisAlong(hour: bigint, openHour: bigint, closeHour: bigint): bigint {
  const span = clockAxisSpan(openHour, closeHour)
  let along = hour - openHour
  if (along < 0n) along = 0n
  if (along > span) along = span
  return along
}

function stateField(kind: Exclude<FieldKind, "ready">, key: string, text: string): FieldView {
  return { kind, key, text, exact: "" }
}

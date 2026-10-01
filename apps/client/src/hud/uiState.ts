import { codes } from "@corporator/protocol"
import { asFlag, asObj, asText } from "../values.js"

export const UI_STATE_KINDS = [
  "loading",
  "ready",
  "stale",
  "unavailable",
  "error",
  "empty",
  "pending",
  "preparing",
  "review",
  "awaiting_authorization",
  "authorized",
  "reserved",
  "submitted",
  "confirmed",
  "expired",
  "failed",
] as const

export type UiStateKind = (typeof UI_STATE_KINDS)[number]

export type UiLoadingState = { readonly kind: "loading" }
export type UiReadyState = { readonly kind: "ready" }
export type UiStaleState = { readonly kind: "stale"; readonly messageKey: string; readonly code: string }
export type UiUnavailableState = {
  readonly kind: "unavailable"
  readonly messageKey: string
  readonly code: string
}
export type UiErrorState = {
  readonly kind: "error"
  readonly messageKey: string
  readonly code: string
  readonly retryable: boolean
}
export type UiEmptyState = { readonly kind: "empty"; readonly messageKey: string }
export type UiPendingState = { readonly kind: "pending"; readonly messageKey: string }
export type UiPreparingState = { readonly kind: "preparing"; readonly messageKey: string }
export type UiReviewState = { readonly kind: "review"; readonly messageKey: string }
export type UiAwaitingAuthState = { readonly kind: "awaiting_authorization"; readonly messageKey: string }
export type UiAuthorizedState = { readonly kind: "authorized"; readonly messageKey: string }
export type UiReservedState = { readonly kind: "reserved"; readonly messageKey: string }
export type UiSubmittedState = { readonly kind: "submitted"; readonly messageKey: string }
export type UiConfirmedState = { readonly kind: "confirmed"; readonly messageKey: string }
export type UiExpiredState = { readonly kind: "expired"; readonly messageKey: string; readonly code: string }
export type UiFailedState = {
  readonly kind: "failed"
  readonly messageKey: string
  readonly code: string
  readonly retryable: boolean
}

/** Value/collection states. FieldView uses loading/ready/stale/unavailable/error; empty is list-only. */
export type UiValueState =
  | UiLoadingState
  | UiReadyState
  | UiStaleState
  | UiUnavailableState
  | UiErrorState
  | UiEmptyState

/** External transaction state. pending/confirmed live here, not on FieldView. */
export type UiTxnState =
  | UiPendingState
  | UiPreparingState
  | UiReviewState
  | UiAwaitingAuthState
  | UiAuthorizedState
  | UiReservedState
  | UiSubmittedState
  | UiConfirmedState
  | UiExpiredState
  | UiFailedState

export type UiState = UiValueState | UiTxnState

function parseKind(value: unknown): UiStateKind {
  const kind = asText(value)
  for (const row of UI_STATE_KINDS) {
    if (row === kind) return row
  }
  throw new Error(codes.API_MALFORMED)
}

function messageKeyOf(row: { readonly [key: string]: unknown }): string {
  return asText(row["messageKey"])
}

function codeOf(row: { readonly [key: string]: unknown }): string {
  return asText(row["code"])
}

function retryableOf(row: { readonly [key: string]: unknown }): boolean {
  return asFlag(row["retryable"])
}

/** Validates UI state metadata at a JSON/transport boundary. */
export function parseUiState(value: unknown): UiState {
  const row = asObj(value)
  const kind = parseKind(row["kind"])
  switch (kind) {
    case "loading":
      return { kind: "loading" }
    case "ready":
      return { kind: "ready" }
    case "stale":
      return { kind: "stale", messageKey: messageKeyOf(row), code: codeOf(row) }
    case "unavailable":
      return { kind: "unavailable", messageKey: messageKeyOf(row), code: codeOf(row) }
    case "error":
      return {
        kind: "error",
        messageKey: messageKeyOf(row),
        code: codeOf(row),
        retryable: retryableOf(row),
      }
    case "empty":
      return { kind: "empty", messageKey: messageKeyOf(row) }
    case "pending":
      return { kind: "pending", messageKey: messageKeyOf(row) }
    case "preparing":
      return { kind: "preparing", messageKey: messageKeyOf(row) }
    case "review":
      return { kind: "review", messageKey: messageKeyOf(row) }
    case "awaiting_authorization":
      return { kind: "awaiting_authorization", messageKey: messageKeyOf(row) }
    case "authorized":
      return { kind: "authorized", messageKey: messageKeyOf(row) }
    case "reserved":
      return { kind: "reserved", messageKey: messageKeyOf(row) }
    case "submitted":
      return { kind: "submitted", messageKey: messageKeyOf(row) }
    case "confirmed":
      return { kind: "confirmed", messageKey: messageKeyOf(row) }
    case "expired":
      return { kind: "expired", messageKey: messageKeyOf(row), code: codeOf(row) }
    case "failed":
      return {
        kind: "failed",
        messageKey: messageKeyOf(row),
        code: codeOf(row),
        retryable: retryableOf(row),
      }
    default:
      return kind
  }
}

export function uiStateRetryable(state: UiState): boolean {
  switch (state.kind) {
    case "error":
    case "failed":
      return state.retryable
    case "loading":
    case "ready":
    case "stale":
    case "unavailable":
    case "empty":
    case "pending":
    case "preparing":
    case "review":
    case "awaiting_authorization":
    case "authorized":
    case "reserved":
    case "submitted":
    case "confirmed":
    case "expired":
      return false
    default:
      return state
  }
}

export function isLocalReview(state: UiState | undefined): boolean {
  return state !== undefined && state.kind === "review"
}

export function isTxnInFlight(state: UiState | undefined): boolean {
  if (state === undefined) return false
  return state.kind === "submitted" || state.kind === "pending" || state.kind === "awaiting_authorization"
}

export function isTxnPending(state: UiState | undefined): boolean {
  if (state === undefined) return false
  switch (state.kind) {
    case "preparing":
    case "awaiting_authorization":
    case "authorized":
    case "reserved":
    case "submitted":
    case "pending":
      return true
    default:
      return false
  }
}

/** Local review only. Not a server-authorized state. */
export function reviewTxn(): UiTxnState {
  return { kind: "review", messageKey: "UI_TXN_REVIEW" }
}

export function awaitingTxn(): UiTxnState {
  return { kind: "awaiting_authorization", messageKey: "UI_TXN_AWAITING_AUTHORIZATION" }
}

export function waitingTxn(): UiTxnState {
  return { kind: "submitted", messageKey: "UI_TXN_SUBMITTED" }
}

export function submitTxn(current: UiState | undefined): UiTxnState {
  if (current !== undefined && (current.kind === "submitted" || current.kind === "pending")) {
    return current
  }
  if (current === undefined || current.kind !== "review") {
    return { kind: "preparing", messageKey: "UI_TXN_PREPARING" }
  }
  return { kind: "submitted", messageKey: "UI_TXN_SUBMITTED" }
}

export function confirmTxn(): UiTxnState {
  return { kind: "confirmed", messageKey: "UI_TXN_CONFIRMED" }
}

export function failTxn(code: string): UiTxnState {
  return { kind: "failed", messageKey: "UI_TXN_FAILED", code, retryable: false }
}

export function settleTxn(ok: boolean, code = codes.API_PACK_STALE): UiTxnState {
  return ok ? confirmTxn() : failTxn(code)
}

export async function commitReviewedTxn(
  current: UiState | undefined,
  commit: () => void | Promise<void>,
): Promise<UiTxnState> {
  const next = submitTxn(current)
  if (next === current) return next
  if (next.kind !== "submitted") return next
  try {
    await commit()
    return confirmTxn()
  } catch (err) {
    const message = err instanceof Error ? err.message : ""
    return failTxn(message.length > 0 ? message : codes.API_PACK_STALE)
  }
}

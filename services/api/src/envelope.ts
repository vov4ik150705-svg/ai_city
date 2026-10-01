import { canonical, type Json } from "@corporator/contentpack"
import { transportHttp } from "@corporator/protocol"
import { codeSlots, type PackCtx } from "./pack_ctx.js"
import { asBigint, asEngineDict, asText, type Dict } from "./values.js"

export type HttpResult = {
  readonly status: bigint
  readonly body: Uint8Array
  readonly headers: { readonly [name: string]: string }
}

function clockOf(state: Dict): { readonly cityTime: bigint; readonly tickIndex: bigint } {
  return {
    cityTime: asBigint(state["city_time"]),
    tickIndex: asBigint(state["tick_index"]),
  }
}

function transportStatus(code: string): bigint | undefined {
  switch (code) {
    case "API_INTENT_REPLAY":
      return transportHttp.API_INTENT_REPLAY
    case "API_MALFORMED":
      return transportHttp.API_MALFORMED
    case "API_PACK_STALE":
      return transportHttp.API_PACK_STALE
    case "API_RATE_LIMITED":
      return transportHttp.API_RATE_LIMITED
    case "API_UNAUTHORIZED":
      return transportHttp.API_UNAUTHORIZED
    case "CHAIN_TX_UNCONFIRMED":
      return transportHttp.CHAIN_TX_UNCONFIRMED
    case "SERVICE_DEGRADED":
      return transportHttp.SERVICE_DEGRADED
    default:
      return undefined
  }
}

export function statusFor(ctx: PackCtx, code: string): bigint {
  const hit = transportStatus(code)
  if (hit !== undefined) return hit
  return ctx.domainHttp
}

export function envelopeOk(ctx: PackCtx, state: Dict, extra: { readonly [key: string]: Json }): Json {
  const clock = clockOf(state)
  const base: { [key: string]: Json } = {
    city_time: clock.cityTime,
    tick_index: clock.tickIndex,
    pack_hash: ctx.hash,
    rules_version: ctx.rulesVersion,
  }
  for (const key of Object.keys(extra)) {
    const val = extra[key]
    if (val === undefined) continue
    if (key in base) continue
    base[key] = val
  }
  return base
}

export function envelopeErr(ctx: PackCtx, state: Dict, code: string): Json {
  const clock = clockOf(state)
  return {
    code,
    slots: [...codeSlots(ctx, code)],
    city_time: clock.cityTime,
  }
}

export function okResult(ctx: PackCtx, state: Dict, extra: { readonly [key: string]: Json } = {}): HttpResult {
  return {
    status: ctx.httpOk,
    body: canonical(envelopeOk(ctx, state, extra)),
    headers: {},
  }
}

export function errResult(ctx: PackCtx, state: Dict, code: string, retryable?: boolean): HttpResult {
  const row = envelopeErr(ctx, state, code)
  const body =
    retryable === true && row !== null && typeof row === "object" && !Array.isArray(row)
      ? { ...row, retryable: 1n }
      : row
  return {
    status: statusFor(ctx, code),
    body: canonical(body),
    headers: {},
  }
}

export function cityKind(state: Dict, cityId: string): string {
  const cities = asEngineDict(state["cities"])
  const city = asEngineDict(cities[cityId])
  const kind = asText(city["account_kind"])
  if (kind === "demo" || kind === "wallet") return kind
  return "wallet"
}

import { fromUtf8, parseJson } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { type PackCtx } from "./pack_ctx.js"
import { applyLive } from "./commit.js"
import { cityKind, errResult, type HttpResult } from "./envelope.js"
import { incrementCommandRate } from "./rates.js"
import { sessionFromHeaders } from "./session.js"
import { getBytes, putJson, type Store } from "./store.js"
import { asBigint, asObj, asText, type Dict } from "./values.js"

function intentKey(cityId: string, intentId: string): string {
  return cityId + ":" + intentId
}

export async function handleCommand(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  effect: string,
  body: Uint8Array,
  headers: { readonly [name: string]: string },
): Promise<HttpResult> {
  const session = await sessionFromHeaders(ctx, store, state, headers)
  if (session === undefined) return errResult(ctx, state, codes.API_UNAUTHORIZED)
  const cityId = session.cityId
  let parsed
  try {
    parsed = parseJson(fromUtf8(body))
  } catch {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const obj = asObj(parsed)
  const intentId = asText(obj["intent_id"])
  if (intentId.length === 0 || !("expected_city_time" in obj)) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  let expected: bigint
  try {
    expected = asBigint(obj["expected_city_time"])
  } catch {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const prior = await getBytes(store, "intents", intentKey(cityId, intentId))
  if (prior !== undefined) {
    return { status: ctx.httpOk, body: prior, headers: {} }
  }
  const now = asBigint(state["city_time"])
  if (expected !== now) {
    return errResult(ctx, state, ctx.staleCode)
  }
  const tickIndex = asBigint(state["tick_index"])
  const rate = await incrementCommandRate(store, cityId, tickIndex, ctx.rateLimit)
  if (rate === "limited") return errResult(ctx, state, codes.API_RATE_LIMITED)
  let result: HttpResult
  if (ctx.stubEffects.has(effect)) {
    result = errResult(ctx, state, codes.FEATURE_NOT_IN_V1)
  } else {
    const live = applyLive(ctx, state, effect, obj, cityId)
    if (live !== undefined) result = live
    else {
      const refusals = ctx.refusals[effect]
      const first = refusals === undefined ? undefined : refusals[0]
      if (first !== undefined) result = errResult(ctx, state, first)
      else result = errResult(ctx, state, codes.FEATURE_NOT_IN_V1)
    }
  }
  const replay = errResult(ctx, state, ctx.replayCode)
  await putJson(store, "intents", intentKey(cityId, intentId), parseJson(fromUtf8(replay.body)), cityKind(state, cityId))
  return result
}

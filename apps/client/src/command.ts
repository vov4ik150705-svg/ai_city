import { canonical, type Json } from "@corporator/contentpack"
import { sessionHeader, sessionScheme } from "@corporator/protocol"

export type PostFn = (
  url: string,
  body: Uint8Array,
  headers: { readonly [name: string]: string },
) => Promise<{ readonly status: number; readonly body: Uint8Array }>

export function applyPath(template: string, param: string, value: string): string {
  const token = "{" + param + "}"
  return template.split(token).join(value)
}

export async function postCommand(args: {
  readonly origin: string
  readonly effect: string
  readonly commandTemplate: string
  readonly cityId: string
  readonly intentId: string
  readonly expectedCityTime: bigint
  readonly sessionId: string
  readonly extra?: { readonly [key: string]: Json }
  readonly post: PostFn
}): Promise<{ readonly status: number; readonly body: Uint8Array }> {
  void args.cityId
  const path = applyPath(args.commandTemplate, "effect", args.effect)
  const payload: { [key: string]: Json } = {
    intent_id: args.intentId,
    expected_city_time: args.expectedCityTime,
  }
  if (args.extra !== undefined) {
    for (const key of Object.keys(args.extra)) {
      const val = args.extra[key]
      if (val !== undefined) payload[key] = val
    }
  }
  const headers: { [name: string]: string } = {}
  headers[sessionHeader] = sessionScheme + " " + args.sessionId
  return args.post(args.origin + path, canonical(payload), headers)
}

export function nextIntentId(cityId: string, cityTime: bigint, seq: bigint): string {
  return cityId + ":" + cityTime.toString() + ":" + seq.toString()
}

/** Session-scoped id. Backend keys (city_id, intent_id) with no session field. */
export function scopedIntentId(
  cityId: string,
  sessionId: string,
  cityTime: bigint,
  seq: bigint,
): string {
  const base = nextIntentId(cityId, cityTime, seq)
  if (sessionId.length === 0) return base
  return base + ":" + sessionId
}

const INTENT_SEQ_PREFIX = "corporator.intentSeq."

type SeqStorage = {
  readonly getItem: (key: string) => string | null
  readonly setItem: (key: string, value: string) => void
}

function seqKey(sessionId: string): string {
  return INTENT_SEQ_PREFIX + sessionId
}

function liveSeqStorage(): SeqStorage | undefined {
  try {
    if (typeof sessionStorage === "undefined") return undefined
    return sessionStorage
  } catch {
    return undefined
  }
}

/** Survives reload of the same session. New sessionId starts at 0. */
export function loadIntentSeq(sessionId: string, storage?: SeqStorage): bigint {
  if (sessionId.length === 0) return 0n
  const store = storage ?? liveSeqStorage()
  if (store === undefined) return 0n
  try {
    const raw = store.getItem(seqKey(sessionId))
    if (raw === null || raw.length === 0) return 0n
    return BigInt(raw)
  } catch {
    return 0n
  }
}

export function storeIntentSeq(sessionId: string, seq: bigint, storage?: SeqStorage): void {
  if (sessionId.length === 0) return
  const store = storage ?? liveSeqStorage()
  if (store === undefined) return
  try {
    store.setItem(seqKey(sessionId), seq.toString())
  } catch {
    return
  }
}

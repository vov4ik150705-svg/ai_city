import { randomBytes } from "node:crypto"
import { assembleSessionMessage, fromUtf8, parseJson, sessionMessageValues, type Json } from "@corporator/contentpack"
import { spawnCity, plantPrebuilt, type Dict } from "@corporator/engine"
import { codes } from "@corporator/protocol"
import { withWorldLock } from "./city_lock.js"
import { cityKind, errResult, okResult, type HttpResult } from "./envelope.js"
import { type PackCtx } from "./pack_ctx.js"
import { persistLiveState, restoreMemory } from "./tick_host.js"
import { recoverAddress, normalizeAddress } from "./recover.js"
import { getBytes, putJson, type Store } from "./store.js"
import { asBigint, asEngineDict, asObj, asText, jsonToDict, walk } from "./values.js"

export type SessionRow = {
  readonly sessionId: string
  readonly cityId: string
  readonly accountKind: string
  readonly expiresCityTime: bigint
}

function opaqueId(): string {
  return Buffer.from(randomBytes(16)).toString("hex")
}

function nonceKey(nonce: string): string {
  return "n:" + nonce
}

function asPayload(bytes: Uint8Array | undefined): { readonly [key: string]: Json } | undefined {
  if (bytes === undefined) return undefined
  const parsed = parseJson(fromUtf8(bytes))
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return undefined
  return asObj(parsed)
}

function bearerToken(headers: { readonly [name: string]: string }, ctx: PackCtx): string {
  const raw = headers[ctx.sessionHeader.toLowerCase()] ?? headers[ctx.sessionHeader] ?? ""
  const prefix = ctx.sessionScheme + " "
  if (!raw.startsWith(prefix)) return ""
  return raw.slice(prefix.length)
}

function spawnIntoState(ctx: PackCtx, state: Dict, cityId: string, kind: string): void {
  const spec = jsonToDict(walk(ctx.pack, ["sections", "sim", "archetypes", "minimalist"]))
  const city = spawnCity(ctx.cfg, "minimalist", spec, cityId, 1n, 0n)
  city["account_kind"] = kind
  if (kind === "demo") city["demo"] = 1n
  city["city_level"] = 1n
  city["agents"] = []
  city["buildings"] = []
  city["functions"] = []
  city["created_day"] = asBigint(state["day"], 1n)
  plantPrebuilt(ctx.cfg, city)
  const cities = asEngineDict(state["cities"])
  cities[cityId] = city
  state["cities"] = cities
}

function firstUnownedDemo(state: Dict): string | undefined {
  const cities = asEngineDict(state["cities"])
  for (const id of Object.keys(cities)) {
    const city = asEngineDict(cities[id])
    if (asText(city["account_kind"]) !== "demo") continue
    if (asBigint(city["session_bound"]) === 1n) continue
    return id
  }
  return undefined
}

async function writeWorld(
  store: Store,
  state: Dict,
  cityId: string,
  writes: () => Promise<void>,
): Promise<void> {
  let opened = false
  try {
    await store.exec("BEGIN")
    opened = true
    await writes()
    await persistLiveState(store, state, cityId)
    await store.exec("COMMIT")
  } catch (err) {
    if (opened) {
      try {
        await store.exec("ROLLBACK")
      } catch {
        // The original error is the one to surface.
      }
    }
    throw err
  }
}

export async function handleAuthNonce(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  body: Uint8Array,
): Promise<HttpResult> {
  return withWorldLock(() => authNonce(ctx, store, state, body))
}

async function authNonce(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  body: Uint8Array,
): Promise<HttpResult> {
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
  const address = normalizeAddress(asText(obj["address"]))
  if (address.length === 0) return errResult(ctx, state, codes.API_MALFORMED)
  const now = asBigint(state["city_time"])
  const expires = now + ctx.nonceTtlCity
  const nonce = opaqueId()
  await putJson(
    store,
    "sessions",
    nonceKey(nonce),
    { kind: "nonce", address, expires_city_time: expires.toString() },
    "wallet",
  )
  return okResult(ctx, state, { nonce, expires_city_time: expires })
}

export async function handleAuthSession(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  body: Uint8Array,
): Promise<HttpResult> {
  return withWorldLock(() => authSession(ctx, store, state, body))
}

async function authSession(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  body: Uint8Array,
): Promise<HttpResult> {
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
  const kind = asText(obj["account_kind"])
  if (kind === "demo") return issueDemoSession(ctx, store, state)
  const address = normalizeAddress(asText(obj["address"]))
  const nonce = asText(obj["nonce"])
  const signature = asText(obj["signature"])
  if (address.length === 0 || nonce.length === 0 || signature.length === 0) {
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  const nonceRow = asPayload(await getBytes(store, "sessions", nonceKey(nonce)))
  if (nonceRow === undefined) return errResult(ctx, state, codes.API_UNAUTHORIZED)
  const now = asBigint(state["city_time"])
  const expiresNonce = asBigint(nonceRow["expires_city_time"])
  if (asText(nonceRow["kind"]) !== "nonce" || asText(nonceRow["address"]) !== address || expiresNonce < now) {
    return errResult(ctx, state, codes.API_UNAUTHORIZED)
  }
  const message = assembleSessionMessage(
    ctx.sessionMessageFields,
    sessionMessageValues({
      domain: ctx.sessionDomain,
      address,
      nonce,
      packHash: ctx.hash,
      expiresCityTime: expiresNonce.toString(),
    }),
  )
  const recovered = recoverAddress(message, signature)
  if (recovered === undefined || normalizeAddress(recovered) !== address) {
    return errResult(ctx, state, codes.API_UNAUTHORIZED)
  }
  return issueWalletSession(ctx, store, state, address, nonce)
}

async function issueDemoSession(ctx: PackCtx, store: Store, state: Dict): Promise<HttpResult> {
  const snapshot = structuredClone(state)
  try {
    return await issueDemoSessionMut(ctx, store, state)
  } catch (err) {
    restoreMemory(state, snapshot)
    throw err
  }
}

async function issueDemoSessionMut(ctx: PackCtx, store: Store, state: Dict): Promise<HttpResult> {
  const now = asBigint(state["city_time"])
  const expires = now + ctx.sessionTtlCity
  let cityId = firstUnownedDemo(state)
  if (cityId === undefined) {
    cityId = opaqueId()
    spawnIntoState(ctx, state, cityId, "demo")
  }
  const bound = asEngineDict(asEngineDict(state["cities"])[cityId])
  bound["session_bound"] = 1n
  const sessionId = opaqueId()
  await writeWorld(store, state, cityId, async () => {
    await putJson(
      store,
      "sessions",
      sessionId,
      {
        kind: "session",
        city_id: cityId,
        account_kind: "demo",
        expires_city_time: expires.toString(),
      },
      "demo",
    )
    await putJson(store, "city_owners", "demo:" + sessionId, { city_id: cityId }, "demo")
  })
  return okResult(ctx, state, {
    session_id: sessionId,
    city_id: cityId,
    account_kind: "demo",
    expires_city_time: expires,
  })
}

async function issueWalletSession(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  address: string,
  nonce: string,
): Promise<HttpResult> {
  const snapshot = structuredClone(state)
  try {
    return await issueWalletSessionMut(ctx, store, state, address, nonce)
  } catch (err) {
    restoreMemory(state, snapshot)
    throw err
  }
}

async function issueWalletSessionMut(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  address: string,
  nonce: string,
): Promise<HttpResult> {
  const now = asBigint(state["city_time"])
  const expires = now + ctx.sessionTtlCity
  const owned = asPayload(await getBytes(store, "city_owners", address))
  let cityId = asText(owned?.["city_id"])
  const spawned = cityId.length === 0
  if (spawned) {
    cityId = opaqueId()
    spawnIntoState(ctx, state, cityId, "wallet")
  }
  const bound = asEngineDict(asEngineDict(state["cities"])[cityId])
  bound["wallet"] = address
  const sessionId = opaqueId()
  await writeWorld(store, state, cityId, async () => {
    await putJson(store, "sessions", nonceKey(nonce), { kind: "spent" }, "wallet")
    if (spawned) await putJson(store, "city_owners", address, { city_id: cityId }, "wallet")
    await putJson(
      store,
      "sessions",
      sessionId,
      {
        kind: "session",
        city_id: cityId,
        account_kind: "wallet",
        expires_city_time: expires.toString(),
      },
      "wallet",
    )
  })
  return okResult(ctx, state, {
    session_id: sessionId,
    city_id: cityId,
    account_kind: "wallet",
    expires_city_time: expires,
  })
}

export async function sessionFromHeaders(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  headers: { readonly [name: string]: string },
): Promise<SessionRow | undefined> {
  const sessionId = bearerToken(headers, ctx)
  if (sessionId.length === 0) return undefined
  const row = asPayload(await getBytes(store, "sessions", sessionId))
  if (row === undefined) return undefined
  if (asText(row["kind"]) !== "session") return undefined
  const now = asBigint(state["city_time"])
  const expires = asBigint(row["expires_city_time"])
  if (expires < now) return undefined
  const cityId = asText(row["city_id"])
  const accountKind = asText(row["account_kind"])
  if (cityId.length === 0) return undefined
  if (accountKind !== "demo" && accountKind !== "wallet") return undefined
  const kind = cityKind(state, cityId)
  if (kind !== accountKind) return undefined
  return { sessionId, cityId, accountKind, expiresCityTime: expires }
}

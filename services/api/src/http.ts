import { canonical, getPack, type Json, type PackRegistry } from "@corporator/contentpack"
import { codes, transportHttp } from "@corporator/protocol"
import { matchTemplate, type PackCtx } from "./pack_ctx.js"
import { handleCommand } from "./commands.js"
import { envelopeOk, errResult, okResult, type HttpResult } from "./envelope.js"
import { projectState, syncStakeSnapshot } from "./project.js"
import { publicRatingRows } from "./project_rank.js"
import { portCfgFromPack, selectApiPort } from "./custody.js"
import { loadProjectLive } from "./project_live.js"
import { handleAuthNonce, handleAuthSession, sessionFromHeaders } from "./session.js"
import type { Dict } from "./values.js"
import type { Store } from "./store.js"
import type { TickLock } from "./tick_lock.js"

export async function route(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  registry: PackRegistry,
  method: string,
  path: string,
  body: Uint8Array,
  headers: { readonly [name: string]: string },
  live: {
    readonly ready: boolean
    readonly migrationVersion: bigint
    readonly attestLag: bigint
    readonly metrics: Json
    readonly attestLog: readonly {
      readonly id: string
      readonly key: string
      readonly badge: string
      readonly root: string
      readonly cid: string
    }[]
    readonly commandLock: TickLock | undefined
  },
): Promise<HttpResult> {
  if (method === "POST") {
    const nonceHit = matchTemplate(ctx.authNonceTemplate, path)
    if (nonceHit !== undefined) return handleAuthNonce(ctx, store, state, body)
    const sessionHit = matchTemplate(ctx.authSessionTemplate, path)
    if (sessionHit !== undefined) return handleAuthSession(ctx, store, state, body)
    const cmd = matchTemplate(ctx.commandTemplate, path)
    const effect = cmd === undefined ? undefined : cmd["effect"]
    if (effect !== undefined && ctx.commandPaths.indexOf(path) >= 0) {
      return handleCommand(ctx, store, state, effect, body, headers, live.commandLock)
    }
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  if (method === "GET") {
    const packHit = matchTemplate(ctx.packTemplate, path)
    const packHash = packHit === undefined ? undefined : packHit["pack_hash"]
    if (packHash !== undefined) {
      const got = getPack(registry, packHash)
      if (!got.ok) return errResult(ctx, state, got.code)
      return {
        status: ctx.httpOk,
        body: got.body,
        headers: got.headers,
      }
    }
    const stateHit = matchTemplate(ctx.stateTemplate, path)
    const cityId = stateHit === undefined ? undefined : stateHit["city_id"]
    if (cityId !== undefined) {
      const session = await sessionFromHeaders(ctx, store, state, headers)
      if (session === undefined || session.cityId !== cityId) {
        return errResult(ctx, state, codes.API_UNAUTHORIZED)
      }
      const oracle = await loadProjectLive(ctx, store, state, cityId)
      await syncStakeSnapshot(ctx, store, state, cityId, selectApiPort(portCfgFromPack(ctx.pack), process.env))
      return {
        status: ctx.httpOk,
        body: canonical(projectState(ctx, state, cityId, live.attestLog, oracle)),
        headers: {},
      }
    }
    const ratingHit = matchTemplate(ctx.ratingTemplate, path)
    if (ratingHit !== undefined) {
      return okResult(ctx, state, { rows: publicRatingRows(ctx, state) })
    }
    const readyHit = matchTemplate(ctx.readyTemplate, path)
    if (readyHit !== undefined) {
      return {
        status: live.ready ? ctx.httpOk : transportHttp.API_PACK_STALE,
        body: canonical(
          envelopeOk(ctx, state, {
            ready: live.ready,
            migration_version: live.migrationVersion,
            attest_lag: live.attestLag,
            metrics: live.metrics,
          }),
        ),
        headers: {},
      }
    }
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  return errResult(ctx, state, codes.API_MALFORMED)
}

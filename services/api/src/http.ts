import { canonical, getPack, type Json, type PackRegistry } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { matchTemplate, type PackCtx } from "./pack_ctx.js"
import { handleCommand } from "./commands.js"
import { cityKind, envelopeOk, errResult, okResult, type HttpResult } from "./envelope.js"
import { handleAuthNonce, handleAuthSession } from "./session.js"
import { asBigint, asEngineDict, asText, type Dict, walk } from "./values.js"
import type { Store } from "./store.js"

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
      return handleCommand(ctx, store, state, effect, body, headers)
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
      return {
        status: ctx.httpOk,
        body: canonical(projectState(ctx, state, cityId, live.attestLog)),
        headers: {},
      }
    }
    const readyHit = matchTemplate(ctx.readyTemplate, path)
    if (readyHit !== undefined) {
      return okResult(ctx, state, {
        ready: live.ready,
        migration_version: live.migrationVersion,
        attest_lag: live.attestLag,
        metrics: live.metrics,
      })
    }
    return errResult(ctx, state, codes.API_MALFORMED)
  }
  return errResult(ctx, state, codes.API_MALFORMED)
}

function projectState(
  ctx: PackCtx,
  state: Dict,
  cityId: string,
  attestLog: readonly {
    readonly id: string
    readonly key: string
    readonly badge: string
    readonly root: string
    readonly cid: string
  }[],
): Json {
  const sections: { [key: string]: Json } = {}
  for (const id of ctx.stateSources) {
    sections[id] = {}
  }
  const cities = asEngineDict(state["cities"])
  const city = asEngineDict(cities[cityId])
  if (!(cityId in cities)) {
    sections["log.events"] = { rows: [] }
  } else {
    sections["tick.capital"] = asBigint(city["capital"])
    sections["tick.energy"] = asBigint(city["energy"])
    sections["tick.compute"] = asBigint(city["compute"])
    sections["aggregate.payroll_ratio"] = asBigint(state["payroll_ratio_bps"])
    sections["wallet.protocol_eth_in_flight"] = asBigint(city["protocol_eth_in_flight"])
    sections["wallet.protocol_vault_corp"] = asBigint(city["protocol_vault_corp"])
    sections["wallet.protocol_studio_eth"] = asBigint(city["protocol_studio_eth"])
    const basket: { [ticker: string]: Json } = {
      notice: asText(city["prize_notice"]),
      eth_pots: {
        leaderboard: asBigint(state["treasury_leaderboard_eth"]),
        farm: asBigint(state["treasury_farm_eth"]),
        studio: asBigint(state["treasury_studio_eth"]),
      },
    }
    try {
      const raw = walk(ctx.pack, ["generated", "seasons", "prize_assets"])
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item !== "string") continue
          const pots = asEngineDict(asEngineDict(city["prize_kettles"])[item])
          basket[item] = {
            farm: asBigint(pots["farm"]),
            month: asBigint(pots["month"]),
          }
        }
      }
    } catch {
      // pack path missing: leave notice-only basket
    }
    sections["seasons.prize_basket"] = basket
  }
  const rows: Json[] = []
  for (const row of attestLog) {
    rows.push({ id: row.id, key: row.key, badge: row.badge, root: row.root, cid: row.cid })
  }
  sections["log.events"] = { rows }
  return envelopeOk(ctx, state, {
    city_id: cityId,
    account_kind: cityKind(state, cityId),
    sections,
  })
}

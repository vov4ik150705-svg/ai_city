import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { canonical, fromUtf8, loadPack, parseJson } from "@corporator/contentpack"
import { authSessionTemplate } from "@corporator/protocol"
import { mintFromBacking, newState, spawnCity, type Dict } from "@corporator/engine"
import { makeCtx } from "../src/pack_ctx.ts"
import { createHost, type ApiHost } from "../src/host.ts"
import { asBigint, asEngineDict, asObj, asText, jsonToDict } from "../src/values.ts"
import { openPglite, type Store } from "../src/store.ts"

export const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

export function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

export function migrationSql(): { readonly sql: string; readonly name: string } {
  const name = "001_from_pack.sql"
  const sql = readFileSync(join(repo, "services/api/migrations", name), "utf8")
  return { sql, name }
}

export function makeInputs(cfg: Dict, tickIndex: bigint, extra: Dict = {}): Dict {
  const length = asBigint(cfg["tick_length_city_hours"])
  return {
    tick_index: tickIndex,
    city_time: asBigint(cfg["anchor_hour"]) + tickIndex * length,
    eth_usd_8dec: asBigint(cfg["eth_usd_8dec"]),
    corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
    feed_live: 1n,
    pack_hash: asText(cfg["pack_hash"]),
    dex_turnover_usd_8dec: 0n,
    city_id: "a",
    ...extra,
  }
}

export function armFund(state: Dict, cfg: Dict): void {
  const units = asBigint(cfg["capital_anchor"])
  const ticks = asBigint(cfg["ticks_day"])
  const div = asBigint(cfg["payroll_daily_divisor"])
  state["fund"] = units * div * ticks
  state["day_budget"] = div === 0n ? 0n : asBigint(state["fund"]) / div
  state["tick_budget"] = ticks === 0n ? 0n : asBigint(state["day_budget"]) / ticks
  state["day_budget_day"] = asBigint(cfg["anchor_day"])
}

export function liveGenesis(cfg: Dict, pack: Dict): Dict {
  const spec = asEngineDict(
    asEngineDict(asEngineDict(asEngineDict(pack["sections"])["sim"])["archetypes"])["minimalist"],
  )
  const city = spawnCity(cfg, "minimalist", spec, "a", 1n, 0n)
  city["login_period"] = 1n
  city["output_base"] = asBigint(cfg["workshop_out"])
  city["account_kind"] = "demo"
  city["city_level"] = 1n
  city["agents"] = []
  city["buildings"] = []
  const state = newState(cfg, { a: city }, {})
  armFund(state, cfg)
  state["day_budget_day"] = null
  return state
}

export async function bootHost(): Promise<ApiHost> {
  const bytes = packBytes()
  const mig = migrationSql()
  const loaded = loadPack(bytes)
  const ctx = makeCtx(loaded)
  const genesis = liveGenesis(ctx.cfg, jsonToDict(loaded.pack))
  return createHost(bytes, mig.sql, mig.name, genesis)
}

export async function bootHostOn(store: Store): Promise<ApiHost> {
  const bytes = packBytes()
  const mig = migrationSql()
  const loaded = loadPack(bytes)
  const ctx = makeCtx(loaded)
  const genesis = liveGenesis(ctx.cfg, jsonToDict(loaded.pack))
  return createHost(bytes, mig.sql, mig.name, genesis, async () => store)
}

export function seedPlayerCapital(host: ApiHost, cityId: string, want: bigint): bigint {
  const cfg = host.ctx.cfg
  const city = asEngineDict(asEngineDict(host.state["cities"])[cityId])
  const rate = asBigint(host.state["mint_rate"])
  const wei = asBigint(cfg["wei"])
  const bps = asBigint(cfg["bps"])
  const fee = asBigint(cfg["vault_fee_bps"])
  const denom = rate * (bps - fee)
  const backing = denom <= 0n ? want : (want * wei * bps) / denom + wei
  const minted = mintFromBacking(cfg, host.state, backing, 0n, 1n, cityId)
  city["capital"] = asBigint(city["capital"]) + minted
  return asBigint(city["capital"])
}

export { asBigint, asEngineDict, asObj, asText }
export { openPglite }
export { createHost }

export async function demoAuth(host: ApiHost): Promise<{
  readonly sessionId: string
  readonly cityId: string
  readonly headers: { readonly authorization: string }
}> {
  const res = await host.handle("POST", authSessionTemplate, canonical({ account_kind: "demo" }))
  const parsed = parseJson(fromUtf8(res.body))
  const obj = asObj(parsed)
  const sessionId = asText(obj["session_id"])
  const cityId = asText(obj["city_id"])
  return {
    sessionId,
    cityId,
    headers: { authorization: "Bearer " + sessionId },
  }
}

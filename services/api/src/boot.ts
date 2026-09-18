import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadPack } from "@corporator/contentpack"
import { newState, spawnCity, type Dict } from "@corporator/engine"
import { createHost, type ApiHost, type OpenStore } from "./host.js"
import { openPglite } from "./store.js"
import { makeCtx } from "./pack_ctx.js"
import { asBigint, asEngineDict, jsonToDict } from "./values.js"

export function repoRootFrom(url: string): string {
  return join(dirname(fileURLToPath(url)), "..", "..", "..")
}

export function defaultPackPath(root: string): string {
  return join(root, "content", "out", "pack.json")
}

function armFund(state: Dict, cfg: Dict): void {
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
  city["functions"] = []
  city["created_day"] = 1n
  const state = newState(cfg, { a: city }, {})
  armFund(state, cfg)
  state["day_budget_day"] = null
  return state
}

export function migrationSql(root: string): { readonly sql: string; readonly name: string } {
  const name = "001_from_pack.sql"
  const sql = readFileSync(join(root, "services", "api", "migrations", name), "utf8")
  return { sql, name }
}

export async function bootFromBytes(
  bytes: Uint8Array,
  root: string,
  openStore: OpenStore = openPglite,
): Promise<ApiHost> {
  const loaded = loadPack(bytes)
  const ctx = makeCtx(loaded)
  const genesis = liveGenesis(ctx.cfg, jsonToDict(loaded.pack))
  const mig = migrationSql(root)
  return createHost(bytes, mig.sql, mig.name, genesis, openStore)
}

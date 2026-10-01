import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadPack } from "@corporator/contentpack"
import { newState, spawnCity, plantPrebuilt, type Dict } from "@corporator/engine"
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

export function liveGenesis(cfg: Dict, pack: Dict): Dict {
  const spec = asEngineDict(
    asEngineDict(asEngineDict(asEngineDict(pack["sections"])["sim"])["archetypes"])["minimalist"],
  )
  const city = spawnCity(cfg, "minimalist", spec, "a", 1n, 0n)
  city["login_period"] = 1n
  city["output_base"] = asBigint(cfg["workshop_out"])
  city["account_kind"] = "demo"
  city["demo"] = 1n
  city["city_level"] = 1n
  city["agents"] = []
  city["buildings"] = []
  city["functions"] = []
  city["created_day"] = 1n
  plantPrebuilt(cfg, city)
  const state = newState(cfg, { a: city }, {})
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

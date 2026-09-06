import { type Dict } from "@corporator/engine"
import { type PackCtx } from "./pack_ctx.js"
import { type ApiHost } from "./host.js"
import { type TickLock } from "./tick_lock.js"
import { type Attestor } from "./tick_host.js"
import { asBigint, asEngineDict, asText } from "./values.js"

export function nextTickInputs(ctx: PackCtx, state: Dict, cityId: string): Dict {
  const cfg = asEngineDict(state["cfg"])
  const length = asBigint(cfg["tick_length_city_hours"])
  const anchor = asBigint(cfg["anchor_hour"])
  const last = state["city_time"]
  const cityTime =
    last === undefined || last === null ? anchor : asBigint(last) + length
  const tickIndex = length === 0n ? 0n : (cityTime - anchor) / length
  return {
    tick_index: tickIndex,
    city_time: cityTime,
    eth_usd_8dec: asBigint(cfg["eth_usd_8dec"]),
    corp_eth_wei_per_whole: asBigint(cfg["seed_corp_wei"]),
    feed_live: 1n,
    pack_hash: ctx.hash,
    dex_turnover_usd_8dec: 0n,
    city_id: cityId,
  }
}

export function firstCityId(state: Dict): string {
  const cities = asEngineDict(state["cities"])
  const ids = Object.keys(cities)
  const id = ids[0]
  if (id === undefined) return asText(state["city_id"])
  return id
}

export async function tickOnce(host: ApiHost, attestor?: Attestor): Promise<void> {
  const cityId = firstCityId(host.state)
  const inputs = nextTickInputs(host.ctx, host.state, cityId)
  await host.stepTick(inputs, attestor)
}

export async function tickIfWriter(host: ApiHost, lock: TickLock, attestor?: Attestor): Promise<boolean> {
  const cityId = firstCityId(host.state)
  const held = await lock.tryAcquire(cityId)
  if (!held) return false
  await tickOnce(host, attestor)
  return true
}

import { type AssetPort } from "@corporator/chainport"
import { catchUp, clipOfflineHours, quoteAt, type Dict } from "@corporator/engine"
import { fromUtf8, parseJson } from "@corporator/contentpack"
import { reconcileVouchers } from "./commit_bank.js"
import { sliceFarm } from "./slicer.js"
import { portCfgFromPack, selectApiPort } from "./custody.js"
import { type PackCtx } from "./pack_ctx.js"
import { type ApiHost } from "./host.js"
import { type TickLock } from "./tick_lock.js"
import { withWorldLock } from "./city_lock.js"
import { persistGapRecord, type Attestor } from "./tick_host.js"
import { publishBuybackFrame } from "./buyback_frame.js"
import { listBytes, type Store } from "./store.js"
import { asBigint, asEngineDict, asObj, asText, walk } from "./values.js"

export function lastCityTimeOf(state: Dict): bigint {
  const cfg = asEngineDict(state["cfg"])
  const last = state["city_time"]
  const length = asBigint(cfg["tick_length_city_hours"])
  const anchor = asBigint(cfg["anchor_hour"])
  if (last === undefined || last === null) return anchor - length
  return asBigint(last)
}

export async function nextTickInputs(ctx: PackCtx, state: Dict, cityId: string, store?: Store): Promise<Dict> {
  return inputsAhead(ctx, state, cityId, 1n, store)
}

type PriceSample = {
  readonly cityTime: bigint
  readonly ethUsd: bigint
  readonly corpWei: bigint
  readonly turnover: bigint
}

async function readPriceSamples(store: Store): Promise<readonly PriceSample[]> {
  let rows: readonly { readonly id: string; readonly payload: Uint8Array }[]
  try {
    rows = await listBytes(store, "price_samples", "")
  } catch {
    return []
  }
  const out: PriceSample[] = []
  for (const row of rows) {
    try {
      const parsed = parseJson(fromUtf8(row.payload))
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue
      const body = asObj(parsed)
      out.push({
        cityTime: asBigint(body["city_time"], 0n),
        ethUsd: asBigint(body["eth_usd_8dec"], 0n),
        corpWei: asBigint(body["corp_eth_wei_per_whole"], 0n),
        turnover: asBigint(body["dex_turnover_usd_8dec"], 0n),
      })
    } catch {
      continue
    }
  }
  return out
}

function stalenessOf(ctx: PackCtx): bigint {
  try {
    return asBigint(walk(ctx.pack, ["sections", "economy", "params", "price_staleness_max_city_hours", "v"]))
  } catch {
    return 0n
  }
}

export async function inputsAhead(
  ctx: PackCtx,
  state: Dict,
  cityId: string,
  ticks: bigint,
  store?: Store,
): Promise<Dict> {
  const cfg = asEngineDict(state["cfg"])
  const length = asBigint(cfg["tick_length_city_hours"])
  const anchor = asBigint(cfg["anchor_hour"])
  const last = lastCityTimeOf(state)
  const cityTime = last + ticks * length
  const tickIndex = length === 0n ? 0n : (cityTime - anchor) / length
  let ethUsd = asBigint(cfg["eth_usd_8dec"])
  let corpWei = asBigint(cfg["seed_corp_wei"])
  let feedLive = 1n
  let turnover = 0n
  if (store !== undefined) {
    const samples = await readPriceSamples(store)
    let latest: PriceSample | undefined
    for (const row of samples) {
      if (latest === undefined || row.cityTime >= latest.cityTime) latest = row
    }
    if (latest !== undefined) {
      const quote = quoteAt(cityTime, latest.cityTime, stalenessOf(ctx), latest.ethUsd, latest.corpWei, ethUsd, corpWei)
      ethUsd = quote.ethUsd8dec
      corpWei = quote.corpEthWeiPerWhole
      feedLive = quote.feedLive
      turnover = quote.feedLive === 1n ? latest.turnover : 0n
    }
  }
  return {
    tick_index: tickIndex,
    city_time: cityTime,
    eth_usd_8dec: ethUsd,
    corp_eth_wei_per_whole: corpWei,
    feed_live: feedLive,
    pack_hash: ctx.hash,
    dex_turnover_usd_8dec: turnover,
    city_id: cityId,
  }
}

export function firstCityId(state: Dict): string {
  const ids = cityIds(state)
  const id = ids[0]
  if (id === undefined) return asText(state["city_id"])
  return id
}

export function cityIds(state: Dict): readonly string[] {
  return Object.keys(asEngineDict(state["cities"]))
}

let voucherReconcile: Promise<void> = Promise.resolve()

export function voucherReconcileDone(): Promise<void> {
  return voucherReconcile
}

function scheduleVoucherReconcile(host: ApiHost, port: AssetPort): void {
  voucherReconcile = voucherReconcile
    .then(() => reconcileVouchers(host, port))
    .then(() => sliceFarm(host, port))
    .catch(() => undefined)
}

export async function catchUpOnce(
  host: ApiHost,
  attestor?: Attestor,
  dueTicks: bigint = 1n,
  port?: AssetPort,
): Promise<void> {
  const ticks = dueTicks <= 0n ? 1n : dueTicks
  const cityId = firstCityId(host.state)
  const last = lastCityTimeOf(host.state)
  const inputsNow = await inputsAhead(host.ctx, host.state, cityId, ticks, host.store)
  const preview = catchUp(structuredClone(host.state), inputsNow, last)
  const cfg = asEngineDict(host.state["cfg"])
  const length = asBigint(cfg["tick_length_city_hours"])
  const now = asBigint(inputsNow["city_time"])
  const elapsed = length === 0n ? 0n : (now - last) / length
  if (elapsed <= 0n) return
  const capHours = clipOfflineHours(
    asBigint(cfg["offline_cap"]),
    asBigint(host.state["offline_cap_hours"]),
    asBigint(cfg["offline_hard_cap"], 18n),
  )
  const cap = length === 0n ? 0n : capHours / length
  const credited = elapsed < cap ? elapsed : cap
  const skipped = elapsed - credited
  if (skipped > 0n) {
    const gap = preview[1][0]
    if (gap !== undefined) {
      await withWorldLock(() => persistGapRecord(host.ctx, host.store, host.state, gap, cityId))
    }
  }
  const anchor = asBigint(cfg["anchor_hour"])
  const currentIndex = length === 0n ? 0n : (now - anchor) / length
  const first = currentIndex - credited + 1n
  let i = 0n
  while (i < credited) {
    const idx = first + i
    const inp: Dict = { ...inputsNow }
    inp["tick_index"] = idx
    inp["city_time"] = anchor + idx * length
    inp["city_id"] = cityId
    await host.stepTick(inp, attestor)
    i += 1n
  }
  const chain = port ?? selectApiPort(portCfgFromPack(host.ctx.pack), process.env)
  scheduleVoucherReconcile(host, chain)
  void publishBuybackFrame(host).catch(() => undefined)
}

export async function tickOnce(host: ApiHost, attestor?: Attestor, port?: AssetPort): Promise<void> {
  await catchUpOnce(host, attestor, 1n, port)
}

export async function tickIfWriter(
  host: ApiHost,
  lock: TickLock,
  attestor?: Attestor,
  dueTicks: bigint = 1n,
): Promise<boolean> {
  const cityId = firstCityId(host.state)
  const held = await lock.tryAcquire(cityId)
  if (!held) return false
  await catchUpOnce(host, attestor, dueTicks)
  return true
}

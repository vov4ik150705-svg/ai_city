import { canonical, fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { PRIZE_KETTLE_MONTH } from "@corporator/chainport"
import { keccak256Hex, quoteAt } from "@corporator/engine"
import { listenBindOrEnv, listenPorts, readyTemplate } from "@corporator/protocol"
import { withWorldLock } from "./city_lock.js"
import { cityKind } from "./envelope.js"
import { prizeAssets, stockAddress } from "./commit_prize.js"
import { portCfgFromPack } from "./custody.js"
import { type ApiHost } from "./host.js"
import { listBytes, type Store } from "./store.js"
import { asBigint, asEngineDict, asObj, asText, walk } from "./values.js"

export type BuybackPoster = (body: Uint8Array) => Promise<void>

type Sample = {
  readonly cityTime: bigint
  readonly ethUsd: bigint
  readonly corpWei: bigint
  readonly turnover: bigint
}

type Planned = {
  readonly bucket: bigint
  readonly body: Uint8Array
}

const postedHour = new WeakMap<ApiHost, bigint>()
let injected: BuybackPoster | undefined

export function useBuybackPoster(poster: BuybackPoster | undefined): void {
  injected = poster
}

function feeOf(pack: Json, name: string): bigint {
  return asBigint(walk(pack, ["generated", "economy", "fee_split", name]))
}

function splitShares(
  turnoverWei: bigint,
  fundBps: bigint,
  leaderboardBps: bigint,
  farmBps: bigint,
  studioBps: bigint,
  bps: bigint,
): { readonly fundWei: bigint; readonly leaderboardWei: bigint; readonly farmWei: bigint; readonly studioWei: bigint } {
  if (
    bps <= 0n ||
    turnoverWei <= 0n ||
    fundBps < 0n ||
    leaderboardBps < 0n ||
    farmBps < 0n ||
    studioBps < 0n
  ) {
    return { fundWei: 0n, leaderboardWei: 0n, farmWei: 0n, studioWei: 0n }
  }
  const fundWei = (turnoverWei * fundBps) / bps
  const farmWei = (turnoverWei * farmBps) / bps
  const studioWei = (turnoverWei * studioBps) / bps
  const taxWei = (turnoverWei * (fundBps + leaderboardBps + farmBps + studioBps)) / bps
  const leaderboardWei = taxWei - fundWei - farmWei - studioWei
  return { fundWei, leaderboardWei, farmWei, studioWei }
}

function zeros(tickers: readonly string[]): { [ticker: string]: bigint } {
  const out: { [ticker: string]: bigint } = {}
  for (const ticker of tickers) out[ticker] = 0n
  return out
}

function jsonMap(row: { readonly [key: string]: bigint }): { [key: string]: Json } {
  const out: { [key: string]: Json } = {}
  for (const key of Object.keys(row)) {
    const value = row[key]
    if (value === undefined) continue
    out[key] = value
  }
  return out
}

function demandOf(state: ApiHost["state"], tickers: readonly string[]): { [ticker: string]: bigint } {
  const out = zeros(tickers)
  const cities = asEngineDict(state["cities"])
  for (const id of Object.keys(cities)) {
    if (cityKind(state, id) !== "wallet") continue
    const owed = asEngineDict(asEngineDict(cities[id])["fragment_owed"])
    for (const ticker of tickers) {
      const amount = asBigint(owed[ticker], 0n)
      if (amount <= 0n) continue
      out[ticker] = (out[ticker] ?? 0n) + amount
    }
  }
  return out
}

function monthBatchId(token: string, cityTime: bigint): string {
  const text = "month\0" + token + "\0" + cityTime.toString()
  return "0x" + keccak256Hex(new TextEncoder().encode(text))
}

function monthSlices(
  state: ApiHost["state"],
  tickers: readonly string[],
  cityTime: bigint,
  caller: string,
): Json[] {
  const settle = state["season_settlement"]
  if (settle === undefined || settle === null) return []
  const byAsset = asEngineDict(asEngineDict(settle)["by_asset"])
  const out: Json[] = []
  for (const token of tickers) {
    const rows = asEngineDict(byAsset[token])["payouts"]
    if (!Array.isArray(rows)) continue
    const players: string[] = []
    const amounts: bigint[] = []
    for (const raw of rows) {
      const rec = asEngineDict(raw)
      const wallet = asText(rec["wallet"])
      const payout = asBigint(rec["payout"], 0n)
      if (wallet.length === 0 || payout <= 0n) continue
      players.push(wallet)
      amounts.push(payout)
    }
    if (players.length === 0) continue
    out.push({
      batch_id: monthBatchId(token, cityTime),
      kettle: PRIZE_KETTLE_MONTH,
      token,
      players,
      amounts,
      caller_service: caller,
    })
  }
  return out
}

async function readSamples(store: Store): Promise<readonly Sample[]> {
  let rows: readonly { readonly id: string; readonly payload: Uint8Array }[]
  try {
    rows = await listBytes(store, "price_samples", "")
  } catch {
    return []
  }
  const out: Sample[] = []
  for (const row of rows) {
    try {
      const parsed = parseJson(fromUtf8(row.payload))
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

async function plan(host: ApiHost): Promise<Planned | undefined> {
  const ctx = host.ctx
  const cfg = ctx.cfg
  const cityTime = asBigint(host.state["city_time"])
  const cadence = asBigint(walk(ctx.pack, ["sections", "launch", "params", "buyback_cadence_city_hours", "v"]))
  if (cadence <= 0n) return undefined
  const samples = await readSamples(host.store)
  let latest: Sample | undefined
  for (const row of samples) {
    if (latest === undefined || row.cityTime >= latest.cityTime) latest = row
  }
  if (latest === undefined) return undefined
  const quote = quoteAt(cityTime, latest.cityTime, asBigint(cfg["stale_max"]), latest.ethUsd, latest.corpWei, 0n, 0n)
  if (quote.feedLive !== 1n) return undefined
  const wei = asBigint(cfg["wei"])
  const ethUsd = quote.ethUsd8dec
  if (wei <= 0n || ethUsd <= 0n) return undefined
  const turnoverWei = (latest.turnover * wei) / ethUsd
  const bps = asBigint(cfg["bps"])
  const shares = splitShares(
    turnoverWei,
    feeOf(ctx.pack, "fund_bps"),
    feeOf(ctx.pack, "leaderboard_bps"),
    feeOf(ctx.pack, "farm_bps"),
    feeOf(ctx.pack, "studio_bps"),
    bps,
  )
  const tickers = prizeAssets(ctx)
  const depth = asBigint(cfg["risk4_depth_hi_wei"])
  const depths = zeros(tickers)
  for (const ticker of tickers) depths[ticker] = depth
  const caller = portCfgFromPack(ctx.pack).voucherSignerService
  const slices = monthSlices(host.state, tickers, cityTime, caller)
  const body: { [key: string]: Json } = {
    city_time: cityTime,
    turnover_wei: turnoverWei,
    fund_wei: shares.fundWei,
    leaderboard_wei: shares.leaderboardWei,
    farm_wei: shares.farmWei,
    studio_wei: shares.studioWei,
    depths_wei: jsonMap(depths),
    fragment_demand: jsonMap(demandOf(host.state, tickers)),
  }
  if (slices.length > 0) body["slices"] = slices
  const tokens: { [key: string]: Json } = {}
  let mapped = false
  for (const ticker of tickers) {
    const addr = stockAddress(ticker)
    if (addr.length === 0) continue
    tokens[ticker] = addr
    mapped = true
  }
  if (mapped) body["token_by_ticker"] = tokens
  return { bucket: cityTime / cadence, body: canonical(body) }
}

function accepted(raw: Uint8Array): boolean {
  try {
    const row = asObj(parseJson(fromUtf8(raw)))
    if (asBigint(row["degraded"], 0n) !== 0n) return false
    return asBigint(row["ok"], 0n) === 1n
  } catch {
    return false
  }
}

async function postDefault(body: Uint8Array): Promise<boolean> {
  const url =
    "http://" +
    listenBindOrEnv(process.env.CORPORATOR_LISTEN_BIND) +
    ":" +
    listenPorts.buyback.toString() +
    readyTemplate
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
  if (!res.ok) return false
  const raw = new Uint8Array(await res.arrayBuffer())
  if (raw.length === 0) return false
  return accepted(raw)
}

async function releaseHour(host: ApiHost, bucket: bigint): Promise<void> {
  await withWorldLock(async () => {
    if (postedHour.get(host) === bucket) postedHour.delete(host)
  })
}

export async function publishBuybackFrame(host: ApiHost, poster?: BuybackPoster): Promise<bigint> {
  const planned = await plan(host)
  if (planned === undefined) return 0n
  const claimed = await withWorldLock(async () => {
    if (postedHour.get(host) === planned.bucket) return false
    postedHour.set(host, planned.bucket)
    return true
  })
  if (!claimed) return 0n
  let sent = false
  try {
    const send = poster ?? injected
    if (send !== undefined) {
      await send(planned.body)
      sent = true
    } else {
      sent = await postDefault(planned.body)
    }
  } catch {
    sent = false
  }
  if (!sent) {
    await releaseHour(host, planned.bucket)
    return 0n
  }
  return 1n
}

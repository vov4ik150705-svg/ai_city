import { fromUtf8, parseJson, type Json } from "@corporator/contentpack"
import { type Dict } from "@corporator/engine"
import { type PackCtx } from "./pack_ctx.js"
import { listBytes, type Store } from "./store.js"
import { asBigint, asEngineDict, asObj } from "./values.js"
import { hopFillFromEnv, type HopFill } from "./commit_exchange.js"
import { prizeCustodyLive, readWalletOverlay, selectApiPort, portCfgFromPack } from "./custody.js"
import { stockAddress, walletCallerOf } from "./commit_prize.js"

export type ProjectLive = {
  readonly walletChain: string
  readonly walletCorp: bigint | undefined
  /** Set only after a live balanceOf pass. A missing ticker was not read, so it is not zero. */
  readonly walletStocks: { readonly [ticker: string]: bigint } | undefined
  readonly chainTimeS: bigint | undefined
  readonly feedLive: bigint
  readonly sampleCityTime: bigint
  readonly corpEth: bigint
  readonly ethUsd: bigint
  readonly hopFill: HopFill | undefined
}

function prizeTickers(pack: Json): readonly string[] {
  if (pack === null || typeof pack !== "object" || Array.isArray(pack)) return []
  const generated = pack["generated"]
  if (generated === null || typeof generated !== "object" || Array.isArray(generated)) return []
  const seasons = generated["seasons"]
  if (seasons === null || typeof seasons !== "object" || Array.isArray(seasons)) return []
  const raw = seasons["prize_assets"]
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === "string" && item.length > 0) out.push(item)
  }
  return out
}

async function readLiveWallet(
  pack: Json,
  port: ReturnType<typeof selectApiPort>,
  account: string,
): Promise<{
  readonly walletStocks: { readonly [ticker: string]: bigint } | undefined
  readonly chainTimeS: bigint | undefined
}> {
  if (!prizeCustodyLive(port) || account.length === 0) return { walletStocks: undefined, chainTimeS: undefined }
  const stocks: { [ticker: string]: bigint } = {}
  for (const ticker of prizeTickers(pack)) {
    const token = stockAddress(ticker)
    if (token.length === 0) continue
    const bal = await port.corpToken.balanceOf(account, token)
    if (!bal.ok) continue
    stocks[ticker] = bal.amount
  }
  const clock = await port.chain.latestBlockTime()
  return { walletStocks: stocks, chainTimeS: clock.ok ? clock.amount : undefined }
}

export async function latestFeedLive(
  store: Store,
  cityId: string,
): Promise<{
  readonly feedLive: bigint
  readonly sampleCityTime: bigint
  readonly corpEth: bigint
  readonly ethUsd: bigint
}> {
  const rows = await listBytes(store, "tick_inputs", cityId + ":")
  let feedLive = 0n
  let sampleCityTime = 0n
  let corpEth = 0n
  let ethUsd = 0n
  let latest = 0n
  for (const row of rows) {
    let parsed: Json
    try {
      parsed = parseJson(fromUtf8(row.payload))
    } catch {
      continue
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) continue
    const hdr = asObj(parsed)
    const cityTime = asBigint(hdr["city_time"], 0n)
    if (cityTime < latest) continue
    latest = cityTime
    feedLive = asBigint(hdr["feed_live"], 0n)
    sampleCityTime = asBigint(hdr["price_sample_city_time"], 0n)
    corpEth = asBigint(hdr["corp_eth_wei_per_whole"], 0n)
    ethUsd = asBigint(hdr["eth_usd_8dec"], 0n)
  }
  return { feedLive, sampleCityTime, corpEth, ethUsd }
}

export async function loadProjectLive(
  ctx: PackCtx,
  store: Store,
  state: Dict,
  cityId: string,
): Promise<ProjectLive> {
  const feed = await latestFeedLive(store, cityId)
  const cities = asEngineDict(state["cities"])
  if (!(cityId in cities)) {
    return {
      walletChain: "",
      walletCorp: undefined,
      walletStocks: undefined,
      chainTimeS: undefined,
      feedLive: feed.feedLive,
      sampleCityTime: feed.sampleCityTime,
      corpEth: feed.corpEth,
      ethUsd: feed.ethUsd,
      hopFill: undefined,
    }
  }
  const city = asEngineDict(cities[cityId])
  const account = walletCallerOf(city)
  const wallet = await readWalletOverlay(ctx.pack, process.env, account)
  const port = selectApiPort(portCfgFromPack(ctx.pack), process.env)
  const hopUrl = process.env["CORPORATOR_HOP_URL"]
  const hopLive =
    feed.feedLive !== 0n &&
    prizeCustodyLive(port) &&
    hopUrl !== undefined &&
    hopUrl.length > 0
  const bags = await readLiveWallet(ctx.pack, port, account)
  return {
    walletChain: wallet === undefined ? "" : wallet.chain,
    walletCorp: wallet === undefined ? undefined : wallet.corp,
    walletStocks: bags.walletStocks,
    chainTimeS: bags.chainTimeS,
    feedLive: feed.feedLive,
    sampleCityTime: feed.sampleCityTime,
    corpEth: feed.corpEth,
    ethUsd: feed.ethUsd,
    hopFill: hopLive ? (ticker, corpIn, hopQuality) => hopFillFromEnv(process.env, ticker, corpIn, hopQuality ?? 0n) : undefined,
  }
}

import { quoteAt } from "@corporator/engine"
import type { SamplerPack } from "./pack.js"
import { samplerSource, type SamplerEnv, type SamplerSource } from "./source.js"
import { readChainQuote } from "./chain.js"
import { emptySamplerState, stepSampler, type SamplerState } from "./step.js"
import type { JsonRpcPost } from "@corporator/chainport"

export type PriceSampleRow = {
  readonly cityTime: bigint
  readonly ethUsd8dec: bigint
  readonly corpEthWeiPerWhole: bigint
  readonly dexTurnoverUsd8dec: bigint
  readonly feedLive: bigint
}

export type PriceSampleStore = {
  putSample(row: PriceSampleRow): Promise<void>
  cityTime(): Promise<bigint>
}

export function memoryPriceStore(startCityTime: bigint = 0n): PriceSampleStore & {
  readonly rows: PriceSampleRow[]
} {
  const rows: PriceSampleRow[] = []
  const cityTime = startCityTime
  return {
    rows,
    async putSample(row: PriceSampleRow): Promise<void> {
      rows.push(row)
    },
    async cityTime(): Promise<bigint> {
      return cityTime
    },
  }
}

export async function publishOnce(
  pack: SamplerPack,
  state: SamplerState,
  source: SamplerSource,
  store: PriceSampleStore,
  post: JsonRpcPost | undefined,
  env: SamplerEnv,
): Promise<SamplerState> {
  if (source !== "chain" || post === undefined) return state
  let quote: Awaited<ReturnType<typeof readChainQuote>>
  try {
    quote = await readChainQuote(post, env, pack.wei, pack.samplerPeriodMaxS)
  } catch {
    return state
  }
  if (quote === undefined) return state
  let cityTime: bigint
  try {
    cityTime = await store.cityTime()
  } catch {
    return state
  }
  const stepped = stepSampler(pack, state, cityTime, {
    corpEthWeiPerWhole: quote.corpEthWeiPerWhole,
    ethUsd8dec: quote.ethUsd8dec,
  })
  const quoted = quoteAt(
    cityTime,
    stepped.inputs.price_sample_city_time,
    pack.stalenessMaxCityHours,
    stepped.inputs.eth_usd_8dec,
    stepped.inputs.corp_eth_wei_per_whole,
    state.lastUsdTwap,
    state.lastCorpTwap,
  )
  await store.putSample({
    cityTime,
    ethUsd8dec: quoted.ethUsd8dec,
    corpEthWeiPerWhole: quoted.corpEthWeiPerWhole,
    dexTurnoverUsd8dec: quoted.feedLive === 1n ? quote.turnoverUsd8dec : 0n,
    feedLive: quoted.feedLive,
  })
  return stepped.next
}

export function startPriceLoop(
  pack: SamplerPack,
  source: SamplerSource,
  store: PriceSampleStore,
  post: JsonRpcPost | undefined,
  env: SamplerEnv,
): { stop(): void } {
  let state = emptySamplerState()
  let running = false
  const timer = setInterval(() => {
    if (running) return
    running = true
    void publishOnce(pack, state, source, store, post, env)
      .then((next) => {
        state = next
      })
      .catch(() => undefined)
      .finally(() => {
        running = false
      })
  }, Number(pack.periodMs))
  return {
    stop(): void {
      clearInterval(timer)
    },
  }
}

export { samplerSource }

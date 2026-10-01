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
  let cityTime = startCityTime
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
  const cityTime = await store.cityTime()
  let observation: { readonly corpEthWeiPerWhole: bigint; readonly ethUsd8dec: bigint } | undefined
  let turnover = 0n
  if (source === "chain" && post !== undefined) {
    const quote = await readChainQuote(post, env, pack.wei, pack.samplerPeriodMaxS)
    if (quote !== undefined) {
      observation = { corpEthWeiPerWhole: quote.corpEthWeiPerWhole, ethUsd8dec: quote.ethUsd8dec }
      turnover = quote.turnoverUsd8dec
    }
  } else if (source === "pack") {
    observation = { corpEthWeiPerWhole: pack.seedCorpWei, ethUsd8dec: pack.seedEthUsd8dec }
  }
  const stepped = stepSampler(pack, state, cityTime, observation)
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
    dexTurnoverUsd8dec: quoted.feedLive === 1n ? turnover : 0n,
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

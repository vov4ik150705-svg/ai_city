import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { twapFromSamples } from "@corporator/engine"
import {
  ageAlertBeforeStale,
  corpSeriesFromPriceDay,
  emptySamplerState,
  headerFromPriceDay,
  loadSamplerPack,
  memoryStore,
  publishPriceDay,
  samplerPeriodOk,
  samplerSilenceState,
  stepSampler,
  type Observation,
  type SamplerState,
} from "../src/index.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function obs(corp: bigint, usd: bigint): Observation {
  return { corpEthWeiPerWhole: corp, ethUsd8dec: usd }
}

function fill(
  pack: ReturnType<typeof loadSamplerPack>,
  start: SamplerState,
  values: readonly bigint[],
  usd: bigint,
  t0: bigint,
): ReturnType<typeof stepSampler> {
  let state = start
  let current: ReturnType<typeof stepSampler> | undefined
  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v === undefined) continue
    current = stepSampler(pack, state, t0, obs(v, usd))
    state = current.next
  }
  if (current === undefined) return stepSampler(pack, state, t0, undefined)
  return current
}

describe.sequential("C6 construction", () => {
  it("sampler_twap_recompute", () => {
    const pack = loadSamplerPack(packBytes())
    const n = Number(pack.samplesPerTwapWindow)
    expect(n > 1).toBe(true)
    const values: bigint[] = []
    for (let i = 0; i < n; i += 1) values.push(i + 1 === n ? 0n : 2n)
    const out = fill(pack, emptySamplerState(), values, 1n, 1n)
    const store = memoryStore()
    publishPriceDay(store, pack, 1n, out.next, out.inputs)
    const payload = store.getPriceDay(0n)
    expect(payload === undefined).toBe(false)
    if (payload === undefined) return
    const series = corpSeriesFromPriceDay(payload)
    expect(series.length).toBe(n)
    const recomputed = twapFromSamples(series)
    const hdr = headerFromPriceDay(payload)
    expect(hdr.corp_eth_wei_per_whole).toBe(recomputed)
    expect(out.inputs.corp_eth_wei_per_whole).toBe(recomputed)
    expect(Object.keys(out.inputs).sort().join(",")).toBe([...pack.inputFields].sort().join(","))
    for (const name of pack.inputFields) expect(name.includes("spot")).toBe(false)
  })

  it("sampler_twap_sensitive", () => {
    const pack = loadSamplerPack(packBytes())
    const n = Number(pack.samplesPerTwapWindow)
    const values: bigint[] = []
    for (let i = 0; i < n; i += 1) values.push(i + 1 === n ? 0n : 2n)
    const full = fill(pack, emptySamplerState(), values, 1n, 1n)
    const droppedVals = values.slice(0, n - 1)
    const dropped = fill(pack, emptySamplerState(), droppedVals, 1n, 1n)
    expect(full.inputs.corp_eth_wei_per_whole === dropped.inputs.corp_eth_wei_per_whole).toBe(false)
    const store = memoryStore()
    publishPriceDay(store, pack, 1n, full.next, full.inputs)
    const payload = store.getPriceDay(0n)
    expect(payload === undefined).toBe(false)
    if (payload === undefined) return
    const series = corpSeriesFromPriceDay(payload)
    const withoutLast = series.slice(0, series.length - 1)
    expect(twapFromSamples(series) === twapFromSamples(withoutLast)).toBe(false)
  })

  it("sampler_silence_keeps_age", () => {
    const st = samplerSilenceState(10n, 0n, 8n, undefined)
    expect(st.feedLive).toBe(0n)
    expect(st.value).toBe(10n)
    expect(st.priceSampleCityTime).toBe(0n)
    expect(st.age > 0n).toBe(true)
    const pack = loadSamplerPack(packBytes())
    const live = stepSampler(pack, emptySamplerState(), 1n, obs(4n, 2n))
    expect(live.inputs.feed_live).toBe(1n)
    expect(live.inputs.price_sample_city_time).toBe(1n)
    const silent = stepSampler(pack, live.next, 8n, undefined)
    expect(silent.inputs.feed_live).toBe(0n)
    expect(silent.inputs.corp_eth_wei_per_whole).toBe(live.inputs.corp_eth_wei_per_whole)
    expect(silent.inputs.eth_usd_8dec).toBe(live.inputs.eth_usd_8dec)
    expect(silent.inputs.price_sample_city_time).toBe(live.inputs.price_sample_city_time)
    expect(silent.next.age).toBe(8n - 1n)
    expect(silent.next.ageAlert).toBe(silent.next.age >= pack.ageAlertCityHours ? 1n : 0n)
    const later = stepSampler(pack, silent.next, 8n + pack.ageAlertCityHours, undefined)
    expect(later.inputs.price_sample_city_time).toBe(live.inputs.price_sample_city_time)
    expect(later.next.ageAlert).toBe(1n)
    expect(pack.blocksTick).toBe(0n)
    expect(pack.failMode).toBe("open")
  })

  it("sampler_period_divides_tick", () => {
    const pack = loadSamplerPack(packBytes())
    expect(samplerPeriodOk(pack)).toBe(true)
    expect(pack.samplerPeriodS).toBe(pack.tickLengthS / pack.samplesPerTick)
    expect(ageAlertBeforeStale(pack)).toBe(true)
    expect(pack.aggregation).toBe("twap_from_samples")
    expect(pack.priceDayPublished).toBe(1n)
  })
})

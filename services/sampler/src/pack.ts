import { atPath, loadPack, type Json } from "@corporator/contentpack"
import { asBig, asObj, asText, strList } from "./values.js"

export type SamplerPack = {
  readonly hash: string
  readonly samplerPeriodS: bigint
  readonly samplerPeriodMaxS: bigint
  readonly tickLengthS: bigint
  readonly samplesPerTwapWindow: bigint
  readonly samplesPerTick: bigint
  readonly ageAlertCityHours: bigint
  readonly stalenessMaxCityHours: bigint
  readonly seedEthUsd8dec: bigint
  readonly seedCorpWei: bigint
  readonly wei: bigint
  readonly periodMs: bigint
  readonly ticksPerCityDay: bigint
  readonly inputFields: readonly string[]
  readonly priceDayPublished: bigint
  readonly blocksTick: bigint
  readonly failMode: string
  readonly aggregation: string
}

function paramV(section: Json, name: string): bigint {
  const params = asObj(asObj(section)["params"])
  return asBig(asObj(params[name])["v"])
}

export function loadSamplerPack(bytes: Uint8Array): SamplerPack {
  const loaded = loadPack(bytes)
  const pack = loaded.pack
  const archGen = asObj(atPath(pack, ["generated", "arch"]))
  const apiGen = asObj(atPath(pack, ["generated", "api"]))
  const timeGen = asObj(atPath(pack, ["generated", "time"]))
  const arch = asObj(atPath(pack, ["sections", "arch"]))
  const economy = asObj(atPath(pack, ["sections", "economy"]))
  const sampler = asObj(asObj(arch["services"])["sampler"])
  return {
    hash: loaded.hash,
    samplerPeriodS: asBig(apiGen["sampler_period_s"]),
    samplerPeriodMaxS: asBig(archGen["sampler_period_max_s"]),
    tickLengthS: asBig(archGen["tick_length_real_seconds"]),
    samplesPerTwapWindow: asBig(apiGen["samples_per_twap_window"]),
    samplesPerTick: asBig(archGen["sampler_samples_per_tick"]),
    ageAlertCityHours: asBig(archGen["sampler_age_alert_city_hours"]),
    stalenessMaxCityHours: paramV(economy, "price_staleness_max_city_hours"),
    seedEthUsd8dec: paramV(asObj(atPath(pack, ["sections", "launch"])), "eth_usd_8dec"),
    seedCorpWei: seedCorpWei(pack),
    wei: 10n ** paramV(asObj(atPath(pack, ["sections", "sim"])), "wei_decimals"),
    periodMs: asBig(apiGen["sampler_period_ms"]),
    ticksPerCityDay: asBig(timeGen["ticks_per_city_day"]),
    inputFields: strList(arch["sampler_input_fields"]),
    priceDayPublished: asBig(archGen["price_day_published"]),
    blocksTick: asBig(sampler["blocks_tick"]),
    failMode: asText(sampler["fail_mode"]),
    aggregation: asText(arch["aggregation"]),
  }
}

function seedCorpWei(pack: Json): bigint {
  const sim = asObj(atPath(pack, ["sections", "sim"]))
  const decimals = paramV(sim, "wei_decimals")
  const wei = 10n ** decimals
  const launch = asObj(atPath(pack, ["sections", "launch"]))
  const poolEth = paramV(launch, "eth_graduation_threshold")
  const gen = asObj(atPath(pack, ["generated", "launch"]))
  const poolCorp = asBig(gen["pool_token_amount"])
  if (poolCorp <= 0n || poolEth <= 0n || wei <= 0n) return 0n
  return (poolEth * wei) / poolCorp
}

export function cityDayOf(pack: SamplerPack, cityTime: bigint): bigint {
  if (pack.ticksPerCityDay === 0n) return 0n
  return cityTime / pack.ticksPerCityDay
}

export function samplerPeriodOk(pack: SamplerPack): boolean {
  if (pack.samplerPeriodS <= 0n) return false
  return pack.tickLengthS % pack.samplerPeriodS === 0n && pack.samplerPeriodS <= pack.samplerPeriodMaxS
}

export function ageAlertBeforeStale(pack: SamplerPack): boolean {
  return pack.ageAlertCityHours < pack.stalenessMaxCityHours
}

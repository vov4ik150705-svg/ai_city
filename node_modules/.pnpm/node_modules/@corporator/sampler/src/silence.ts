export type SilenceState = {
  readonly value: bigint
  readonly feedLive: bigint
  readonly priceSampleCityTime: bigint
  readonly age: bigint
}

/** docs/ARCHITECTURE.md §7; content/arch.py sampler_silence_state */
export function samplerSilenceState(
  lastValue: bigint,
  lastTime: bigint,
  now: bigint,
  newSample: bigint | undefined,
): SilenceState {
  if (newSample === undefined) {
    return {
      value: lastValue,
      feedLive: 0n,
      priceSampleCityTime: lastTime,
      age: now - lastTime,
    }
  }
  return {
    value: newSample,
    feedLive: 1n,
    priceSampleCityTime: now,
    age: 0n,
  }
}

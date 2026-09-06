export type SilenceState = {
    readonly value: bigint;
    readonly feedLive: bigint;
    readonly priceSampleCityTime: bigint;
    readonly age: bigint;
};
/** docs/ARCHITECTURE.md §7; content/arch.py sampler_silence_state */
export declare function samplerSilenceState(lastValue: bigint, lastTime: bigint, now: bigint, newSample: bigint | undefined): SilenceState;

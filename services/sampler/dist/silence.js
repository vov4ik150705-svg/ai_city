/** docs/ARCHITECTURE.md §7; content/arch.py sampler_silence_state */
export function samplerSilenceState(lastValue, lastTime, now, newSample) {
    if (newSample === undefined) {
        return {
            value: lastValue,
            feedLive: 0n,
            priceSampleCityTime: lastTime,
            age: now - lastTime,
        };
    }
    return {
        value: newSample,
        feedLive: 1n,
        priceSampleCityTime: now,
        age: 0n,
    };
}

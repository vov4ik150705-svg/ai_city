import { clampInt, maxBig, minBig } from "./values.js";
export function mulBps(value, rateBps, bps) {
    return (value * rateBps) / bps;
}
export function twapFromSamples(samples) {
    if (samples.length === 0)
        return 0n;
    let sum = 0n;
    for (const x of samples)
        sum += x;
    return sum / BigInt(samples.length);
}
export function clampRate(rateRaw, rateRef, bandBps, bps) {
    if (rateRaw <= 0n || rateRef <= 0n)
        return 0n;
    const lo = (rateRef * (bps - bandBps)) / bps;
    const hi = (rateRef * (bps + bandBps)) / bps;
    return clampInt(rateRaw, lo, hi);
}
export function applyRatchet(prevRate, target, riseMaxBps, elapsedCityHours, ticksDay, bps) {
    if (target <= prevRate)
        return target;
    if (prevRate <= 0n || riseMaxBps <= 0n) {
        return prevRate > 0n ? prevRate : target;
    }
    const days = ticksDay > 0n ? elapsedCityHours / ticksDay : 0n;
    if (days <= 0n)
        return prevRate;
    let rate = prevRate;
    let i = 0n;
    while (i < days) {
        const stepped = (rate * (bps + riseMaxBps)) / bps;
        if (stepped >= target)
            return target;
        if (stepped <= rate)
            return rate;
        rate = stepped;
        i += 1n;
    }
    return rate;
}
export function mintRate(rateRaw, rateRef, bandBps, ceiling, prevRate, riseMaxBps, elapsedCityHours, ticksDay, bps) {
    if (ceiling <= 0n)
        return 0n;
    const target = clampRate(rateRaw, rateRef, bandBps, bps);
    const rate = prevRate <= 0n
        ? target
        : applyRatchet(prevRate, target, riseMaxBps, elapsedCityHours, ticksDay, bps);
    return minBig(rate, ceiling);
}
export function staleDecayRate(rate, rateRef, bandBps, decayBpsPerCityDay, staleCityHours, ticksDay, bps) {
    const floor = rateRef <= 0n ? 0n : (rateRef * maxBig(0n, bps - bandBps)) / bps;
    if (rate <= floor)
        return rate;
    const days = ticksDay > 0n ? staleCityHours / ticksDay : 0n;
    if (days <= 0n || decayBpsPerCityDay <= 0n)
        return rate;
    if (decayBpsPerCityDay >= bps)
        return floor;
    let decayed = rate;
    let i = 0n;
    while (i < days) {
        const nxt = (decayed * (bps - decayBpsPerCityDay)) / bps;
        if (nxt < floor)
            return floor;
        if (nxt >= decayed)
            return decayed;
        decayed = nxt;
        i += 1n;
    }
    return decayed;
}
export function tickJitterBps(prng, widthBps, bps, steady) {
    let w = steady ? widthBps / (1n + 1n) : widthBps;
    if (w < 0n)
        w = 0n;
    const span = (1n + 1n) * w + 1n;
    if (span <= 0n)
        return bps;
    return bps + (prng % span) - w;
}

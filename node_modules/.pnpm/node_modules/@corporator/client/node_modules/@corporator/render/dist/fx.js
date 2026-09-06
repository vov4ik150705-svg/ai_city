export function popupPose(cityTime, event, durationTicks, risePx, alphaSteps) {
    if (durationTicks <= 0n)
        return undefined;
    const age = cityTime - event.eventTime;
    if (age < 0n || age >= durationTicks)
        return undefined;
    const steps = alphaSteps <= 0n ? 1n : alphaSteps;
    const rise = (risePx * age) / durationTicks;
    const remain = durationTicks - age;
    const alphaNum = (remain * steps) / durationTicks;
    return {
        amount: event.amount,
        tileX: event.tileX,
        tileY: event.tileY,
        rise,
        alphaNum,
        alphaDen: steps,
    };
}
export function glowGainWithTick(baseGain, glowOn, tickGlowBps, capBps) {
    if (!glowOn)
        return baseGain;
    const sum = baseGain + tickGlowBps;
    if (capBps > 0n && sum > capBps)
        return capBps;
    return sum;
}

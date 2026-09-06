function posMod(n, m) {
    if (m <= 0n)
        return 0n;
    const r = n % m;
    return r < 0n ? r + m : r;
}
export function hourOfDay(cityTime, ticksDay) {
    if (ticksDay <= 0n)
        return 0n;
    return posMod(cityTime, ticksDay);
}
export function hourInPhase(hour, start, dur, ticksDay) {
    if (dur <= 0n || ticksDay <= 0n)
        return false;
    return posMod(hour - start, ticksDay) < dur;
}
export function hoursLeftInPhase(hour, start, dur, ticksDay) {
    if (dur <= 0n || ticksDay <= 0n)
        return 0n;
    const rel = posMod(hour - start, ticksDay);
    if (rel >= dur)
        return 0n;
    return dur - rel;
}
export function currentPhase(hour, phases, ticksDay) {
    for (const row of phases) {
        if (hourInPhase(hour, row.startHour, row.durationHours, ticksDay))
            return row;
    }
    return undefined;
}
export function nextPhase(hour, phases, ticksDay) {
    const n = phases.length;
    if (n === 0)
        return undefined;
    let i = 0;
    for (const row of phases) {
        if (hourInPhase(hour, row.startHour, row.durationHours, ticksDay)) {
            return phases[(i + 1) % n];
        }
        i += 1;
    }
    return undefined;
}
export function phaseBlendBps(minutesLeft, blendWindow, bps) {
    if (blendWindow <= 0n || bps <= 0n)
        return 0n;
    if (minutesLeft >= blendWindow)
        return 0n;
    if (minutesLeft <= 0n)
        return bps;
    return bps - (minutesLeft * bps) / blendWindow;
}
export function mixBps(a, b, t, bps) {
    if (bps <= 0n)
        return a;
    if (t <= 0n)
        return a;
    if (t >= bps)
        return b;
    return (a * (bps - t) + b * t) / bps;
}
export function glowGainBps(lightsFlag, emissiveBps) {
    if (lightsFlag === 0n)
        return 0n;
    if (emissiveBps < 0n)
        return 0n;
    return emissiveBps;
}
export function lightsOn(name, lanternsOn, lightsFlag) {
    if (name === "day")
        return false;
    if (lightsFlag === 0n)
        return false;
    for (const item of lanternsOn) {
        if (item === name)
            return true;
    }
    return false;
}
export function spriteGlows(kind, id) {
    if (kind === "building")
        return true;
    return id.startsWith("lantern");
}
export function gradeChannel(src, tint, mixBpsAmt, bps) {
    if (bps <= 0n)
        return src;
    if (mixBpsAmt <= 0n)
        return src;
    if (mixBpsAmt >= bps)
        return tint;
    return (src * (bps - mixBpsAmt) + tint * mixBpsAmt) / bps;
}
export function gradeRgb(src, tint, mixBpsAmt, bps) {
    return {
        r: gradeChannel(src.r, tint.r, mixBpsAmt, bps),
        g: gradeChannel(src.g, tint.g, mixBpsAmt, bps),
        b: gradeChannel(src.b, tint.b, mixBpsAmt, bps),
    };
}

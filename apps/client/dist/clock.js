/**
 * Local city-hour extrapolation only. HUD.md §8.
 * SI conversion 60 s × 60 min × 1000 ms is wall time, not a pack rate.
 * Date.now is legal only here (D-L-4).
 */
const MS_PER_HOUR = 60n * 60n * 1000n;
export function wallNowMs() {
    return BigInt(Date.now());
}
export function cityTimeFromWall(args) {
    if (args.nowMs < args.firstLoginMs)
        return args.anchorCityTime;
    if (args.bps <= 0n)
        return args.anchorCityTime;
    const deltaMs = args.nowMs - args.firstLoginMs;
    return args.anchorCityTime + (deltaMs * args.rateBps) / (args.bps * MS_PER_HOUR);
}
export function cityClockParts(args) {
    const ticksDay = args.ticksDay;
    const hour = ticksDay === 0n ? 0n : args.cityTime % ticksDay;
    const dayOffset = ticksDay === 0n ? 0n : args.cityTime / ticksDay;
    const day = args.anchorDay + dayOffset;
    const week = args.weekDays;
    const weekday = week === 0n ? 1n : ((args.anchorWeekday - 1n + dayOffset) % week) + 1n;
    return { day, hour, weekday };
}
export function bankPlaqueCode(args) {
    if (args.weekday === args.closedWeekday)
        return "BANK_SUNDAY";
    if (args.hour < args.openHour || args.hour >= args.closeHour)
        return "BANK_CLOSED";
    return "UI_BANK";
}
export function bankOpensIn(args) {
    if (args.hour < args.openHour)
        return args.openHour - args.hour;
    if (args.ticksDay <= 0n)
        return 0n;
    return args.ticksDay - args.hour + args.openHour;
}

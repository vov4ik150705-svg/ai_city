export declare function wallNowMs(): bigint;
export declare function cityTimeFromWall(args: {
    readonly anchorCityTime: bigint;
    readonly firstLoginMs: bigint;
    readonly nowMs: bigint;
    readonly rateBps: bigint;
    readonly bps: bigint;
}): bigint;
export declare function cityClockParts(args: {
    readonly cityTime: bigint;
    readonly ticksDay: bigint;
    readonly anchorDay: bigint;
    readonly anchorWeekday: bigint;
    readonly weekDays: bigint;
}): {
    readonly day: bigint;
    readonly hour: bigint;
    readonly weekday: bigint;
};
export declare function bankPlaqueCode(args: {
    readonly weekday: bigint;
    readonly hour: bigint;
    readonly closedWeekday: bigint;
    readonly openHour: bigint;
    readonly closeHour: bigint;
}): "BANK_SUNDAY" | "BANK_CLOSED" | "UI_BANK";
export declare function bankOpensIn(args: {
    readonly hour: bigint;
    readonly openHour: bigint;
    readonly closeHour: bigint;
    readonly ticksDay: bigint;
}): bigint;

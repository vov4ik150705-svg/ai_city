export type PhaseRow = {
    readonly name: string;
    readonly startHour: bigint;
    readonly durationHours: bigint;
    readonly lights: bigint;
    readonly tintAlphaBps: bigint;
};
export type Rgb = {
    readonly r: bigint;
    readonly g: bigint;
    readonly b: bigint;
};
export declare function hourOfDay(cityTime: bigint, ticksDay: bigint): bigint;
export declare function hourInPhase(hour: bigint, start: bigint, dur: bigint, ticksDay: bigint): boolean;
export declare function hoursLeftInPhase(hour: bigint, start: bigint, dur: bigint, ticksDay: bigint): bigint;
export declare function currentPhase(hour: bigint, phases: readonly PhaseRow[], ticksDay: bigint): PhaseRow | undefined;
export declare function nextPhase(hour: bigint, phases: readonly PhaseRow[], ticksDay: bigint): PhaseRow | undefined;
export declare function phaseBlendBps(minutesLeft: bigint, blendWindow: bigint, bps: bigint): bigint;
export declare function mixBps(a: bigint, b: bigint, t: bigint, bps: bigint): bigint;
export declare function glowGainBps(lightsFlag: bigint, emissiveBps: bigint): bigint;
export declare function lightsOn(name: string, lanternsOn: readonly string[], lightsFlag: bigint): boolean;
export declare function spriteGlows(kind: string, id: string): boolean;
export declare function gradeChannel(src: bigint, tint: bigint, mixBpsAmt: bigint, bps: bigint): bigint;
export declare function gradeRgb(src: Rgb, tint: Rgb, mixBpsAmt: bigint, bps: bigint): Rgb;

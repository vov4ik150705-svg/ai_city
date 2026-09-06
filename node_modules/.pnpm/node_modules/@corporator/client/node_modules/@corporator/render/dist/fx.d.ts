/**
 * Tick FX pose. The popup amount is a caller-supplied snapshot field (L357).
 * Render must not invent Capital, output, or a local delta.
 */
export type PopupEvent = {
    readonly tileX: bigint;
    readonly tileY: bigint;
    readonly amount: bigint;
    readonly eventTime: bigint;
};
export type PopupPose = {
    readonly amount: bigint;
    readonly tileX: bigint;
    readonly tileY: bigint;
    readonly rise: bigint;
    readonly alphaNum: bigint;
    readonly alphaDen: bigint;
};
export declare function popupPose(cityTime: bigint, event: PopupEvent, durationTicks: bigint, risePx: bigint, alphaSteps: bigint): PopupPose | undefined;
export declare function glowGainWithTick(baseGain: bigint, glowOn: boolean, tickGlowBps: bigint, capBps: bigint): bigint;

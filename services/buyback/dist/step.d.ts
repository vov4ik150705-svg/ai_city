import type { BuybackPack } from "./pack.js";
import { type BatchStamps } from "./policy.js";
export type BuybackState = {
    readonly collectedWei: bigint;
    readonly lastRunCityTime: bigint;
    readonly hasRun: bigint;
    readonly sendCount: bigint;
    readonly stamps: BatchStamps;
};
export type StepOut = {
    readonly next: BuybackState;
    readonly sendWei: bigint;
};
export declare function emptyBuybackState(): BuybackState;
export declare function stepBuyback(pack: BuybackPack, state: BuybackState, cityTime: bigint, inflowWei: bigint, depthWei: bigint): StepOut;

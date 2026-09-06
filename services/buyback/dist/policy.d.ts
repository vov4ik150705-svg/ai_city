import type { BuybackPack, StampField } from "./pack.js";
export type BatchStamps = {
    readonly eth_collected?: bigint;
    readonly corp_bought?: bigint;
    readonly deposit_confirmed?: bigint;
    readonly mint?: bigint;
};
export declare function buybackTranche(depthWei: bigint, trancheCapBps: bigint, bps: bigint): bigint;
export declare function buybackBelowMin(collectedWei: bigint, minBatchWei: bigint): boolean;
export declare function buybackOrderOk(timestamps: BatchStamps, order: readonly string[]): boolean;
export declare function buybackDue(cadence: bigint, hasRun: bigint, lastRunCityTime: bigint, now: bigint): boolean;
export declare function planSend(pack: BuybackPack, collectedWei: bigint, depthWei: bigint): bigint;
export declare function slippageSafetyOk(pack: BuybackPack): boolean;
export declare function trancheSlipWithinTax(pack: BuybackPack, depthWei: bigint): boolean;
export declare function stampOf(stamps: BatchStamps, field: StampField): bigint | undefined;
export declare function withStamp(stamps: BatchStamps, field: StampField, cityTime: bigint): BatchStamps;
export declare function nextUnset(order: readonly StampField[], stamps: BatchStamps): StampField | undefined;
export declare function applyStamp(pack: BuybackPack, stamps: BatchStamps, field: StampField, cityTime: bigint): BatchStamps | undefined;

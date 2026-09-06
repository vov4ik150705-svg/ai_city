import { type AttestorPack } from "./pack.js";
export type SealedTick = {
    readonly cityId: string;
    readonly cityTime: bigint;
    readonly leaves: readonly Uint8Array[];
};
export declare function cityReps(ticks: readonly SealedTick[]): readonly SealedTick[];
export declare function minuteLeaves(ticks: readonly SealedTick[]): readonly Uint8Array[];
export declare function minuteRoot(pack: AttestorPack, ticks: readonly SealedTick[]): Uint8Array | undefined;
export declare function cityDayPayload(cityId: string, cityDay: bigint, root: Uint8Array): Uint8Array;
export declare function cityDayCid(pack: AttestorPack, cityId: string, cityTime: bigint, root: Uint8Array): Uint8Array;
export declare function cityDayStoreKey(pack: AttestorPack, cityId: string, cityTime: bigint): string;

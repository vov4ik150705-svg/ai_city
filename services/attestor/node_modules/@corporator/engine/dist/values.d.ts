export type Json = bigint | string | boolean | Json[] | {
    readonly [key: string]: Json;
};
export type Dict = {
    [key: string]: unknown;
};
export declare class TickError extends Error {
    readonly code: string;
    readonly tickIndex: bigint;
    readonly cityId: string;
    constructor(code: string, tickIndex: bigint, cityId: string, nums?: {
        [k: string]: bigint;
    });
}
export declare function at<T>(xs: readonly T[], i: number): T;
export declare function asBig(value: unknown, fallback?: bigint): bigint;
export declare function asStr(value: unknown, fallback?: string): string;
export declare function asBool(value: unknown): boolean;
export declare function asDict(value: unknown): Dict;
export declare function asList(value: unknown): unknown[];
export declare function paramV(section: unknown, name: string): bigint;
export declare function pow10(exp: bigint): bigint;
export declare function two(): bigint;
export declare function twoNum(): number;
export { utf8, fromUtf8 } from "./utf8.js";
export declare function sortedKeys(obj: Dict): string[];
export declare function bytesEq(a: Uint8Array, b: Uint8Array): boolean;
export declare function concatBytes(parts: readonly Uint8Array[]): Uint8Array;
export declare function domainByte(value: bigint): Uint8Array;
export declare function clampInt(value: bigint, lo: bigint, hi: bigint): bigint;
export declare function minBig(a: bigint, b: bigint): bigint;
export declare function maxBig(a: bigint, b: bigint): bigint;
export declare function max1(value: bigint): bigint;
export declare function nibbleShift(): number;
export declare function nibbleMask(): number;
export declare function controlCeil(): number;

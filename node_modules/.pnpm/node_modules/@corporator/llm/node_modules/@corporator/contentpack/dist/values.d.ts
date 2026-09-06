export type Json = bigint | string | boolean | null | Json[] | {
    readonly [key: string]: Json;
};
export declare class LoadError extends Error {
    readonly code: string;
    constructor(code: string);
}
export declare function isLoadError(value: unknown): value is LoadError;
export declare function asDict(value: Json | undefined): {
    readonly [key: string]: Json;
};
export declare function bytesEq(a: Uint8Array, b: Uint8Array): boolean;
export declare function copyBytes(data: Uint8Array): Uint8Array;
export declare function nibbleShift(): number;
export declare function nibbleMask(): number;
export declare function controlCeil(): number;

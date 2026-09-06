import { LoadError, type Json } from "@corporator/contentpack";
export type { Json };
export { LoadError };
export declare function asObj(value: Json | undefined): {
    readonly [key: string]: Json;
};
export declare function asBig(value: Json | undefined, fallback?: bigint): bigint;
export declare function asText(value: Json | undefined, fallback?: string): string;
export declare function strList(value: Json | undefined): readonly string[];
export declare function byteOf(value: bigint): number;

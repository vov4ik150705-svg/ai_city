import { LoadError, type Json } from "@corporator/contentpack";
import type { Dict } from "@corporator/engine";
export { LoadError };
export type { Json, Dict };
export declare function asObj(value: Json): {
    readonly [key: string]: Json;
};
export declare function asEngineDict(value: unknown): Dict;
export declare function asBigint(value: unknown, fallback?: bigint): bigint;
export declare function asText(value: unknown, fallback?: string): string;
export declare function walk(root: Json, parts: readonly string[]): Json;
export declare function jsonToDict(value: Json): Dict;

import type { Json } from "./values.js";
export type LoadedPack = {
    readonly pack: Json;
    readonly hash: string;
};
/**
 * Load pack bytes. Hash check is the only closed circuit: mismatch is API_PACK_STALE.
 * docs/ARCHITECTURE.md §3; docs/CONTENT.md §5; PLAN_CODE D-C-4.
 */
export declare function loadPack(bytes: Uint8Array): LoadedPack;
export declare function atPath(root: Json, parts: readonly string[]): Json;
export declare function worstNumerator(pack: Json): bigint;

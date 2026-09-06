import { codes } from "@corporator/protocol";
import type { Json } from "./values.js";
export type PackEntry = {
    readonly hash: string;
    readonly bytes: Uint8Array;
    readonly pack: Json;
    readonly cacheControl: string;
    readonly path: string;
};
export type PackRegistry = {
    readonly entries: {
        readonly [hash: string]: PackEntry;
    };
};
export type PackHit = {
    readonly ok: true;
    readonly body: Uint8Array;
    readonly headers: {
        readonly "Cache-Control": string;
    };
    readonly path: string;
};
export type PackMiss = {
    readonly ok: false;
    readonly code: typeof codes.API_PACK_STALE;
};
export type PackGet = PackHit | PackMiss;
export declare function emptyRegistry(): PackRegistry;
export declare function registerPack(registry: PackRegistry, bytes: Uint8Array): PackRegistry;
/**
 * GET /pack/{pack_hash} helper. Unknown hash is API_PACK_STALE (closed).
 * Cache-Control comes from path_rules.pack.cache. docs/API.md §3.
 */
export declare function getPack(registry: PackRegistry, packHash: string): PackGet;
export declare function getSection(registry: PackRegistry, packHash: string, section: string): Json;

import { type Json, type PackRegistry } from "@corporator/contentpack";
import { type PackCtx } from "./pack_ctx.js";
import { type HttpResult } from "./envelope.js";
import { type Dict } from "./values.js";
import type { Store } from "./store.js";
export declare function route(ctx: PackCtx, store: Store, state: Dict, registry: PackRegistry, method: string, path: string, body: Uint8Array, headers: {
    readonly [name: string]: string;
}, live: {
    readonly ready: boolean;
    readonly migrationVersion: bigint;
    readonly attestLag: bigint;
    readonly metrics: Json;
    readonly attestLog: readonly {
        readonly id: string;
        readonly key: string;
        readonly badge: string;
        readonly root: string;
        readonly cid: string;
    }[];
}): Promise<HttpResult>;

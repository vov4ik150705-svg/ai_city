import { type PackCtx } from "./pack_ctx.js";
import { type HttpResult } from "./envelope.js";
import { type Store } from "./store.js";
import { type Dict } from "./values.js";
export declare function handleCommand(ctx: PackCtx, store: Store, state: Dict, effect: string, body: Uint8Array, headers: {
    readonly [name: string]: string;
}): Promise<HttpResult>;

import { type Dict } from "@corporator/engine";
import { type PackCtx } from "./pack_ctx.js";
import { type HttpResult } from "./envelope.js";
import { type Json } from "./values.js";
/** Live hire, claim, and lot-tile place (R-V-55). */
export declare function applyLive(ctx: PackCtx, state: Dict, effect: string, body: {
    readonly [key: string]: Json;
}, cityId: string): HttpResult | undefined;

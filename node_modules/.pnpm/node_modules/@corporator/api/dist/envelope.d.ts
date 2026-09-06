import { type Json } from "@corporator/contentpack";
import { type PackCtx } from "./pack_ctx.js";
import { type Dict } from "./values.js";
export type HttpResult = {
    readonly status: bigint;
    readonly body: Uint8Array;
    readonly headers: {
        readonly [name: string]: string;
    };
};
export declare function statusFor(ctx: PackCtx, code: string): bigint;
export declare function envelopeOk(ctx: PackCtx, state: Dict, extra: {
    readonly [key: string]: Json;
}): Json;
export declare function envelopeErr(ctx: PackCtx, state: Dict, code: string): Json;
export declare function okResult(ctx: PackCtx, state: Dict, extra?: {
    readonly [key: string]: Json;
}): HttpResult;
export declare function errResult(ctx: PackCtx, state: Dict, code: string): HttpResult;
export declare function cityKind(state: Dict, cityId: string): string;

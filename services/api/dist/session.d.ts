import { type Dict } from "@corporator/engine";
import { type HttpResult } from "./envelope.js";
import { type PackCtx } from "./pack_ctx.js";
import { type Store } from "./store.js";
export type SessionRow = {
    readonly sessionId: string;
    readonly cityId: string;
    readonly accountKind: string;
    readonly expiresCityTime: bigint;
};
export declare function handleAuthNonce(ctx: PackCtx, store: Store, state: Dict, body: Uint8Array): Promise<HttpResult>;
export declare function handleAuthSession(ctx: PackCtx, store: Store, state: Dict, body: Uint8Array): Promise<HttpResult>;
export declare function sessionFromHeaders(ctx: PackCtx, store: Store, state: Dict, headers: {
    readonly [name: string]: string;
}): Promise<SessionRow | undefined>;

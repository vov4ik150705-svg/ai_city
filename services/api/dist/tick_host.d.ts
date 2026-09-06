import { type Json } from "@corporator/contentpack";
import { type Dict } from "@corporator/engine";
import { type PackCtx } from "./pack_ctx.js";
import { type Store } from "./store.js";
export type AttestResult = {
    readonly rootHex: string;
    readonly cidHex: string;
    readonly badge: string;
};
export type Attestor = {
    submit(payload: Uint8Array): Promise<AttestResult | undefined>;
};
export type TickRun = {
    readonly state: Dict;
    readonly records: readonly Dict[];
    readonly headerBytes: Uint8Array;
    readonly recordBytes: readonly Uint8Array[];
    readonly attest: AttestResult | undefined;
};
declare function inputsFromHeader(hdr: Json): Dict;
declare function snapJson(value: unknown): Json;
declare function restoreState(cfg: Dict, snap: Json): Dict;
export declare function runTick(ctx: PackCtx, store: Store, state: Dict, inputs: Dict, attestor?: Attestor): Promise<TickRun>;
export declare function isPackHashHalt(err: unknown): boolean;
export declare function replayStored(ctx: PackCtx, store: Store, genesis: Dict, cityId: string): Promise<{
    readonly headers: readonly Uint8Array[];
    readonly records: readonly Uint8Array[];
}>;
export declare function replayFromSnapshot(ctx: PackCtx, store: Store, genesis: Dict, cityId: string, fromCityTime: bigint): Promise<{
    readonly headers: readonly Uint8Array[];
    readonly records: readonly Uint8Array[];
}>;
export { snapJson, restoreState, inputsFromHeader };

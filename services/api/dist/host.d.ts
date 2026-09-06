import { type PackRegistry } from "@corporator/contentpack";
import { type Dict } from "@corporator/engine";
import { type ChannelHub } from "./channels.js";
import { type HttpResult } from "./envelope.js";
import { type MetricView } from "./metrics.js";
import { type PackCtx } from "./pack_ctx.js";
import { type Readiness } from "./readiness.js";
import { type Store } from "./store.js";
import { isPackHashHalt, type Attestor, type TickRun } from "./tick_host.js";
export type ApiHost = {
    readonly ctx: PackCtx;
    readonly store: Store;
    readonly genesis: Dict;
    readonly registry: PackRegistry;
    readonly channels: ChannelHub;
    readonly migrationVersion: bigint;
    readonly metrics: readonly MetricView[];
    state: Dict;
    attestLag: bigint;
    attestLog: readonly AttestLogRow[];
    handle(method: string, path: string, body: Uint8Array, headers?: {
        readonly [name: string]: string;
    }): Promise<HttpResult>;
    stepTick(inputs: Dict, attestor?: Attestor): Promise<TickRun>;
    readiness(): Promise<Readiness>;
};
export type AttestLogRow = {
    readonly id: string;
    readonly key: string;
    readonly badge: string;
    readonly root: string;
    readonly cid: string;
};
export type OpenStore = () => Promise<Store>;
export declare function createHost(packBytes: Uint8Array, sql: string, sqlName: string, genesis: Dict, openStore?: OpenStore): Promise<ApiHost>;
export { isPackHashHalt };
export { readinessRequiresPack } from "./readiness.js";

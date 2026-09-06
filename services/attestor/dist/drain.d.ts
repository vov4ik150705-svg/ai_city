import { type AssetPort } from "@corporator/chainport";
export type RootJob = {
    readonly cityId: string;
    readonly cityDay: bigint;
    readonly rootHex: string;
};
export type DrainOut = {
    readonly rest: readonly RootJob[];
    readonly degraded: string;
};
export declare function drainRootOutbox(port: AssetPort, jobs: readonly RootJob[]): Promise<DrainOut>;

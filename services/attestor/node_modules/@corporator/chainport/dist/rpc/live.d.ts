import type { RpcTransport } from "../values.js";
import { type JsonRpcPost } from "./jsonrpc.js";
export type LiveContracts = {
    readonly corpToken: string;
    readonly vault: string;
    readonly stakeRegistry: string;
    readonly merkleRoots: string;
};
export type LiveRpcConfig = {
    readonly url: string;
    readonly chainId: bigint;
    readonly timeoutMs: bigint;
    readonly contracts: LiveContracts;
};
export declare function createLiveTransport(cfg: LiveRpcConfig, post?: JsonRpcPost): RpcTransport;

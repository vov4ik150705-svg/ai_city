import type { RpcOutcome } from "../values.js";
import { type JsonRpcPost } from "./jsonrpc.js";
export type LaunchIntent = {
    readonly valueWei: bigint;
    readonly taxBps: bigint;
};
export declare function launchIntent(shareBps: bigint, taxBps: bigint): LaunchIntent | undefined;
export declare function postSignedRaw(post: JsonRpcPost, signedRaw: string): Promise<RpcOutcome>;
export declare function readCreatorTaxBps(post: JsonRpcPost, curve: string): Promise<bigint | undefined>;

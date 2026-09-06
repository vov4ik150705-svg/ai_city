import type { RpcOutcome } from "../values.js";
export type JsonRpcPost = (body: string) => Promise<string | undefined>;
export declare function fetchPoster(url: string, timeoutMs: bigint): JsonRpcPost;
export declare function postEth(post: JsonRpcPost, method: string, params: readonly unknown[]): Promise<RpcOutcome>;

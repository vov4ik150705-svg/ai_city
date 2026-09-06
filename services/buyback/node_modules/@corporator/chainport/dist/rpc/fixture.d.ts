import type { AssetPort } from "../port.js";
import type { RpcTransport } from "../values.js";
export declare function lyingTransport(body: string): RpcTransport;
export declare function transportFromPort(inner: AssetPort, chain: string): RpcTransport;
export declare function transportFromPost(post: (body: string) => Promise<string | undefined>): RpcTransport;

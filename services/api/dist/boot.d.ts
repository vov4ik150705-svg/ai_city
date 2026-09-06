import { type Dict } from "@corporator/engine";
import { type ApiHost, type OpenStore } from "./host.js";
export declare function repoRootFrom(url: string): string;
export declare function defaultPackPath(root: string): string;
export declare function liveGenesis(cfg: Dict, pack: Dict): Dict;
export declare function migrationSql(root: string): {
    readonly sql: string;
    readonly name: string;
};
export declare function bootFromBytes(bytes: Uint8Array, root: string, openStore?: OpenStore): Promise<ApiHost>;

import { type ApiHost } from "./host.js";
export type ApiListen = {
    readonly host: ApiHost;
    readonly port: bigint;
    pulse(): void;
    close(): Promise<void>;
};
export declare function listenApi(host: ApiHost, bindPort?: bigint): Promise<ApiListen>;

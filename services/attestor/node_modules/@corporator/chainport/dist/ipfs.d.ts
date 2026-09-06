import { type PortErr, type PortOk } from "./values.js";
import type { EnvMap } from "./rpc/playerReady.js";
export type IpfsKind = "mock" | "http";
export type PinOk = PortOk & {
    readonly cidHex: string;
};
export type PinResult = PinOk | PortErr;
export type IpfsPort = {
    readonly kind: IpfsKind;
    pin(key: string, bytes: Uint8Array): Promise<PinResult>;
};
export declare function createMockIpfs(down: boolean): IpfsPort;
export declare function createHttpIpfs(env: EnvMap): IpfsPort;

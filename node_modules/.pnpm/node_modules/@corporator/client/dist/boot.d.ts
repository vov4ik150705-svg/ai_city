import { loadPack } from "@corporator/contentpack";
import type { ClientSnapshot } from "./hud/model.js";
export type FetchBytes = (url: string) => Promise<Uint8Array>;
export type BootOk = {
    readonly ok: true;
    readonly packBytes: Uint8Array;
    readonly packJson: ReturnType<typeof loadPack>["pack"];
    readonly snapshot: ClientSnapshot;
    readonly cityTime: bigint;
    readonly accountKind: string;
    readonly packHash: string;
};
export type BootErr = {
    readonly ok: false;
    readonly code: string;
};
export type BootResult = BootOk | BootErr;
export declare function snapshotFromEnvelope(body: unknown): ClientSnapshot;
export declare function bootFromHost(args: {
    readonly origin: string;
    readonly packHash: string;
    readonly cityId: string;
    readonly fetchBytes: FetchBytes;
}): Promise<BootResult>;
export declare function originFromListen(bind: string, port: bigint): string;

import type { AssetPort, IpfsPort } from "@corporator/chainport";
import { type AttestBadge } from "./badge.js";
import { type AttestorPack } from "./pack.js";
import { type SealedTick } from "./tree.js";
import { type AttestorState } from "./step.js";
import type { RootStore } from "./store.js";
export type AttestPublish = {
    readonly rootHex: string;
    readonly cidHex: string;
    readonly badge: AttestBadge;
    readonly degraded: string;
    readonly next: AttestorState;
};
export declare function publishSealed(pack: AttestorPack, port: AssetPort, ipfs: IpfsPort, store: RootStore, state: AttestorState, ticks: readonly SealedTick[], wallS: bigint): Promise<AttestPublish>;

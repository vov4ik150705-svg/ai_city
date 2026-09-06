import type { RootJob } from "./drain.js";
import { type AttestorPack } from "./pack.js";
import type { RootStore } from "./store.js";
import { type SealedTick } from "./tree.js";
export type PublishFlags = {
    readonly ipfs: boolean;
    readonly rpc: boolean;
};
export type AttestorState = {
    readonly lagTicks: bigint;
    readonly outbox: readonly Uint8Array[];
    readonly rootJobs: readonly RootJob[];
    readonly lastFlushWallS: bigint;
    readonly hasFlushed: bigint;
    readonly degraded: string;
};
export type StepOut = {
    readonly next: AttestorState;
    readonly root: Uint8Array | undefined;
    readonly cid: Uint8Array | undefined;
};
export declare function emptyAttestorState(): AttestorState;
export declare function flushDue(pack: AttestorPack, state: AttestorState, wallS: bigint): boolean;
export declare function stepAttestor(pack: AttestorPack, store: RootStore, state: AttestorState, ticks: readonly SealedTick[], wallS: bigint, publish: PublishFlags): StepOut;

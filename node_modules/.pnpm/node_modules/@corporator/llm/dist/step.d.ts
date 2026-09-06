import type { LlmPack } from "./pack.js";
export type ProviderResult = {
    readonly ok: boolean;
    readonly text: string;
};
export type LlmOut = {
    readonly text: string;
    readonly template: boolean;
    readonly code: string;
};
export type LlmState = {
    readonly inFlight: bigint;
};
export declare function emptyLlmState(): LlmState;
export declare function completeLlm(pack: LlmPack, provider: ProviderResult): LlmOut;
export declare function enqueue(pack: LlmPack, state: LlmState): {
    readonly next: LlmState;
    readonly code: string;
};

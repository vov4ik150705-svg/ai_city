import type { AssetPort } from "@corporator/chainport";
import type { BuybackPack } from "./pack.js";
import { type BatchStamps } from "./policy.js";
export type VaultStep = {
    readonly ok: true;
    readonly stamps: BatchStamps;
} | {
    readonly ok: false;
    readonly code: string;
    readonly stamps: BatchStamps;
};
export declare function depositThenMint(port: AssetPort, pack: BuybackPack, account: string, corpAmount: bigint, capitalAmount: bigint, stamps: BatchStamps, depositTime: bigint, mintTime: bigint): Promise<VaultStep>;

import type { AssetPort } from "./port.js";
import { type RpcTransport, type StakeRow, type WalletPrice } from "./values.js";
export declare function recordedStakeSnapshot(rows: readonly StakeRow[]): bigint;
export declare function readWalletPrice(port: AssetPort, account: string, transport: RpcTransport | undefined, last: WalletPrice | undefined): Promise<WalletPrice>;

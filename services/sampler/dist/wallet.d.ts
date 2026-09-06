import { type AssetPort, type RpcTransport, type WalletPrice } from "@corporator/chainport";
export declare function stepWalletPrice(port: AssetPort, account: string, transport: RpcTransport | undefined, last: WalletPrice | undefined): Promise<WalletPrice>;

import { type AssetPort, type PortResult } from "@corporator/chainport";
export declare function submitMinuteRoot(port: AssetPort, cityId: string, cityDay: bigint, root: Uint8Array): Promise<PortResult>;

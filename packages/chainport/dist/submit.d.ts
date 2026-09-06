import type { AssetPort } from "./port.js";
import { type PortResult } from "./values.js";
export declare function submitMinuteRoot(port: AssetPort, cityId: string, cityDay: bigint, rootHex: string): Promise<PortResult>;

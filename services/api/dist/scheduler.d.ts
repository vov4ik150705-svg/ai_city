import { type Dict } from "@corporator/engine";
import { type PackCtx } from "./pack_ctx.js";
import { type ApiHost } from "./host.js";
import { type TickLock } from "./tick_lock.js";
import { type Attestor } from "./tick_host.js";
export declare function nextTickInputs(ctx: PackCtx, state: Dict, cityId: string): Dict;
export declare function firstCityId(state: Dict): string;
export declare function tickOnce(host: ApiHost, attestor?: Attestor): Promise<void>;
export declare function tickIfWriter(host: ApiHost, lock: TickLock, attestor?: Attestor): Promise<boolean>;

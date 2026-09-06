import { encodeHeader } from "./record.js";
import type { Dict } from "./values.js";
export declare function tick(state: Dict, inputs: Dict): readonly [Dict, Dict[]];
export declare function tickHeader(state: Dict, inputs: Dict, prevStateHash?: string): Dict;
export declare function catchUp(state: Dict, inputsNow: Dict, lastCityTime: bigint): readonly [Dict, Dict[]];
export { encodeHeader };

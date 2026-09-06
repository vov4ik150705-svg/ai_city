import { leafHash } from "./merkle.js";
import { canonical } from "./canonical.js";
import type { Dict } from "./values.js";
export declare function publicVerify(opts: {
    readonly stateBefore: Dict;
    readonly inputs: Dict;
    readonly expectedHeaderBytes: Uint8Array;
    readonly expectedRecordBytes: readonly Uint8Array[];
    readonly root: Uint8Array;
}): boolean;
export declare function encodeLeaves(header: Dict, records: readonly Dict[], hdrSpec: Dict, recSpec: Dict): Uint8Array[];
export { canonical, leafHash };

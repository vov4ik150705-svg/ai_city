import { codes } from "@corporator/protocol";
import { LoadError, asDict } from "./values.js";
import { fromUtf8 } from "./utf8.js";
import { parseJson } from "./parse.js";
import { canonical, withoutHash } from "./canonical.js";
import { sha256Hex } from "./sha256.js";
function rejectBom(bytes) {
    const b0 = bytes[0];
    const b1 = bytes[1];
    const b2 = bytes[2];
    if (b0 === 0xef && b1 === 0xbb && b2 === 0xbf) {
        throw new LoadError(codes.API_MALFORMED);
    }
}
/**
 * Load pack bytes. Hash check is the only closed circuit: mismatch is API_PACK_STALE.
 * docs/ARCHITECTURE.md §3; docs/CONTENT.md §5; PLAN_CODE D-C-4.
 */
export function loadPack(bytes) {
    rejectBom(bytes);
    const pack = parseJson(fromUtf8(bytes));
    const obj = asDict(pack);
    const stored = obj["hash"];
    if (typeof stored !== "string" || stored.length === 0) {
        throw new LoadError(codes.API_MALFORMED);
    }
    const digest = sha256Hex(canonical(withoutHash(pack)));
    if (digest !== stored) {
        throw new LoadError(codes.API_PACK_STALE);
    }
    return { pack, hash: stored };
}
export function atPath(root, parts) {
    let cur = root;
    for (const part of parts) {
        const obj = asDict(cur);
        const next = obj[part];
        if (next === undefined)
            throw new LoadError(codes.API_MALFORMED);
        cur = next;
    }
    return cur;
}
export function worstNumerator(pack) {
    const raw = atPath(pack, [
        "generated",
        "modifiers",
        "modifier_stack_probe",
        "worst_numerator",
    ]);
    if (typeof raw !== "string")
        throw new LoadError(codes.API_MALFORMED);
    return BigInt(raw);
}

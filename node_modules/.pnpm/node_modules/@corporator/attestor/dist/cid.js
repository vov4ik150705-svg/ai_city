import { sha256 } from "@corporator/engine";
import { codes } from "@corporator/protocol";
import { LoadError, byteOf } from "./values.js";
export function cidV1(pack, payload) {
    const digest = sha256(payload);
    if (BigInt(digest.length) !== pack.cidMhLength) {
        throw new LoadError(codes.API_MALFORMED);
    }
    const prefix = new Uint8Array([
        byteOf(pack.cidVersion),
        byteOf(pack.cidCodec),
        byteOf(pack.cidMhCode),
        byteOf(pack.cidMhLength),
    ]);
    const out = new Uint8Array(prefix.length + digest.length);
    out.set(prefix, 0);
    out.set(digest, prefix.length);
    return out;
}

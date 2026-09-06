/**
 * Ethereum personal_sign recover. Pure; no network. D-P-3.
 * Identity never enters the tick. DESIGN.md §6.2 keccak.
 */
import { Signature } from "@noble/secp256k1";
import { bytesToHex, hexToBytes, keccak256 } from "@corporator/engine";
function asciiBytes(text) {
    const out = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c > 127)
            return new Uint8Array();
        out[i] = c;
    }
    return out;
}
function strip0x(hex) {
    if (hex.length >= 2 && hex[0] === "0" && (hex[1] === "x" || hex[1] === "X")) {
        return hex.slice(2);
    }
    return hex;
}
export function personalHash(message) {
    const msg = asciiBytes(message);
    const prefix = asciiBytes("\x19Ethereum Signed Message:\n" + msg.length.toString());
    const out = new Uint8Array(prefix.length + msg.length);
    out.set(prefix, 0);
    out.set(msg, prefix.length);
    return keccak256(out);
}
export function recoverAddress(message, signatureHex) {
    const raw = strip0x(signatureHex);
    if (raw.length !== 130)
        return undefined;
    let sig;
    try {
        sig = hexToBytes(raw.toLowerCase());
    }
    catch {
        return undefined;
    }
    if (sig.length !== 65)
        return undefined;
    const rec = sig[64];
    if (rec === undefined)
        return undefined;
    const recBit = rec >= 27 ? rec - 27 : rec;
    if (recBit !== 0 && recBit !== 1)
        return undefined;
    const hash = personalHash(message);
    try {
        const compact = sig.subarray(0, 64);
        const parsed = Signature.fromCompact(compact).addRecoveryBit(recBit);
        const pub = parsed.recoverPublicKey(hash).toRawBytes(false);
        const body = pub.subarray(1);
        const addr = bytesToHex(keccak256(body).subarray(12));
        return "0x" + addr;
    }
    catch {
        return undefined;
    }
}
export function normalizeAddress(value) {
    const raw = strip0x(value).toLowerCase();
    if (raw.length !== 40)
        return "";
    return "0x" + raw;
}

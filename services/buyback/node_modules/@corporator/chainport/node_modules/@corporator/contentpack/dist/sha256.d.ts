/**
 * SHA-256. Crypto constants, not pack params.
 * Duplicate of engine sha256: contentpack cannot import engine (R-C-13).
 * pack.py pack_hash is this digest over canonical bytes without the hash field.
 * docs/CONTENT.md §5.
 */
export declare function sha256(data: Uint8Array): Uint8Array;
export declare function sha256Hex(data: Uint8Array): string;

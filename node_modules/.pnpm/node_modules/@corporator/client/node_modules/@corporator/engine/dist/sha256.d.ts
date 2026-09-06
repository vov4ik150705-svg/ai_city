/**
 * SHA-256. Crypto constants, not pack params. Used for PRNG seed and companion_commands_hash.
 * docs/TICK.md §5; pack.py pack_hash is the same digest over canonical bytes.
 */
export declare function sha256(data: Uint8Array): Uint8Array;
export declare function sha256Hex(data: Uint8Array): string;
export declare function sha256First8Be(data: Uint8Array): bigint;
export declare function sha256HeadHex(data: Uint8Array): string;

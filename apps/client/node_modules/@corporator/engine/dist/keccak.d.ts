/**
 * Ethereum keccak-256 (Keccak-f[1600], pad 0x01). Crypto constants, not pack params.
 * content/keccak.py; DESIGN.md §6.2.
 */
export declare function bytesToHex(data: Uint8Array): string;
export declare function hexToBytes(hex: string): Uint8Array;
export declare function keccak256(data: Uint8Array): Uint8Array;
export declare function keccak256Hex(data: Uint8Array): string;

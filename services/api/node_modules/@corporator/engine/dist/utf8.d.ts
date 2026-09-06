/**
 * UTF-8 encode/decode without TextEncoder (engine tsconfig types: []).
 * Crypto-adjacent constants, not pack params.
 */
export declare function utf8(text: string): Uint8Array;
export declare function fromUtf8(data: Uint8Array): string;

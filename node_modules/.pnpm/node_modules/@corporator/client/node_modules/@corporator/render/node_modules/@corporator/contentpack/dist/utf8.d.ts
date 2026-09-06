/**
 * UTF-8 encode/decode without TextEncoder (contentpack tsconfig types: []).
 * Crypto-adjacent constants, not pack params. Duplicate of engine utf8: contentpack
 * cannot import engine (arch.packages.allowed_deps). docs/ARCHITECTURE.md §2.
 */
export declare function utf8(text: string): Uint8Array;
export declare function fromUtf8(data: Uint8Array): string;

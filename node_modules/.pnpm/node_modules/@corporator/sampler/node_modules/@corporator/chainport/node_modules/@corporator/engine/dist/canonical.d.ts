import type { Json } from "./values.js";
export declare function assertNoFloats(value: unknown, path?: string): void;
export declare function asJson(value: unknown): Json;
export declare function canonical(value: unknown): Uint8Array;

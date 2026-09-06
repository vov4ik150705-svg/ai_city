import type { Json } from "./values.js";
export declare function assertNoFloats(value: unknown): void;
export declare function asJson(value: unknown): Json;
export declare function canonical(value: unknown): Uint8Array;
export declare function withoutHash(root: Json): Json;

import type { Dict } from "./values.js";
export declare function validateRecord(rec: Dict, spec: Dict): string[];
export declare function validateHeader(hdr: Dict, spec: Dict): string[];
export declare function encodeRecord(rec: Dict, spec: Dict): Uint8Array;
export declare function encodeHeader(hdr: Dict, spec: Dict): Uint8Array;
export declare function requireRecord(rec: Dict, spec: Dict, tickIndex: bigint, cityId: string): void;
export declare function requireHeader(hdr: Dict, spec: Dict, tickIndex: bigint, cityId: string): void;

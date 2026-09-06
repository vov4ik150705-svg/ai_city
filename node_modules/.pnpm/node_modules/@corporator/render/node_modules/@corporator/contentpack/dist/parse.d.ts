import type { Json } from "./values.js";
/**
 * Streaming JSON: integers become bigint; float / -0 / NaN / Infinity / duplicate key / truncated
 * stream raise API_MALFORMED. docs/CONTENT.md §5; PLAN_CODE D-C-4.
 */
export declare function parseJson(text: string): Json;

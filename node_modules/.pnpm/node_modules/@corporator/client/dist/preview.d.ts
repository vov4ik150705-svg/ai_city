import type { Dict } from "@corporator/engine";
export type Preview = {
    readonly [key: string]: unknown;
};
/** Readonly projection. Does not run the tick. HUD.md §8; arch.packages.client.preview_only. */
export declare function preview(state: Dict): Preview;

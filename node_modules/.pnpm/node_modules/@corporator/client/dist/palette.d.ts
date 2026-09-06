export type Palette = {
    readonly ramps: {
        readonly [name: string]: readonly string[];
    };
};
export declare function parsePalette(text: string): Palette;
export declare function rampHex(pal: Palette, ramp: string, index: bigint): string;
/** HUD.md §7 tokens from the same ramps as sprites. Indices are ramp positions, not pack rates. */
export declare function hudCssVars(pal: Palette): {
    readonly [name: string]: string;
};
export type HexRgb01 = {
    readonly r: number;
    readonly g: number;
    readonly b: number;
};
export declare function hexToPixi(hex: string): number;
export declare function hexRgb01(hex: string): HexRgb01;

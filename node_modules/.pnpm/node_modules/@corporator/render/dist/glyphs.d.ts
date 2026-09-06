import { Container, Texture } from "pixi.js";
export type GlyphMetric = {
    readonly x: bigint;
    readonly y: bigint;
    readonly w: bigint;
    readonly h: bigint;
    readonly advance: bigint;
};
export declare function measureGlyphs(text: string, glyphs: {
    readonly [ch: string]: GlyphMetric | undefined;
}): bigint;
export declare function joinLabel(name: string, ticker: string, level: bigint): string;
export declare function blitGlyphs(parent: Container, text: string, originX: bigint, originY: bigint, font: Texture, glyphs: {
    readonly [ch: string]: GlyphMetric | undefined;
}): void;

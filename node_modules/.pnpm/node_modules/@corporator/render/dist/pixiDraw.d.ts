import { Container, Graphics, Sprite, Texture } from "pixi.js";
import type { AtlasFrame } from "./sprites.js";
export declare function textureOf(base: Texture, frames: {
    readonly [id: string]: AtlasFrame;
}, id: string): Texture | undefined;
export declare function placeCube(parent: Container, tex: Texture, fr: AtlasFrame, originX: bigint, originY: bigint, tileW: bigint, lift: bigint): Sprite;
export declare function placeWaterPlane(parent: Container, color: number, a: {
    readonly x: bigint;
    readonly y: bigint;
}, b: {
    readonly x: bigint;
    readonly y: bigint;
}, c: {
    readonly x: bigint;
    readonly y: bigint;
}, d: {
    readonly x: bigint;
    readonly y: bigint;
}, cubeH: bigint, pad: bigint): Graphics;

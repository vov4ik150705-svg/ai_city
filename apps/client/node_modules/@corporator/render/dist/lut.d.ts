import { Filter } from "pixi.js";
/** 3D palette snap from packed lut_snap.png. Side and slice layout come from the texture, not TS literals. */
export declare function snapLutFilter(snap: HTMLImageElement | ImageBitmap, side: bigint): Filter | undefined;

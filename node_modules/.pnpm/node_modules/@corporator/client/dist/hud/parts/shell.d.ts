import type { HudFixture } from "../../layout.js";
export declare function addPx(a: string, b: string): string;
export declare function hudShellVars(hud: HudFixture): {
    readonly [name: string]: string;
};
export declare function hudNarrowLimit(hud: HudFixture, packSafeW: bigint): bigint;

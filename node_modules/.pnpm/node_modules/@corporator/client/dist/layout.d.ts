export type HudFixture = {
    readonly aspect_w: bigint;
    readonly aspect_h: bigint;
    readonly column_width_px: bigint;
    readonly topbar_height_px: bigint;
    readonly stock_strip_height_px: bigint;
    readonly bottom_menu_height_px: bigint;
};
export type SafeRect = {
    readonly viewport_w_px: bigint;
    readonly viewport_h_px: bigint;
    readonly safe_rect_w_px: bigint;
    readonly safe_rect_h_px: bigint;
    readonly tile_h_px: bigint;
};
export declare function safeRect(hud: HudFixture, tileW: bigint): SafeRect;
export declare function isoBBox(gridSize: bigint, tileW: bigint, tileH: bigint): {
    readonly iso_w_px: bigint;
    readonly iso_h_px: bigint;
};
export declare function islandFits(isoW: bigint, isoH: bigint, safeW: bigint, safeH: bigint, num: bigint, den: bigint): boolean;

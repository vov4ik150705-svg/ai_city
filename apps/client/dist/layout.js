export function safeRect(hud, tileW) {
    const two = 1n + 1n;
    const vw = hud.aspect_w * tileW;
    const vh = hud.aspect_w === 0n ? 0n : (vw * hud.aspect_h) / hud.aspect_w;
    let safeW = vw - two * hud.column_width_px;
    let safeH = vh - hud.topbar_height_px - hud.stock_strip_height_px - hud.bottom_menu_height_px;
    if (safeW < 1n)
        safeW = 1n;
    if (safeH < 1n)
        safeH = 1n;
    return {
        viewport_w_px: vw,
        viewport_h_px: vh,
        safe_rect_w_px: safeW,
        safe_rect_h_px: safeH,
        tile_h_px: tileW / two,
    };
}
export function isoBBox(gridSize, tileW, tileH) {
    return { iso_w_px: gridSize * tileW, iso_h_px: gridSize * tileH };
}
export function islandFits(isoW, isoH, safeW, safeH, num, den) {
    if (den <= 0n)
        return false;
    return isoW * num <= safeW * den && isoH * num <= safeH * den;
}

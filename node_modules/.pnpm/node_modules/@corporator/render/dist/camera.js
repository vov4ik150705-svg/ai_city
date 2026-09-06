import { cellAt } from "./ground.js";
import { floorDiv, tileCenter, tileFromWorld } from "./iso.js";
import { isBackgroundUnit } from "./motion.js";
import { sortPlaced } from "./sprites.js";
export function snapZoomIndex(index, count) {
    if (count <= 0n)
        return 0n;
    if (index < 0n)
        return 0n;
    const last = count - 1n;
    if (index > last)
        return last;
    return index;
}
export function zoomAt(levels, index) {
    const i = snapZoomIndex(index, BigInt(levels.length));
    const row = levels[Number(i)];
    if (row === undefined)
        return { num: 1n, den: 1n };
    return row;
}
export function stepZoomIndex(index, dir, count) {
    return snapZoomIndex(index + dir, count);
}
export function zoomInPack(num, den, levels) {
    if (den === 0n)
        return false;
    for (const lv of levels) {
        if (lv.den === 0n)
            continue;
        if (lv.num * den === num * lv.den)
            return true;
    }
    return false;
}
export function clampCamera(x, y, bounds) {
    let loX = bounds.minX;
    let hiX = bounds.maxX;
    let loY = bounds.minY;
    let hiY = bounds.maxY;
    if (loX > hiX) {
        loX = bounds.maxX;
        hiX = bounds.minX;
    }
    if (loY > hiY) {
        loY = bounds.maxY;
        hiY = bounds.minY;
    }
    let cx = x;
    let cy = y;
    if (cx < loX)
        cx = loX;
    if (cx > hiX)
        cx = hiX;
    if (cy < loY)
        cy = loY;
    if (cy > hiY)
        cy = hiY;
    return { x: cx, y: cy };
}
export function lookAtZone(id, centroids, bounds) {
    const c = centroids[id];
    if (c === undefined)
        return clampCamera(0n, 0n, bounds);
    return clampCamera(c.x, c.y, bounds);
}
export function cameraWorldOffset(centerTX, centerTY, zoomNum, zoomDen, viewW, viewH, tileW) {
    const mid = tileCenter(centerTX, centerTY, tileW);
    const two = 1n + 1n;
    const den = zoomDen === 0n ? 1n : zoomDen;
    const num = zoomNum === 0n ? 1n : zoomNum;
    return {
        x: viewW / two - floorDiv(mid.x * num, den),
        y: viewH / two - floorDiv(mid.y * num, den),
    };
}
export function screenToWorld(sx, sy, centerTX, centerTY, zoomNum, zoomDen, viewW, viewH, tileW) {
    const two = 1n + 1n;
    const den = zoomDen === 0n ? 1n : zoomDen;
    const num = zoomNum === 0n ? 1n : zoomNum;
    const mid = tileCenter(centerTX, centerTY, tileW);
    return {
        x: mid.x + floorDiv((sx - viewW / two) * den, num),
        y: mid.y + floorDiv((sy - viewH / two) * den, num),
    };
}
export function objectAtTile(objects, frames, tx, ty) {
    const ranked = sortPlaced(objects, frames);
    let i = ranked.length;
    while (i > 0) {
        i -= 1;
        const row = ranked[i];
        if (row === undefined)
            continue;
        if (isBackgroundUnit(row.id))
            continue;
        if (tx >= row.tileX && tx < row.tileX + row.cols && ty >= row.tileY && ty < row.tileY + row.rows) {
            return row.id;
        }
    }
    return "";
}
export function hitFromWorld(px, py, tileW, map, objects, frames) {
    const t = tileFromWorld(px, py, tileW);
    const objectId = objectAtTile(objects, frames, t.tx, t.ty);
    const fr = frames[objectId];
    return {
        tileX: t.tx,
        tileY: t.ty,
        objectId,
        kind: fr === undefined ? "" : fr.kind,
        cell: cellAt(map, t.tx, t.ty),
    };
}
/**
 * Closed stock beacon → districts; other building → building_card;
 * empty / water / road → build catalog (R-V-55). Tile legality is BUILD_TILE_ILLEGAL.
 */
export function routeSceneClick(hit, beacons, opened) {
    if (hit.objectId.length > 0 && hit.kind === "building") {
        const district = beacons[hit.objectId];
        if (district !== undefined) {
            const on = opened[district] ?? 0n;
            if (on === 0n)
                return "districts";
        }
        return "building_card";
    }
    if (hit.cell === "")
        return "";
    return "build";
}

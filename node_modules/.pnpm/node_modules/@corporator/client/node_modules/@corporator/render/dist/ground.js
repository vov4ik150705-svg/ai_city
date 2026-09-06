export function cellAt(map, x, y) {
    const row = map[Number(y)];
    if (row === undefined)
        return "";
    const xi = Number(x);
    if (xi < 0 || xi >= row.length)
        return "";
    return row[xi] ?? "";
}
function asTile(value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number" && Number.isInteger(value)) {
        return BigInt(value);
    }
    return undefined;
}
export function loadScene(root) {
    if (root === null || typeof root !== "object" || Array.isArray(root)) {
        return { legend: {}, map: [], objects: [] };
    }
    const row = root;
    const legendIn = row["legend"];
    const legend = {};
    if (legendIn !== null && typeof legendIn === "object" && !Array.isArray(legendIn)) {
        const obj = legendIn;
        for (const key of Object.keys(obj)) {
            const v = obj[key];
            if (typeof v === "string")
                legend[key] = v;
        }
    }
    const mapIn = row["map"];
    const map = [];
    if (Array.isArray(mapIn)) {
        for (const line of mapIn) {
            if (typeof line === "string")
                map.push(line);
        }
    }
    const objects = [];
    const objIn = row["objects"];
    if (Array.isArray(objIn)) {
        const two = 1 + 1;
        for (const item of objIn) {
            if (item === null || typeof item !== "object" || Array.isArray(item))
                continue;
            const o = item;
            const tile = o["tile"];
            if (!Array.isArray(tile) || tile.length < two)
                continue;
            const tx = asTile(tile[0]);
            const ty = asTile(tile[1]);
            if (tx === undefined || ty === undefined)
                continue;
            if (typeof o["id"] !== "string")
                continue;
            objects.push({ id: o["id"], tileX: tx, tileY: ty });
        }
    }
    return { legend, map, objects };
}
export function isShore(map, tx, ty) {
    const ch = cellAt(map, tx, ty);
    if (ch === "" || ch === "~")
        return false;
    const n = cellAt(map, tx, ty - 1n);
    const s = cellAt(map, tx, ty + 1n);
    const e = cellAt(map, tx + 1n, ty);
    const w = cellAt(map, tx - 1n, ty);
    return n === "~" || s === "~" || e === "~" || w === "~" || n === "" || s === "" || e === "" || w === "";
}
export function isRoadCell(map, x, y) {
    const ch = cellAt(map, x, y);
    return ch === "r" || ch === "c";
}
/** 4-bit NESW mask; bit0=N, bit1=E, bit2=S, bit3=W. Same as tiles.neighbor_mask. */
export function neighborMask(map, tx, ty) {
    const one = 1n;
    const two = one + one;
    const four = two + two;
    const eight = four + four;
    let mask = 0n;
    if (isRoadCell(map, tx, ty - 1n))
        mask += one;
    if (isRoadCell(map, tx + 1n, ty))
        mask += two;
    if (isRoadCell(map, tx, ty + 1n))
        mask += four;
    if (isRoadCell(map, tx - 1n, ty))
        mask += eight;
    return mask;
}
function pickAutotile(table, mask, fallback) {
    const id = table[Number(mask)];
    if (id === undefined || id.length === 0)
        return fallback;
    return id;
}
/** Same 16-way pick as art/pipeline/tiles.py road_sprite. Table from the pack. */
export function roadSprite(map, tx, ty, table) {
    return pickAutotile(table, neighborMask(map, tx, ty), "road_plaza");
}
/** Curb faces adjacent road/crosswalk. Table from the pack. */
export function sidewalkSprite(map, tx, ty, table) {
    return pickAutotile(table, neighborMask(map, tx, ty), "sidewalk");
}
export function topSpriteId(map, tx, ty, sprites, roadTable, walkTable) {
    const ch = cellAt(map, tx, ty);
    if (ch === "r")
        return roadSprite(map, tx, ty, roadTable);
    if (ch === "s")
        return sidewalkSprite(map, tx, ty, walkTable);
    const hit = sprites[ch];
    if (hit !== undefined && hit.length > 0)
        return hit;
    return "island_block";
}
export function padFootprints(objects, frames, skip) {
    const blocked = {};
    for (const id of skip)
        blocked[id] = true;
    const out = [];
    for (const obj of objects) {
        if (blocked[obj.id] === true)
            continue;
        const fr = frames[obj.id];
        if (fr === undefined)
            continue;
        if (fr.kind !== "building")
            continue;
        const cols = fr.cols > 0n ? fr.cols : 1n;
        const rows = fr.rows > 0n ? fr.rows : 1n;
        out.push({ tx: obj.tileX, ty: obj.tileY, cols, rows });
    }
    return out;
}
export function tileOnPad(tx, ty, pads) {
    for (const pad of pads) {
        if (tx < pad.tx)
            continue;
        if (ty < pad.ty)
            continue;
        if (tx >= pad.tx + pad.cols)
            continue;
        if (ty >= pad.ty + pad.rows)
            continue;
        return true;
    }
    return false;
}
export function groundTopId(map, tx, ty, sprites, roadTable, walkTable, padId, pads) {
    void padId;
    void pads;
    return topSpriteId(map, tx, ty, sprites, roadTable, walkTable);
}
export function lowerSpriteId(map, tx, ty, dirt, cliff, rock) {
    const ch = cellAt(map, tx, ty);
    if (ch === "w")
        return rock;
    if (isShore(map, tx, ty))
        return cliff;
    return dirt;
}

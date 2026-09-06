import { frontVertex } from "./iso.js";
export function cloudLift(id, tileW) {
    return id.startsWith("cloud") ? tileW : 0n;
}
export function painterDepth(tx, ty, cols, rows) {
    return tx + cols - 1n + (ty + rows - 1n);
}
export function painterTie(tx) {
    return tx;
}
/** Sprite top-left. Same as scene.py: front vertex minus foot_anchor minus cube drop minus lift. */
export function spriteScreenPos(tx, ty, cols, rows, tileW, cubeH, footX, footY, lift) {
    const front = frontVertex(tx, ty, cols, rows, tileW);
    return {
        x: front.x - footX,
        y: front.y - footY - cubeH - lift,
    };
}
export function sortPlaced(objects, frames) {
    const out = [];
    let index = 0n;
    for (const obj of objects) {
        const fr = frames[obj.id];
        if (fr === undefined)
            continue;
        const cols = fr.cols > 0n ? fr.cols : 1n;
        const rows = fr.rows > 0n ? fr.rows : 1n;
        out.push({
            id: obj.id,
            tileX: obj.tileX,
            tileY: obj.tileY,
            cols,
            rows,
            depth: painterDepth(obj.tileX, obj.tileY, cols, rows),
            tie: painterTie(obj.tileX),
            index,
        });
        index += 1n;
    }
    return out.slice().sort((a, b) => {
        if (a.depth < b.depth)
            return -1;
        if (a.depth > b.depth)
            return 1;
        if (a.tie < b.tie)
            return -1;
        if (a.tie > b.tie)
            return 1;
        if (a.index < b.index)
            return -1;
        if (a.index > b.index)
            return 1;
        return 0;
    });
}
export function overlayAt(level, rows) {
    const row = rows[level.toString()];
    if (row === undefined)
        return { pips: 0n, antenna: 0n, depends: 0n };
    return row;
}
export function badgeKind(code) {
    if (code === "IDLE_NO_ENERGY" || code === "IDLE_NO_COMPUTE")
        return "shortage";
    if (code === "IDLE_NO_AGENT")
        return "occupancy";
    if (code.startsWith("IDLE_"))
        return "idle";
    return "state";
}
export function badgeSprite(kind) {
    if (kind === "shortage")
        return "badge_shortage";
    if (kind === "occupancy")
        return "badge_occupancy";
    return "";
}
export function badgeOnScene(code, badges) {
    for (const row of badges) {
        if (row.code !== code)
            continue;
        return row.logOnly === 0n;
    }
    return false;
}
export function objectIdle(kind, energy, compute) {
    if (kind !== "building")
        return "";
    if (energy === 0n)
        return "IDLE_NO_ENERGY";
    if (compute === 0n)
        return "IDLE_NO_COMPUTE";
    return "";
}
export function labelsVisible(zoomNum, zoomDen, minNum, minDen) {
    if (minNum <= 0n || minDen <= 0n)
        return false;
    if (zoomDen <= 0n)
        return false;
    return zoomNum * minDen >= minNum * zoomDen;
}
export function labelRank(kind) {
    switch (kind) {
        case "beacon":
            return 1n + 1n + 1n;
        case "base":
            return 1n + 1n;
        case "synergy":
            return 1n;
        default:
            return 0n;
    }
}
function aabbHits(a, b) {
    if (a.x + a.w <= b.x)
        return false;
    if (b.x + b.w <= a.x)
        return false;
    if (a.y + a.h <= b.y)
        return false;
    if (b.y + b.h <= a.y)
        return false;
    return true;
}
export function skipOverlappingLabels(boxes) {
    const ranked = boxes.slice().sort((a, b) => {
        if (a.rank > b.rank)
            return -1;
        if (a.rank < b.rank)
            return 1;
        if (a.depth < b.depth)
            return -1;
        if (a.depth > b.depth)
            return 1;
        return 0;
    });
    const kept = [];
    const ids = [];
    for (const box of ranked) {
        let hit = false;
        for (const prev of kept) {
            if (aabbHits(box, prev)) {
                hit = true;
                break;
            }
        }
        if (hit)
            continue;
        kept.push(box);
        ids.push(box.id);
    }
    return ids;
}
export function badgePulseOn(cityTime, period) {
    if (period <= 0n)
        return true;
    const two = 1n + 1n;
    return (cityTime / period) % two === 0n;
}
export function pipWorldPos(tx, ty, cols, rows, tileW, cubeH, step, offset, index) {
    const front = frontVertex(tx, ty, cols, rows, tileW);
    return {
        x: front.x,
        y: front.y - cubeH - offset - index * step,
    };
}
export function sceneMarkers(objects, frames, energy, compute, badges) {
    const out = [];
    for (const obj of objects) {
        const fr = frames[obj.id];
        if (fr === undefined)
            continue;
        const code = objectIdle(fr.kind, energy, compute);
        if (code.length === 0)
            continue;
        if (!badgeOnScene(code, badges))
            continue;
        const sprite = badgeSprite(badgeKind(code));
        if (sprite.length === 0)
            continue;
        out.push({ sprite, tileX: obj.tileX, tileY: obj.tileY });
    }
    return out;
}
export function footprintDiamond(tx, ty, cols, rows, tileW, cubeH) {
    const front = frontVertex(tx, ty, cols, rows, tileW);
    const two = 1n + 1n;
    const halfW = tileW / two;
    const halfH = halfW / two;
    const span = cols + rows;
    const w = span * halfW;
    const h = span * halfH;
    const cx = front.x;
    const cy = front.y - cubeH;
    return [
        { x: cx - w / two, y: cy - h / two },
        { x: cx, y: cy - h },
        { x: cx + w / two, y: cy - h / two },
        { x: cx, y: cy },
    ];
}

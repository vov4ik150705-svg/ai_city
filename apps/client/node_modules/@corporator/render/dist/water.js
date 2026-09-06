import { cellAt } from "./ground.js";
/**
 * Water frame from city_time, not a frame delta (L334, D-V-8).
 * step = cityTime * water_steps_per_tick; phase = (tx + step) mod frames.
 */
export function waterPhase(tx, cityTime, frames, stepsPerTick) {
    if (frames <= 0n)
        return 0n;
    const step = cityTime * stepsPerTick;
    const raw = tx + step;
    const mod = raw % frames;
    if (mod < 0n)
        return mod + frames;
    return mod;
}
export function isShoreWater(map, tx, ty) {
    if (cellAt(map, tx, ty) !== "~")
        return false;
    const dirs = [
        [1n, 0n],
        [-1n, 0n],
        [0n, 1n],
        [0n, -1n],
    ];
    for (const [dx, dy] of dirs) {
        const ch = cellAt(map, tx + dx, ty + dy);
        if (ch !== "" && ch !== "~")
            return true;
    }
    return false;
}
export function isShallowWater(map, tx, ty, reach) {
    if (cellAt(map, tx, ty) !== "~")
        return false;
    let dy = -reach;
    while (dy <= reach) {
        let dx = -reach;
        while (dx <= reach) {
            if (!(dx === 0n && dy === 0n)) {
                const ch = cellAt(map, tx + dx, ty + dy);
                if (ch !== "" && ch !== "~")
                    return true;
            }
            dx += 1n;
        }
        dy += 1n;
    }
    return false;
}
export function waterSpriteId(map, tx, ty, reach, shallowId, deepId) {
    if (isShallowWater(map, tx, ty, reach))
        return shallowId;
    return deepId;
}
/** Shallow water picks strip[phase]; deep stays deepId. Phase is city_time (L334). */
export function waterFrameId(map, tx, ty, reach, strip, deepId, cityTime, stepsPerTick, frames) {
    if (!isShallowWater(map, tx, ty, reach))
        return deepId;
    const n = frames > 0n ? frames : BigInt(strip.length);
    const phase = waterPhase(tx, cityTime, n, stepsPerTick);
    const hit = strip[Number(phase)];
    if (hit !== undefined && hit.length > 0)
        return hit;
    const first = strip[0];
    if (first !== undefined && first.length > 0)
        return first;
    return deepId;
}

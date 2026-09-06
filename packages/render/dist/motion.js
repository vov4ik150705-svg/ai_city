import { sha256, utf8 } from "@corporator/contentpack";
import { cellAt, isRoadCell } from "./ground.js";
import { tileCenter } from "./iso.js";
/**
 * Same eight-byte sha256 as content/world.py world_prng (TZ_RENDER §8, D-V-8).
 * byteCount is packed world_prng_bytes and is also the per-byte shift.
 */
export function worldPrng(cityId, stream, index, byteCount) {
    const digest = sha256(utf8(`${cityId}:layout:${stream}:${index.toString()}`));
    let n = 0n;
    let i = 0n;
    while (i < byteCount) {
        const b = digest[Number(i)] ?? 0;
        n = (n << byteCount) | BigInt(b);
        i += 1n;
    }
    return n;
}
export function isMotionUnit(id) {
    return id === "vehicle" || id === "drone";
}
export function isBackgroundUnit(id) {
    return isMotionUnit(id) || id.startsWith("walker_");
}
/** Heading from sidewalk/road neighbours. East/south keep the skin; west/north use `_w`. */
export function walkerFacing(map, tx, ty) {
    const n = isWalkCell(map, tx, ty - 1n);
    const s = isWalkCell(map, tx, ty + 1n);
    const e = isWalkCell(map, tx + 1n, ty);
    const w = isWalkCell(map, tx - 1n, ty);
    const ns = n || s;
    const ew = e || w;
    const odd = (tx + ty) % (1n + 1n) === 1n;
    if (ew && !ns)
        return odd ? "w" : "e";
    if (ns && !ew)
        return odd ? "n" : "s";
    if (ew)
        return odd ? "w" : "e";
    return "e";
}
export function walkerSpriteId(base, facing) {
    if (facing === "w" || facing === "n")
        return `${base}_w`;
    return base;
}
function isWalkCell(map, x, y) {
    const ch = cellAt(map, x, y);
    return ch === "s" || ch === "r" || ch === "c";
}
export function cityMinutes(cityTime, minutesPerHour) {
    return cityTime * minutesPerHour;
}
export function atlasFrame(cityTime, period, frames) {
    if (frames <= 0n)
        return 0n;
    const step = period <= 0n ? cityTime : cityTime / period;
    const mod = step % frames;
    if (mod < 0n)
        return mod + frames;
    return mod;
}
function pickId(ids, frame) {
    if (ids.length === 0)
        return "";
    const n = BigInt(ids.length);
    let i = frame % n;
    if (i < 0n)
        i += n;
    return ids[Number(i)] ?? "";
}
export function smokeSpriteId(frame) {
    return pickId(["smoke", "smoke_02", "smoke_03", "smoke_04", "smoke_05", "smoke_06"], frame);
}
export function turbineSpriteId(frame) {
    return pickId([
        "turbine_blade_0",
        "turbine_blade_1",
        "turbine_blade_2",
        "turbine_blade_3",
        "turbine_blade_4",
        "turbine_blade_5",
        "turbine_blade_6",
        "turbine_blade_7",
    ], frame);
}
export function flagSpriteId(frame) {
    return pickId(["flag_0", "flag_1", "flag_2", "flag_3"], frame);
}
export function billboardSpriteId(frame) {
    return pickId(["billboard_0", "billboard_1", "billboard_2", "billboard_3"], frame);
}
export function waterfallSpriteId(frame) {
    return pickId(["waterfall_0", "waterfall_1", "waterfall_2", "waterfall_3"], frame);
}
export function shoreWaveSpriteId(frame) {
    return pickId(["shore_wave_0", "shore_wave_1", "shore_wave_2", "shore_wave_3"], frame);
}
export function droneBobSpriteId(frame) {
    return pickId(["drone_bob_0", "drone_bob_1", "drone_bob_2", "drone_bob_3"], frame);
}
/** Heading from the last road step (TZ_ART §4.5). +x east, +y south. */
export function vehicleDirSprite(dx, dy) {
    if (dx > 0n)
        return "vehicle_dir_e";
    if (dx < 0n)
        return "vehicle_dir_w";
    if (dy > 0n)
        return "vehicle_dir_s";
    if (dy < 0n)
        return "vehicle_dir_n";
    return "vehicle";
}
function cardinals() {
    const one = 1n;
    return [
        { dx: one, dy: 0n },
        { dx: -one, dy: 0n },
        { dx: 0n, dy: one },
        { dx: 0n, dy: -one },
    ];
}
export function roadDirs(map, x, y, prev) {
    const all = [];
    for (const d of cardinals()) {
        if (isRoadCell(map, x + d.dx, y + d.dy))
            all.push(d);
    }
    if (all.length === 0)
        return all;
    const reverse = [];
    const forward = [];
    for (const d of all) {
        if (d.dx === -prev.dx && d.dy === -prev.dy)
            reverse.push(d);
        else
            forward.push(d);
    }
    if (forward.length > 0)
        return forward;
    return reverse;
}
function pickDir(cityId, index, step, stride, byteCount, dirs) {
    if (dirs.length === 0)
        return undefined;
    const n = BigInt(dirs.length);
    const slot = worldPrng(cityId, "vehicle", index * stride + step, byteCount) % n;
    return dirs[Number(slot)];
}
function stepOnce(map, x, y, prev, cityId, index, step, stride, byteCount) {
    const dirs = roadDirs(map, x, y, prev);
    const d = pickDir(cityId, index, step, stride, byteCount, dirs);
    if (d === undefined)
        return { x, y, prev };
    const nx = x + d.dx;
    const ny = y + d.dy;
    if (!isRoadCell(map, nx, ny))
        return { x, y, prev };
    return { x: nx, y: ny, prev: d };
}
/**
 * Vehicle tile from city_time. Speed is tiles per city minute (TZ_RENDER §8.1).
 * frac is the leftover city minutes in the current tile.
 */
export function vehiclePose(map, start, index, cityTime, minutesPerHour, speed, stride, byteCount, cityId) {
    const onRoad = isRoadCell(map, start.x, start.y);
    if (!onRoad || speed < 0n) {
        return {
            tileX: start.x,
            tileY: start.y,
            nextX: start.x,
            nextY: start.y,
            fracNum: 0n,
            fracDen: 1n,
            onRoad,
            dx: 0n,
            dy: 0n,
        };
    }
    const den = minutesPerHour <= 0n ? 1n : minutesPerHour;
    const raw = cityMinutes(cityTime, den) * speed;
    const tiles = raw / den;
    const fracNum = raw % den;
    let x = start.x;
    let y = start.y;
    let prev = { dx: 0n, dy: 0n };
    let step = 0n;
    while (step < tiles) {
        const nxt = stepOnce(map, x, y, prev, cityId, index, step, stride, byteCount);
        x = nxt.x;
        y = nxt.y;
        prev = nxt.prev;
        step += 1n;
    }
    const look = stepOnce(map, x, y, prev, cityId, index, step, stride, byteCount);
    const moving = prev.dx !== 0n || prev.dy !== 0n;
    return {
        tileX: x,
        tileY: y,
        nextX: look.x,
        nextY: look.y,
        fracNum,
        fracDen: den,
        onRoad: isRoadCell(map, x, y),
        dx: moving ? prev.dx : look.prev.dx,
        dy: moving ? prev.dy : look.prev.dy,
    };
}
export function lerpIso(a, b, num, den) {
    if (den <= 0n)
        return a;
    return {
        x: a.x + ((b.x - a.x) * num) / den,
        y: a.y + ((b.y - a.y) * num) / den,
    };
}
export function vehicleWorldPos(pose, tileW) {
    const a = tileCenter(pose.tileX, pose.tileY, tileW);
    const b = tileCenter(pose.nextX, pose.nextY, tileW);
    return lerpIso(a, b, pose.fracNum, pose.fracDen);
}
function perimeterLen(block) {
    const w = block.east - block.west;
    const h = block.south - block.north;
    if (w < 0n || h < 0n)
        return 0n;
    const two = 1n + 1n;
    return (w + h) * two;
}
function perimeterAt(block, dist) {
    const w = block.east - block.west;
    const h = block.south - block.north;
    const two = 1n + 1n;
    const len = (w + h) * two;
    if (len <= 0n)
        return { x: block.west, y: block.north };
    let t = dist % len;
    if (t < 0n)
        t += len;
    if (t <= w)
        return { x: block.west + t, y: block.north };
    t -= w;
    if (t <= h)
        return { x: block.east, y: block.north + t };
    t -= h;
    if (t <= w)
        return { x: block.east - t, y: block.south };
    t -= w;
    return { x: block.west, y: block.south - t };
}
function triangleBob(minutes, period, amp) {
    if (period <= 0n)
        return 0n;
    const cycle = period + period;
    let phase = minutes % cycle;
    if (phase < 0n)
        phase += cycle;
    const two = 1n + 1n;
    if (phase < period)
        return (phase * amp) / period - amp / two;
    return ((cycle - phase) * amp) / period - amp / two;
}
export function dronePose(start, block, cityTime, minutesPerHour, speed, altPx, bobPx, bobPeriod) {
    const den = minutesPerHour <= 0n ? 1n : minutesPerHour;
    const minutes = cityMinutes(cityTime, den);
    const bob = triangleBob(minutes, bobPeriod, bobPx);
    const altitude = altPx + bob;
    if (block === undefined || speed < 0n) {
        return {
            tileX: start.x,
            tileY: start.y,
            nextX: start.x,
            nextY: start.y,
            fracNum: 0n,
            fracDen: 1n,
            altitude,
        };
    }
    const len = perimeterLen(block);
    if (len <= 0n) {
        return {
            tileX: start.x,
            tileY: start.y,
            nextX: start.x,
            nextY: start.y,
            fracNum: 0n,
            fracDen: 1n,
            altitude,
        };
    }
    const raw = minutes * speed;
    const dist = raw / den;
    const fracNum = raw % den;
    const cur = perimeterAt(block, dist);
    const nxt = perimeterAt(block, dist + 1n);
    return {
        tileX: cur.x,
        tileY: cur.y,
        nextX: nxt.x,
        nextY: nxt.y,
        fracNum,
        fracDen: den,
        altitude,
    };
}
export function droneWorldPos(pose, tileW) {
    const a = tileCenter(pose.tileX, pose.tileY, tileW);
    const b = tileCenter(pose.nextX, pose.nextY, tileW);
    const p = lerpIso(a, b, pose.fracNum, pose.fracDen);
    return { x: p.x, y: p.y - pose.altitude };
}
export function droneShadowPos(pose, tileW) {
    const a = tileCenter(pose.tileX, pose.tileY, tileW);
    const b = tileCenter(pose.nextX, pose.nextY, tileW);
    return lerpIso(a, b, pose.fracNum, pose.fracDen);
}
export function shadowAlphaBps(altitude, baseAlt, gradeBps) {
    if (baseAlt <= 0n || gradeBps <= 0n)
        return 0n;
    if (altitude <= 0n)
        return gradeBps;
    const num = baseAlt * gradeBps;
    const den = altitude;
    const out = num / den;
    if (out > gradeBps)
        return gradeBps;
    return out;
}
export function birdVisible(cityTime, ticksDay, birdsPerDay) {
    if (birdsPerDay <= 0n || ticksDay <= 0n)
        return false;
    const hour = cityTime % ticksDay;
    return hour * birdsPerDay < ticksDay;
}

import { snapZoomIndex } from "./camera.js";
export function isTap(moved, tapMax) {
    return moved <= tapMax;
}
export function isPan(moved, deadzone) {
    return moved > deadzone;
}
export function isDoubleTap(nowMs, lastMs, windowMs) {
    if (lastMs < 0n)
        return false;
    if (nowMs < lastMs)
        return false;
    return nowMs - lastMs <= windowMs;
}
/** +1 zoom in, −1 zoom out, 0 hold. Distances in screen px; step and bps from the pack. */
export function pinchZoomDir(prevDist, dist, stepBps, bps) {
    if (prevDist <= 0n || bps <= 0n)
        return 0n;
    const delta = dist > prevDist ? dist - prevDist : prevDist - dist;
    if (delta * bps < stepBps * prevDist)
        return 0n;
    return dist > prevDist ? 1n : 0n - 1n;
}
export function keyPanDir(key) {
    switch (key) {
        case "ArrowLeft":
        case "a":
        case "A":
            return { dx: 0n - 1n, dy: 0n };
        case "ArrowRight":
        case "d":
        case "D":
            return { dx: 1n, dy: 0n };
        case "ArrowUp":
        case "w":
        case "W":
            return { dx: 0n, dy: 0n - 1n };
        case "ArrowDown":
        case "s":
        case "S":
            return { dx: 0n, dy: 1n };
        default:
            return { dx: 0n, dy: 0n };
    }
}
export function keyZoomDir(key) {
    switch (key) {
        case "+":
        case "=":
            return 1n;
        case "-":
        case "_":
            return 0n - 1n;
        default:
            return 0n;
    }
}
export function applyKeyZoom(index, key, count) {
    return snapZoomIndex(index + keyZoomDir(key), count);
}

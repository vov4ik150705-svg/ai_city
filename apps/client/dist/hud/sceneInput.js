import { clampCamera, isDoubleTap, isPan, isTap, keyPanDir, keyZoomDir, lookAtZone, pinchZoomDir, routeSceneClick, stepZoomIndex, tileCenter, tileFromWorld, zoomAt, } from "@corporator/render";
export function startCam(camera) {
    const core = camera.centroids["core"];
    const start = core === undefined
        ? clampCamera(0n, 0n, camera.bounds)
        : clampCamera(core.x, core.y, camera.bounds);
    return { tileX: start.x, tileY: start.y, zoomIndex: 0n, accX: 0n, accY: 0n };
}
export function applyCam(handle, cam, camera) {
    const lv = zoomAt(camera.levels, cam.zoomIndex);
    handle.setCamera(cam.tileX, cam.tileY, lv.num, lv.den);
}
function canvasOf(host) {
    const el = host.querySelector("canvas");
    if (el instanceof HTMLCanvasElement)
        return el;
    return undefined;
}
function localPx(canvas, clientX, clientY) {
    const box = canvas.getBoundingClientRect();
    return {
        x: BigInt(Math.floor(clientX - box.left)),
        y: BigInt(Math.floor(clientY - box.top)),
    };
}
function absBig(n) {
    return n < 0n ? -n : n;
}
export function bindSceneInput(opts) {
    const { host, handle, camera, tileW, gradeBps, opened, wallNowMs, onRoute, cam } = opts;
    applyCam(handle, cam.current, camera);
    let pointerId;
    let startX = 0n;
    let startY = 0n;
    let lastX = 0n;
    let lastY = 0n;
    let lastTapMs = 0n - 1n;
    const pinch = new Map();
    let pinchDist = 0n;
    const pushCam = () => {
        const clamped = clampCamera(cam.current.tileX, cam.current.tileY, camera.bounds);
        cam.current.tileX = clamped.x;
        cam.current.tileY = clamped.y;
        cam.current.zoomIndex = stepZoomIndex(cam.current.zoomIndex, 0n, BigInt(camera.levels.length));
        applyCam(handle, cam.current, camera);
    };
    const panByWorld = (dx, dy) => {
        cam.current.accX += dx;
        cam.current.accY += dy;
        const c = tileCenter(cam.current.tileX, cam.current.tileY, tileW);
        const t = tileFromWorld(c.x + cam.current.accX, c.y + cam.current.accY, tileW);
        const next = clampCamera(t.tx, t.ty, camera.bounds);
        const nc = tileCenter(next.x, next.y, tileW);
        cam.current.accX = c.x + cam.current.accX - nc.x;
        cam.current.accY = c.y + cam.current.accY - nc.y;
        cam.current.tileX = next.x;
        cam.current.tileY = next.y;
        pushCam();
    };
    const clickAt = (sx, sy) => {
        const hit = handle.hitAt(sx, sy);
        const screen = routeSceneClick(hit, camera.beacons, opened);
        onRoute(screen, hit.objectId, hit.cell, hit.tileX, hit.tileY);
    };
    const onPointerDown = (e) => {
        const canvas = canvasOf(host);
        if (canvas === undefined || e.target !== canvas)
            return;
        canvas.setPointerCapture(e.pointerId);
        const p = localPx(canvas, e.clientX, e.clientY);
        pinch.set(e.pointerId, p);
        if (pinch.size === 1) {
            pointerId = e.pointerId;
            startX = p.x;
            startY = p.y;
            lastX = p.x;
            lastY = p.y;
        }
        else if (pinch.size === 1 + 1) {
            pointerId = undefined;
            const pts = [...pinch.values()];
            const a = pts[0];
            const b = pts[1];
            if (a !== undefined && b !== undefined) {
                pinchDist = absBig(a.x - b.x) + absBig(a.y - b.y);
            }
        }
    };
    const onPointerMove = (e) => {
        const canvas = canvasOf(host);
        if (canvas === undefined)
            return;
        if (!pinch.has(e.pointerId))
            return;
        const p = localPx(canvas, e.clientX, e.clientY);
        pinch.set(e.pointerId, p);
        if (pinch.size === 1 + 1) {
            const pts = [...pinch.values()];
            const a = pts[0];
            const b = pts[1];
            if (a === undefined || b === undefined)
                return;
            const dist = absBig(a.x - b.x) + absBig(a.y - b.y);
            const prev = pinchDist <= 0n ? 1n : pinchDist;
            const dir = pinchZoomDir(prev, dist, camera.pinchStepBps, gradeBps);
            if (dir !== 0n) {
                cam.current.zoomIndex = stepZoomIndex(cam.current.zoomIndex, dir, BigInt(camera.levels.length));
                pinchDist = dist;
                pushCam();
            }
            return;
        }
        if (pointerId !== e.pointerId)
            return;
        const movedX = p.x - lastX;
        const movedY = p.y - lastY;
        lastX = p.x;
        lastY = p.y;
        const total = absBig(p.x - startX) + absBig(p.y - startY);
        if (!isPan(total, camera.panDeadzonePx))
            return;
        const lv = zoomAt(camera.levels, cam.current.zoomIndex);
        const den = lv.den === 0n ? 1n : lv.den;
        const num = lv.num === 0n ? 1n : lv.num;
        panByWorld((-movedX * den) / num, (-movedY * den) / num);
    };
    const onPointerUp = (e) => {
        const canvas = canvasOf(host);
        pinch.delete(e.pointerId);
        if (canvas === undefined)
            return;
        if (e.target === canvas && pointerId === e.pointerId) {
            const p = localPx(canvas, e.clientX, e.clientY);
            const total = absBig(p.x - startX) + absBig(p.y - startY);
            if (isTap(total, camera.tapMaxMovePx)) {
                const now = wallNowMs();
                if (isDoubleTap(now, lastTapMs, camera.doubleTapMs)) {
                    cam.current.zoomIndex = stepZoomIndex(cam.current.zoomIndex, 1n, BigInt(camera.levels.length));
                    const hit = handle.hitAt(p.x, p.y);
                    const next = clampCamera(hit.tileX, hit.tileY, camera.bounds);
                    cam.current.tileX = next.x;
                    cam.current.tileY = next.y;
                    lastTapMs = 0n - 1n;
                    pushCam();
                }
                else {
                    lastTapMs = now;
                    clickAt(p.x, p.y);
                }
            }
        }
        pointerId = undefined;
        pinchDist = 0n;
    };
    const onWheel = (e) => {
        const canvas = canvasOf(host);
        if (canvas === undefined || e.target !== canvas)
            return;
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1n : 0n - 1n;
        const p = localPx(canvas, e.clientX, e.clientY);
        const hit = handle.hitAt(p.x, p.y);
        cam.current.zoomIndex = stepZoomIndex(cam.current.zoomIndex, dir, BigInt(camera.levels.length));
        const next = clampCamera(hit.tileX, hit.tileY, camera.bounds);
        cam.current.tileX = next.x;
        cam.current.tileY = next.y;
        pushCam();
    };
    const onKey = (e) => {
        if (e.key === "Escape") {
            onRoute("", "", "", 0n, 0n);
            return;
        }
        const pan = keyPanDir(e.key);
        if (pan.dx !== 0n || pan.dy !== 0n) {
            const next = clampCamera(cam.current.tileX + pan.dx, cam.current.tileY + pan.dy, camera.bounds);
            cam.current.tileX = next.x;
            cam.current.tileY = next.y;
            pushCam();
            return;
        }
        const z = keyZoomDir(e.key);
        if (z !== 0n) {
            cam.current.zoomIndex = stepZoomIndex(cam.current.zoomIndex, z, BigInt(camera.levels.length));
            pushCam();
        }
    };
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerUp);
    host.addEventListener("pointercancel", onPointerUp);
    host.addEventListener("wheel", onWheel, { passive: false });
    host.tabIndex = 0;
    host.addEventListener("keydown", onKey);
    return () => {
        host.removeEventListener("pointerdown", onPointerDown);
        host.removeEventListener("pointermove", onPointerMove);
        host.removeEventListener("pointerup", onPointerUp);
        host.removeEventListener("pointercancel", onPointerUp);
        host.removeEventListener("wheel", onWheel);
        host.removeEventListener("keydown", onKey);
    };
}
export function lookCam(camera, districtId, cam) {
    const at = lookAtZone(districtId, camera.centroids, camera.bounds);
    return { ...cam, tileX: at.x, tileY: at.y, accX: 0n, accY: 0n };
}

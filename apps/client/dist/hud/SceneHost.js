import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
import { codes } from "@corporator/protocol";
import { gpuCode, probeCanvas } from "@corporator/render";
import { mountIsland, } from "@corporator/render/pixi";
import { wallNowMs } from "../clock.js";
import { hexRgb01, hexToPixi, rampHex } from "../palette.js";
import { applyCam, bindSceneInput, lookCam, startCam } from "./sceneInput.js";
const ATLAS_PNG = new URL("../../../../content/out/atlas/city.png", import.meta.url).href;
const ATLAS_GLOW = new URL("../../../../content/out/atlas/city_glow.png", import.meta.url).href;
const ATLAS_SNAP = new URL("../../../../content/out/atlas/lut_snap.png", import.meta.url).href;
const ATLAS_JSON = new URL("../../../../content/out/atlas/city.json", import.meta.url).href;
const FONT_PNG = new URL("../../../../content/out/atlas/font.png", import.meta.url).href;
const FALLBACK_PNG = new URL("../../../../content/out/atlas/fallback.png", import.meta.url).href;
export function SceneHost(props) {
    const hostRef = useRef(null);
    const handleRef = useRef(undefined);
    const camRef = useRef(startCam(props.camera));
    const cityTimeRef = useRef(props.cityTime);
    cityTimeRef.current = props.cityTime;
    const routeRef = useRef(props.onSceneRoute);
    routeRef.current = props.onSceneRoute;
    const [code, setCode] = useState("");
    useEffect(() => {
        const host = hostRef.current;
        if (host === null)
            return;
        const canvas = document.createElement("canvas");
        const probe = probeCanvas(canvas);
        const refused = gpuCode(probe);
        if (refused.length > 0) {
            setCode(refused);
            return;
        }
        let alive = true;
        let unbind;
        void (async () => {
            const [img, glow, snapLut, man, fontImg] = await Promise.all([
                loadAtlasImage(ATLAS_PNG),
                loadAtlasImage(ATLAS_GLOW),
                loadOptionalImage(ATLAS_SNAP),
                loadAtlasManifest(ATLAS_JSON),
                loadOptionalImage(FONT_PNG),
            ]);
            if (!alive)
                return;
            const bg = hexToPixi(rampHex(props.palette, "navy", 0n));
            const shadow = hexToPixi(rampHex(props.palette, "navy", 0n));
            const tints = {};
            for (const row of props.light.phases) {
                tints[row.name] = hexRgb01(rampHex(props.palette, row.tintRamp, 0n));
            }
            const mounted = await mountIsland({
                host,
                scene: props.scene,
                sprites: props.groundSprites,
                frames: man.frames,
                atlas: img,
                tileW: props.tileW,
                cubeH: props.cubeH,
                chunkTiles: props.chunkTiles,
                waterFrames: props.waterFrames,
                waterSteps: props.waterSteps,
                waterStrip: props.waterStrip,
                roadAutotile: props.roadAutotile,
                sidewalkAutotile: props.sidewalkAutotile,
                shadowOffset: props.shadowOffset,
                shallowId: man.shallow,
                deepId: man.deep,
                dirtId: props.cubeDirt,
                cliffId: props.cubeCliff,
                rockId: props.cubeRock,
                lotPadId: props.lotPad,
                lotPadSkip: props.lotPadSkip,
                cityTime: cityTimeRef.current,
                background: bg,
                zoomNum: props.zoomMinNum,
                zoomDen: props.zoomMinDen,
                shadowTint: shadow,
                probe,
                pipStep: props.pipStep,
                pipOffset: props.pipOffset,
                pulsePeriod: props.pulsePeriod,
                hoverOutlinePx: props.hoverOutlinePx,
                hoverTint: hexToPixi(rampHex(props.palette, "highlight", 0n)),
                selectLift: props.selectLift,
                contactAlphaBps: props.contactShadowAlphaBps,
                contactInsetBps: props.contactShadowInsetBps,
                labelMinZoomNum: props.labelMinZoomNum,
                labelMinZoomDen: props.labelMinZoomDen,
                overlays: props.overlays,
                badges: props.badges,
                energy: props.energy,
                compute: props.compute,
                levels: {},
                hoverId: "",
                selectedId: "",
                glowAtlas: glow,
                snapLut: snapLut,
                snapLutSide: props.snapLutSide,
                phases: props.light.phases,
                blendMinutes: props.light.blendMinutes,
                minutesPerHour: props.light.minutesPerHour,
                ticksDay: props.ticksDay,
                emissiveBps: props.light.emissiveBps,
                gradeBps: props.light.gradeBps,
                tints,
                lampTint: hexToPixi(rampHex(props.palette, "amber", 0n)),
                motion: props.motion,
                labels: props.labels,
                tickers: props.tickers,
                glyphs: man.glyphs,
                fontAtlas: fontImg,
            });
            if (!alive) {
                mounted.destroy();
                return;
            }
            handleRef.current = mounted;
            mounted.setCityTime(cityTimeRef.current);
            if (!alive) {
                mounted.destroy();
                handleRef.current = undefined;
                return;
            }
            applyCam(mounted, camRef.current, props.camera);
            unbind = bindSceneInput({
                host,
                handle: mounted,
                camera: props.camera,
                tileW: props.tileW,
                gradeBps: props.light.gradeBps,
                opened: props.opened,
                wallNowMs,
                onRoute: (screen, objectId, cell, tileX, tileY) => {
                    routeRef.current(screen, objectId, cell, tileX, tileY);
                },
                cam: camRef,
            });
            if (mounted.code.length > 0)
                setCode(mounted.code);
        })();
        return () => {
            alive = false;
            if (unbind !== undefined)
                unbind();
            if (handleRef.current !== undefined) {
                handleRef.current.destroy();
                handleRef.current = undefined;
            }
        };
    }, [
        props.scene,
        props.palette,
        props.tileW,
        props.cubeH,
        props.chunkTiles,
        props.waterFrames,
        props.waterSteps,
        props.waterStrip,
        props.roadAutotile,
        props.sidewalkAutotile,
        props.shadowOffset,
        props.groundSprites,
        props.cubeDirt,
        props.cubeCliff,
        props.cubeRock,
        props.snapLutSide,
        props.lotPad,
        props.lotPadSkip,
        props.zoomMinNum,
        props.zoomMinDen,
        props.pipStep,
        props.pipOffset,
        props.pulsePeriod,
        props.hoverOutlinePx,
        props.selectLift,
        props.contactShadowAlphaBps,
        props.contactShadowInsetBps,
        props.labelMinZoomNum,
        props.labelMinZoomDen,
        props.overlays,
        props.badges,
        props.energy,
        props.compute,
        props.ticksDay,
        props.light,
        props.camera,
        props.motion,
        props.opened,
        props.labels,
        props.tickers,
    ]);
    useEffect(() => {
        if (props.lookId.length === 0)
            return;
        camRef.current = lookCam(props.camera, props.lookId, camRef.current);
        const handle = handleRef.current;
        if (handle !== undefined)
            applyCam(handle, camRef.current, props.camera);
    }, [props.lookId, props.lookRev, props.camera, props.tileW]);
    useEffect(() => {
        const handle = handleRef.current;
        if (handle === undefined)
            return;
        handle.setCityTime(props.cityTime);
    }, [props.cityTime]);
    return (_jsx("div", { ref: hostRef, "data-surface": "scene", className: "hud-scene", style: { position: "absolute", inset: 0 }, children: code.length > 0 ? (_jsxs("div", { "data-code": codes.RENDER_NO_GPU, "data-key": codes.RENDER_NO_GPU, children: [_jsx("img", { src: FALLBACK_PNG, alt: "", style: { width: "100%", height: "100%", objectFit: "contain" } }), _jsx("span", { children: props.noGpuText })] })) : null }));
}
function loadAtlasImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(codes.RENDER_NO_GPU));
        img.src = url;
    });
}
function loadOptionalImage(url) {
    return loadAtlasImage(url).catch(() => undefined);
}
function loadAtlasManifest(url) {
    return fetch(url)
        .then((res) => res.json())
        .then((raw) => parseManifest(raw));
}
function parseGlyphs(raw) {
    const out = {};
    if (raw === null || typeof raw !== "object" || Array.isArray(raw))
        return out;
    const row = raw;
    const metrics = row["metrics"];
    if (metrics === null || typeof metrics !== "object" || Array.isArray(metrics))
        return out;
    const obj = metrics;
    for (const ch of Object.keys(obj)) {
        const g = obj[ch];
        if (g === null || typeof g !== "object" || Array.isArray(g))
            continue;
        const f = g;
        out[ch] = {
            x: asInt(f["x"]),
            y: asInt(f["y"]),
            w: asInt(f["w"]),
            h: asInt(f["h"]),
            advance: asInt(f["advance"]),
        };
    }
    return out;
}
function parseManifest(raw) {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
        return { frames: {}, shallow: "water_tile", deep: "water_tile", glyphs: {} };
    }
    const row = raw;
    const framesIn = row["frames"];
    const frames = {};
    if (framesIn !== null && typeof framesIn === "object" && !Array.isArray(framesIn)) {
        const obj = framesIn;
        for (const id of Object.keys(obj)) {
            const fr = obj[id];
            if (fr === null || typeof fr !== "object" || Array.isArray(fr))
                continue;
            const f = fr;
            const fa = pair(f["foot_anchor"]);
            const fp = pair(f["footprint"]);
            const w = asInt(f["w"]);
            const h = asInt(f["h"]);
            const two = 1n + 1n;
            frames[id] = {
                x: asInt(f["x"]),
                y: asInt(f["y"]),
                w,
                h,
                footX: fa.a === 0n && fa.b === 0n ? w / two : fa.a,
                footY: fa.a === 0n && fa.b === 0n ? h : fa.b,
                cols: fp.a > 0n ? fp.a : 1n,
                rows: fp.b > 0n ? fp.b : 1n,
                kind: typeof f["kind"] === "string" ? f["kind"] : "",
            };
        }
    }
    const water = row["water"];
    let shallow = "water_tile";
    let deep = "water_tile";
    if (water !== null && typeof water === "object" && !Array.isArray(water)) {
        const w = water;
        if (typeof w["shallow"] === "string")
            shallow = w["shallow"];
        if (typeof w["deep"] === "string")
            deep = w["deep"];
    }
    return { frames, shallow, deep, glyphs: parseGlyphs(row["glyphs"]) };
}
function asInt(value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number" && Number.isInteger(value))
        return BigInt(value);
    return 0n;
}
function pair(value) {
    const two = 1 + 1;
    if (!Array.isArray(value) || value.length < two)
        return { a: 0n, b: 0n };
    return { a: asInt(value[0]), b: asInt(value[1]) };
}

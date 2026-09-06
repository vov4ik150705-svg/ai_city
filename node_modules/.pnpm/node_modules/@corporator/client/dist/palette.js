export function parsePalette(text) {
    const ramps = {};
    let cur = "outline";
    ramps[cur] = [];
    const lines = text.split("\n");
    for (const line of lines) {
        const t = line.trim();
        if (t.startsWith(";=")) {
            cur = t.slice(2).trim();
            if (ramps[cur] === undefined)
                ramps[cur] = [];
            continue;
        }
        if (t.startsWith(";") || t === "")
            continue;
        const bucket = ramps[cur];
        if (bucket === undefined)
            continue;
        bucket.push(t.toLowerCase());
    }
    return { ramps };
}
export function rampHex(pal, ramp, index) {
    const xs = pal.ramps[ramp];
    if (xs === undefined || xs.length === 0) {
        const outline = pal.ramps["outline"];
        const first = outline === undefined ? undefined : outline[0];
        return first ?? "000000";
    }
    const i = Number(index);
    if (i < 0) {
        const first = xs[0];
        return first ?? "000000";
    }
    const hit = xs[i];
    if (hit !== undefined)
        return hit;
    const last = xs[xs.length - 1];
    return last ?? "000000";
}
/** HUD.md §7 tokens from the same ramps as sprites. Indices are ramp positions, not pack rates. */
export function hudCssVars(pal) {
    const hex = (ramp, index) => `#${rampHex(pal, ramp, index)}`;
    return {
        "--bg-panel": hex("navy", 0n),
        "--bg-panel-hi": hex("navy", 1n),
        "--stroke": hex("navy", 3n),
        "--text": hex("concrete", 6n),
        "--text-dim": hex("concrete", 3n),
        "--accent-ai": hex("green", 2n),
        "--accent-energy": hex("crimson", 3n),
        "--accent-logi": hex("amber", 3n),
        "--accent-cons": hex("highlight", 0n),
        "--accent-auto": hex("navy", 4n),
        "--accent-fin": hex("blue", 3n),
        "--good": hex("green", 3n),
        "--bad": hex("crimson", 4n),
        "--warn": hex("amber", 4n),
    };
}
export function hexToPixi(hex) {
    const h = hex.startsWith("#") ? hex.slice(1) : hex;
    const n = Number.parseInt(h, 16);
    if (Number.isNaN(n))
        return 0;
    return n;
}
export function hexRgb01(hex) {
    const n = hexToPixi(hex);
    const byte = 255;
    return {
        r: ((n >> 16) & byte) / byte,
        g: ((n >> 8) & byte) / byte,
        b: (n & byte) / byte,
    };
}

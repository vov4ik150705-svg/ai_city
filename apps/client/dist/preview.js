function freezeDeep(value) {
    if (value === null || typeof value !== "object")
        return value;
    if (Array.isArray(value)) {
        const xs = [];
        for (const item of value)
            xs.push(freezeDeep(item));
        return Object.freeze(xs);
    }
    const src = value;
    const out = {};
    for (const key of Object.keys(src)) {
        out[key] = freezeDeep(src[key]);
    }
    return Object.freeze(out);
}
/** Readonly projection. Does not run the tick. HUD.md §8; arch.packages.client.preview_only. */
export function preview(state) {
    return freezeDeep(state);
}

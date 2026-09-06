import { codes } from "@corporator/protocol";
import { asObj, asText } from "./values.js";
function loadMap(value) {
    const obj = asObj(value);
    const out = {};
    for (const key of Object.keys(obj)) {
        out[key] = asText(obj[key]);
    }
    return out;
}
/** `strings` = codes; `ui` = chrome labels. L146; content/strings/ru.json. */
export function loadStringTable(root) {
    const row = asObj(root);
    const out = loadMap(row["strings"]);
    if (row["ui"] !== undefined) {
        const ui = loadMap(row["ui"]);
        for (const key of Object.keys(ui)) {
            const text = ui[key];
            if (text === undefined)
                continue;
            out[key] = text;
        }
    }
    return out;
}
export function lookup(table, key, used) {
    used.add(key);
    const text = table[key];
    if (text === undefined)
        throw new Error(codes.API_MALFORMED);
    return text;
}
export function format(template, slots) {
    return template.replace(/\{([a-z_]+)\}/g, (whole, name) => {
        const v = slots[name];
        if (v === undefined)
            return whole;
        return v;
    });
}
export function labelKey(label) {
    if (label.startsWith("UI_"))
        return label;
    return `UI_${label}`;
}

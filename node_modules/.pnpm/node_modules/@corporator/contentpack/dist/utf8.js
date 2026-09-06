/**
 * UTF-8 encode/decode without TextEncoder (contentpack tsconfig types: []).
 * Crypto-adjacent constants, not pack params. Duplicate of engine utf8: contentpack
 * cannot import engine (arch.packages.allowed_deps). docs/ARCHITECTURE.md §2.
 */
export function utf8(text) {
    const bytes = [];
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        if (cp === undefined)
            continue;
        if (cp <= 0x7f) {
            bytes.push(cp);
        }
        else if (cp <= 0x7ff) {
            bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
        }
        else if (cp <= 0xffff) {
            bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        }
        else {
            bytes.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
        }
    }
    return new Uint8Array(bytes);
}
export function fromUtf8(data) {
    let i = 0;
    let out = "";
    while (i < data.length) {
        const b0 = data[i] ?? 0;
        i += 1;
        if (b0 <= 0x7f) {
            out += String.fromCodePoint(b0);
            continue;
        }
        if (b0 >= 0xc2 && b0 <= 0xdf) {
            const b1 = data[i] ?? 0;
            i += 1;
            out += String.fromCodePoint(((b0 & 0x1f) << 6) | (b1 & 0x3f));
            continue;
        }
        if (b0 >= 0xe0 && b0 <= 0xef) {
            const b1 = data[i] ?? 0;
            const b2 = data[i + 1] ?? 0;
            i += 2;
            out += String.fromCodePoint(((b0 & 0x0f) << 12) | ((b1 & 0x3f) << 6) | (b2 & 0x3f));
            continue;
        }
        const b1 = data[i] ?? 0;
        const b2 = data[i + 1] ?? 0;
        const b3 = data[i + 2] ?? 0;
        i += 3;
        out += String.fromCodePoint(((b0 & 0x07) << 18) | ((b1 & 0x3f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    }
    return out;
}

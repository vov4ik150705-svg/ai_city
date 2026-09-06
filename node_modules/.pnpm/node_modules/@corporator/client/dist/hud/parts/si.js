export function formatSi(value, siMin, siBase) {
    if (siBase <= 1n)
        return value.toString();
    const neg = value < 0n;
    const v = neg ? -value : value;
    if (v < siMin) {
        const s = v.toString();
        return neg ? `-${s}` : s;
    }
    const two = 1n + 1n;
    const ten = two * (1n + 1n + 1n + 1n + 1n);
    const suffixes = ["k", "M", "G", "T"];
    let exp = 0;
    let unit = siBase;
    while (exp + 1 < suffixes.length && v >= unit * siBase) {
        unit *= siBase;
        exp += 1;
    }
    const suffix = suffixes[exp] ?? "T";
    const sig = 1n + 1n + 1n;
    const intPart = v / unit;
    let mag = 1n;
    let digits = 1n;
    while (intPart >= mag * ten) {
        mag *= ten;
        digits += 1n;
    }
    if (digits >= sig) {
        let drop = 1n;
        let d = digits - sig;
        while (d > 0n) {
            drop *= ten;
            d -= 1n;
        }
        const rounded = ((intPart + drop / two) / drop) * drop;
        const body = rounded.toString();
        return neg ? `-${body}${suffix}` : `${body}${suffix}`;
    }
    const fracDigits = sig - digits;
    let fracScale = 1n;
    let f = 0n;
    while (f < fracDigits) {
        fracScale *= ten;
        f += 1n;
    }
    const scaled = (v * fracScale + unit / two) / unit;
    const whole = scaled / fracScale;
    let frac = (scaled % fracScale).toString();
    const width = Number(fracDigits);
    while (frac.length < width)
        frac = `0${frac}`;
    const body = `${whole.toString()}.${frac}`;
    return neg ? `-${body}${suffix}` : `${body}${suffix}`;
}

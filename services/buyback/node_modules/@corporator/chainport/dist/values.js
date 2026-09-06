export function silentTransport() {
    return {
        async call() {
            return { status: "silence" };
        },
    };
}
export function isPortKind(kind) {
    return kind === "mock" || kind === "rpc";
}
export function ok() {
    return { ok: true };
}
export function err(code) {
    return { ok: false, code };
}
export function amountOk(amount) {
    return { ok: true, amount };
}
export function mapGet(map, id) {
    const v = map.get(id);
    if (v === undefined)
        return 0n;
    return v;
}

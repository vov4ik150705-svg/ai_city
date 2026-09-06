function asRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;
    return value;
}
function noJsonNumber(value) {
    if (typeof value === "number")
        return false;
    if (value === null || typeof value !== "object")
        return true;
    if (Array.isArray(value)) {
        for (const item of value) {
            if (!noJsonNumber(item))
                return false;
        }
        return true;
    }
    const rec = value;
    for (const key of Object.keys(rec)) {
        if (!noJsonNumber(rec[key]))
            return false;
    }
    return true;
}
export function fetchPoster(url, timeoutMs) {
    return async (body) => {
        const ac = new AbortController();
        const timer = setTimeout(() => {
            ac.abort();
        }, Number(timeoutMs));
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body,
                signal: ac.signal,
            });
            if (!res.ok)
                return undefined;
            return await res.text();
        }
        catch {
            return undefined;
        }
        finally {
            clearTimeout(timer);
        }
    };
}
export async function postEth(post, method, params) {
    const payload = JSON.stringify({ jsonrpc: "2.0", id: "0", method, params });
    let reply;
    try {
        reply = await post(payload);
    }
    catch {
        return { status: "silence" };
    }
    if (reply === undefined || reply.length === 0)
        return { status: "silence" };
    let parsed;
    try {
        parsed = JSON.parse(reply);
    }
    catch {
        return { status: "lie", body: reply };
    }
    if (!noJsonNumber(parsed))
        return { status: "silence" };
    const row = asRecord(parsed);
    if (row === undefined)
        return { status: "lie", body: reply };
    if (row["error"] !== undefined)
        return { status: "silence" };
    const result = row["result"];
    if (typeof result === "string")
        return { status: "ok", body: result };
    if (result === true)
        return { status: "ok", body: "0x" };
    if (result === undefined)
        return { status: "silence" };
    return { status: "silence" };
}

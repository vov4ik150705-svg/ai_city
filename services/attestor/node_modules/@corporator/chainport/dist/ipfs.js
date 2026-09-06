import { codes } from "@corporator/protocol";
import { err } from "./values.js";
const PIN_URL = "CORPORATOR_IPFS_PIN_URL";
const PIN_TOKEN = "CORPORATOR_IPFS_PIN_TOKEN";
function pinOk(cidHex) {
    return { ok: true, cidHex };
}
export function createMockIpfs(down) {
    const stored = new Map();
    return {
        kind: "mock",
        async pin(key, bytes) {
            if (down || key.length === 0)
                return err(codes.SERVICE_DEGRADED);
            stored.set(key, bytes);
            return pinOk(key);
        },
    };
}
export function createHttpIpfs(env) {
    const url = env[PIN_URL];
    const token = env[PIN_TOKEN];
    const endpoint = url === undefined ? "" : url;
    const auth = token === undefined ? "" : token;
    return {
        kind: "http",
        async pin(key, bytes) {
            if (endpoint.length === 0 || key.length === 0)
                return err(codes.SERVICE_DEGRADED);
            try {
                const headers = { "content-type": "application/octet-stream" };
                if (auth.length > 0)
                    headers.authorization = auth;
                const res = await fetch(endpoint, { method: "POST", headers, body: bytes });
                if (!res.ok)
                    return err(codes.SERVICE_DEGRADED);
                return pinOk(key);
            }
            catch {
                return err(codes.SERVICE_DEGRADED);
            }
        },
    };
}

import { fromUtf8, parseJson } from "@corporator/contentpack";
import { listenBindOrEnv, listenPorts, readyTemplate } from "@corporator/protocol";
function asRow(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;
    return value;
}
/** POST sealed ticks to the attestor ready socket. Fail-open: throw lets tick_host catch. */
export function remoteAttestor() {
    const bind = listenBindOrEnv(process.env.CORPORATOR_LISTEN_BIND);
    const url = "http://" + bind + ":" + listenPorts.attestor.toString() + readyTemplate;
    return {
        async submit(payload) {
            const res = await fetch(url, { method: "POST", body: payload });
            if (!res.ok)
                return undefined;
            const row = asRow(parseJson(fromUtf8(new Uint8Array(await res.arrayBuffer()))));
            if (row === undefined)
                return undefined;
            const rootHex = row["rootHex"];
            const cidHex = row["cidHex"];
            const badge = row["badge"];
            if (typeof rootHex !== "string" || typeof cidHex !== "string" || typeof badge !== "string")
                return undefined;
            return { rootHex, cidHex, badge };
        },
    };
}

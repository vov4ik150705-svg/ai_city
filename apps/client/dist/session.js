import { assembleSessionMessage, canonical, fromUtf8, parseJson, sessionMessageValues } from "@corporator/contentpack";
import { authNonceTemplate, authSessionTemplate, sessionDomain, sessionMessageFields, sessionHeader, sessionScheme, packHash, } from "@corporator/protocol";
export async function openDemoSession(origin, post) {
    const res = await post(origin + authSessionTemplate, canonical({ account_kind: "demo" }));
    return parseSession(res.body);
}
export async function openWalletSession(args) {
    const nonceRes = await args.post(args.origin + authNonceTemplate, canonical({ address: args.address }));
    const nonceBody = parseObj(nonceRes.body);
    if (nonceBody === undefined)
        return undefined;
    const nonce = asStr(nonceBody["nonce"]);
    const expires = asStr(nonceBody["expires_city_time"]);
    if (nonce.length === 0)
        return undefined;
    const message = assembleSessionMessage(sessionMessageFields, sessionMessageValues({
        domain: sessionDomain,
        address: args.address,
        nonce,
        packHash,
        expiresCityTime: expires,
    }));
    const signature = await args.sign(message);
    const sessionRes = await args.post(args.origin + authSessionTemplate, canonical({ address: args.address, nonce, signature }));
    return parseSession(sessionRes.body);
}
export function authHeaders(sessionId) {
    const out = {};
    out[sessionHeader] = sessionScheme + " " + sessionId;
    return out;
}
function asStr(value) {
    if (typeof value === "string")
        return value;
    if (typeof value === "bigint")
        return value.toString();
    return "";
}
function parseObj(body) {
    const parsed = parseJson(fromUtf8(body));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
        return undefined;
    return parsed;
}
function parseSession(body) {
    const obj = parseObj(body);
    if (obj === undefined)
        return undefined;
    const sessionId = asStr(obj["session_id"]);
    const cityId = asStr(obj["city_id"]);
    const accountKind = asStr(obj["account_kind"]);
    if (sessionId.length === 0 || cityId.length === 0)
        return undefined;
    return { sessionId, cityId, accountKind };
}

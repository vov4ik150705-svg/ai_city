import { randomBytes } from "node:crypto";
import { assembleSessionMessage, fromUtf8, parseJson, sessionMessageValues } from "@corporator/contentpack";
import { spawnCity } from "@corporator/engine";
import { codes } from "@corporator/protocol";
import { cityKind, errResult, okResult } from "./envelope.js";
import {} from "./pack_ctx.js";
import { recoverAddress, normalizeAddress } from "./recover.js";
import { getBytes, putJson } from "./store.js";
import { asBigint, asEngineDict, asObj, asText, jsonToDict, walk } from "./values.js";
function opaqueId() {
    return Buffer.from(randomBytes(16)).toString("hex");
}
function nonceKey(nonce) {
    return "n:" + nonce;
}
function asPayload(bytes) {
    if (bytes === undefined)
        return undefined;
    const parsed = parseJson(fromUtf8(bytes));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))
        return undefined;
    return asObj(parsed);
}
function bearerToken(headers, ctx) {
    const raw = headers[ctx.sessionHeader.toLowerCase()] ?? headers[ctx.sessionHeader] ?? "";
    const prefix = ctx.sessionScheme + " ";
    if (!raw.startsWith(prefix))
        return "";
    return raw.slice(prefix.length);
}
function spawnIntoState(ctx, state, cityId, kind) {
    const spec = jsonToDict(walk(ctx.pack, ["sections", "sim", "archetypes", "minimalist"]));
    const city = spawnCity(ctx.cfg, "minimalist", spec, cityId, 1n, 0n);
    city["account_kind"] = kind;
    city["city_level"] = 1n;
    city["agents"] = [];
    city["buildings"] = [];
    const cities = asEngineDict(state["cities"]);
    cities[cityId] = city;
    state["cities"] = cities;
}
function firstUnownedDemo(state) {
    const cities = asEngineDict(state["cities"]);
    for (const id of Object.keys(cities)) {
        const city = asEngineDict(cities[id]);
        if (asText(city["account_kind"]) !== "demo")
            continue;
        if (asBigint(city["session_bound"]) === 1n)
            continue;
        return id;
    }
    return undefined;
}
export async function handleAuthNonce(ctx, store, state, body) {
    let parsed;
    try {
        parsed = parseJson(fromUtf8(body));
    }
    catch {
        return errResult(ctx, state, codes.API_MALFORMED);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return errResult(ctx, state, codes.API_MALFORMED);
    }
    const obj = asObj(parsed);
    const address = normalizeAddress(asText(obj["address"]));
    if (address.length === 0)
        return errResult(ctx, state, codes.API_MALFORMED);
    const now = asBigint(state["city_time"]);
    const expires = now + ctx.nonceTtlCity;
    const nonce = opaqueId();
    await putJson(store, "sessions", nonceKey(nonce), { kind: "nonce", address, expires_city_time: expires.toString() }, "wallet");
    return okResult(ctx, state, { nonce, expires_city_time: expires });
}
export async function handleAuthSession(ctx, store, state, body) {
    let parsed;
    try {
        parsed = parseJson(fromUtf8(body));
    }
    catch {
        return errResult(ctx, state, codes.API_MALFORMED);
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return errResult(ctx, state, codes.API_MALFORMED);
    }
    const obj = asObj(parsed);
    const kind = asText(obj["account_kind"]);
    if (kind === "demo")
        return issueDemoSession(ctx, store, state);
    const address = normalizeAddress(asText(obj["address"]));
    const nonce = asText(obj["nonce"]);
    const signature = asText(obj["signature"]);
    if (address.length === 0 || nonce.length === 0 || signature.length === 0) {
        return errResult(ctx, state, codes.API_MALFORMED);
    }
    const nonceRow = asPayload(await getBytes(store, "sessions", nonceKey(nonce)));
    if (nonceRow === undefined)
        return errResult(ctx, state, codes.API_UNAUTHORIZED);
    const now = asBigint(state["city_time"]);
    const expiresNonce = asBigint(nonceRow["expires_city_time"]);
    if (asText(nonceRow["kind"]) !== "nonce" || asText(nonceRow["address"]) !== address || expiresNonce < now) {
        return errResult(ctx, state, codes.API_UNAUTHORIZED);
    }
    const message = assembleSessionMessage(ctx.sessionMessageFields, sessionMessageValues({
        domain: ctx.sessionDomain,
        address,
        nonce,
        packHash: ctx.hash,
        expiresCityTime: expiresNonce.toString(),
    }));
    const recovered = recoverAddress(message, signature);
    if (recovered === undefined || normalizeAddress(recovered) !== address) {
        return errResult(ctx, state, codes.API_UNAUTHORIZED);
    }
    await putJson(store, "sessions", nonceKey(nonce), { kind: "spent" }, "wallet");
    return issueWalletSession(ctx, store, state, address);
}
async function issueDemoSession(ctx, store, state) {
    const now = asBigint(state["city_time"]);
    const expires = now + ctx.sessionTtlCity;
    let cityId = firstUnownedDemo(state);
    if (cityId === undefined) {
        cityId = opaqueId();
        spawnIntoState(ctx, state, cityId, "demo");
    }
    const bound = asEngineDict(asEngineDict(state["cities"])[cityId]);
    bound["session_bound"] = 1n;
    const sessionId = opaqueId();
    await putJson(store, "sessions", sessionId, {
        kind: "session",
        city_id: cityId,
        account_kind: "demo",
        expires_city_time: expires.toString(),
    }, "demo");
    await putJson(store, "city_owners", "demo:" + sessionId, { city_id: cityId }, "demo");
    return okResult(ctx, state, {
        session_id: sessionId,
        city_id: cityId,
        account_kind: "demo",
        expires_city_time: expires,
    });
}
async function issueWalletSession(ctx, store, state, address) {
    const now = asBigint(state["city_time"]);
    const expires = now + ctx.sessionTtlCity;
    const owned = asPayload(await getBytes(store, "city_owners", address));
    let cityId = asText(owned?.["city_id"]);
    if (cityId.length === 0) {
        cityId = opaqueId();
        spawnIntoState(ctx, state, cityId, "wallet");
        const seed = opaqueId();
        await putJson(store, "city_owners", address, { city_id: cityId, island_seed: seed }, "wallet");
        const city = asEngineDict(asEngineDict(state["cities"])[cityId]);
        city["island_seed"] = seed;
    }
    const sessionId = opaqueId();
    await putJson(store, "sessions", sessionId, {
        kind: "session",
        city_id: cityId,
        account_kind: "wallet",
        expires_city_time: expires.toString(),
    }, "wallet");
    return okResult(ctx, state, {
        session_id: sessionId,
        city_id: cityId,
        account_kind: "wallet",
        expires_city_time: expires,
    });
}
export async function sessionFromHeaders(ctx, store, state, headers) {
    const sessionId = bearerToken(headers, ctx);
    if (sessionId.length === 0)
        return undefined;
    const row = asPayload(await getBytes(store, "sessions", sessionId));
    if (row === undefined)
        return undefined;
    if (asText(row["kind"]) !== "session")
        return undefined;
    const now = asBigint(state["city_time"]);
    const expires = asBigint(row["expires_city_time"]);
    if (expires < now)
        return undefined;
    const cityId = asText(row["city_id"]);
    const accountKind = asText(row["account_kind"]);
    if (cityId.length === 0)
        return undefined;
    if (accountKind !== "demo" && accountKind !== "wallet")
        return undefined;
    const kind = cityKind(state, cityId);
    if (kind !== accountKind)
        return undefined;
    return { sessionId, cityId, accountKind, expiresCityTime: expires };
}

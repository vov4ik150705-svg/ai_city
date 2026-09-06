import { canonical } from "@corporator/contentpack";
import { transportHttp } from "@corporator/protocol";
import { codeSlots } from "./pack_ctx.js";
import { asBigint, asEngineDict, asText } from "./values.js";
function clockOf(state) {
    return {
        cityTime: asBigint(state["city_time"]),
        tickIndex: asBigint(state["tick_index"]),
    };
}
function transportStatus(code) {
    switch (code) {
        case "API_INTENT_REPLAY":
            return transportHttp.API_INTENT_REPLAY;
        case "API_MALFORMED":
            return transportHttp.API_MALFORMED;
        case "API_PACK_STALE":
            return transportHttp.API_PACK_STALE;
        case "API_RATE_LIMITED":
            return transportHttp.API_RATE_LIMITED;
        case "API_UNAUTHORIZED":
            return transportHttp.API_UNAUTHORIZED;
        case "SERVICE_DEGRADED":
            return transportHttp.SERVICE_DEGRADED;
        default:
            return undefined;
    }
}
export function statusFor(ctx, code) {
    const hit = transportStatus(code);
    if (hit !== undefined)
        return hit;
    return ctx.domainHttp;
}
export function envelopeOk(ctx, state, extra) {
    const clock = clockOf(state);
    const base = {
        city_time: clock.cityTime,
        tick_index: clock.tickIndex,
        pack_hash: ctx.hash,
        rules_version: ctx.rulesVersion,
    };
    for (const key of Object.keys(extra)) {
        const val = extra[key];
        if (val === undefined)
            continue;
        if (key in base)
            continue;
        base[key] = val;
    }
    return base;
}
export function envelopeErr(ctx, state, code) {
    const clock = clockOf(state);
    return {
        code,
        slots: [...codeSlots(ctx, code)],
        city_time: clock.cityTime,
    };
}
export function okResult(ctx, state, extra = {}) {
    return {
        status: ctx.httpOk,
        body: canonical(envelopeOk(ctx, state, extra)),
        headers: {},
    };
}
export function errResult(ctx, state, code) {
    return {
        status: statusFor(ctx, code),
        body: canonical(envelopeErr(ctx, state, code)),
        headers: {},
    };
}
export function cityKind(state, cityId) {
    const cities = asEngineDict(state["cities"]);
    const city = asEngineDict(cities[cityId]);
    const kind = asText(city["account_kind"]);
    if (kind === "demo" || kind === "wallet")
        return kind;
    return "wallet";
}

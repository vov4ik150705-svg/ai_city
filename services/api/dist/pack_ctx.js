import {} from "@corporator/contentpack";
import { loadConfig } from "@corporator/engine";
import { commandRoutes, domainConflictHttp, transportHttp } from "@corporator/protocol";
import { asBigint, asObj, asText, jsonToDict, walk } from "./values.js";
function strList(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const item of value) {
        if (typeof item === "string")
            out.push(item);
    }
    return out;
}
function refusalsOf(pack) {
    const raw = walk(pack, ["generated", "api", "endpoint_refusals"]);
    const obj = asObj(raw);
    const out = {};
    for (const key of Object.keys(obj)) {
        const row = obj[key];
        if (row === undefined)
            continue;
        out[key] = strList(row);
    }
    return out;
}
function stubsOf(pack, prefix) {
    const actions = asObj(walk(pack, ["sections", "screens", "actions"]));
    const out = new Set();
    for (const key of Object.keys(actions)) {
        const spec = actions[key];
        if (spec === undefined)
            continue;
        const row = asObj(spec);
        if (asText(row["v1"]) !== "stub")
            continue;
        const effect = asText(row["effect"]);
        if (!effect.startsWith(prefix))
            continue;
        out.add(effect.slice(prefix.length));
    }
    return out;
}
function tablesOf(pack) {
    const raw = asObj(walk(pack, ["sections", "arch", "schema_tables"]));
    const out = {};
    for (const tid of Object.keys(raw)) {
        const spec = raw[tid];
        if (spec === undefined)
            continue;
        const row = asObj(spec);
        out[tid] = {
            accountKind: asBigint(row["account_kind"]) === 1n,
            money: asBigint(row["money"]) === 1n,
        };
    }
    return out;
}
function metricsOf(pack) {
    const raw = asObj(walk(pack, ["sections", "arch", "metrics"]));
    const out = {};
    for (const id of Object.keys(raw)) {
        const spec = raw[id];
        if (spec === undefined)
            continue;
        const row = asObj(spec);
        out[id] = {
            invariant: asText(row["invariant"]),
            service: asText(row["service"]),
            thresholdSrc: asText(row["threshold_src"]),
            observeSrc: asText(row["observe_src"]),
            alertChannel: asText(row["alert_channel"]),
        };
    }
    return out;
}
function servicesOf(pack) {
    const raw = asObj(walk(pack, ["sections", "arch", "services"]));
    const out = {};
    for (const id of Object.keys(raw)) {
        const spec = raw[id];
        if (spec === undefined)
            continue;
        const row = asObj(spec);
        out[id] = {
            failMode: asText(row["fail_mode"]),
            blocksTick: asBigint(row["blocks_tick"]),
        };
    }
    return out;
}
export function makeCtx(loaded) {
    const pack = loaded.pack;
    const api = asObj(walk(pack, ["sections", "api"]));
    const paths = asObj(api["path_rules"] ?? {});
    const command = asObj(paths["command"] ?? {});
    const authNonce = asObj(paths["auth_nonce"] ?? {});
    const authSession = asObj(paths["auth_session"] ?? {});
    const state = asObj(paths["state"] ?? {});
    const packRule = asObj(paths["pack"] ?? {});
    const readyRule = asObj(paths["ready"] ?? {});
    const wsRule = asObj(paths["ws"] ?? {});
    const prefix = asText(command["prefix"]);
    const archGen = asObj(walk(pack, ["generated", "arch"]));
    const apiGen = asObj(walk(pack, ["generated", "api"]));
    const timeGen = asObj(walk(pack, ["generated", "time"]));
    const meta = asObj(walk(pack, ["sections", "meta"]));
    const screens = asObj(walk(pack, ["sections", "screens"]));
    const sources = asObj(screens["state_sources"] ?? {});
    const ready = asObj(walk(pack, ["sections", "arch", "readiness"]));
    const session = asObj(walk(pack, ["sections", "arch", "session"]));
    const tickHours = asBigint(walk(pack, ["sections", "time", "params", "tick_length_city_hours", "v"]));
    const ticksDay = asBigint(timeGen["ticks_per_city_day"]);
    return {
        pack,
        hash: loaded.hash,
        cfg: loadConfig(jsonToDict(pack)),
        rulesVersion: asText(meta["rules_version"]),
        ticksDay,
        snapshotEvery: asBigint(archGen["state_snapshot_every_ticks"]),
        rateLimit: asBigint(apiGen["command_rate_limit_per_city_tick"]),
        staleCode: asText(api["stale_time_code"]),
        replayCode: asText(api["replay_code"]),
        domainHttp: domainConflictHttp,
        httpOk: transportHttp.API_INTENT_REPLAY,
        commandPaths: commandRoutes,
        commandTemplate: asText(command["template"]),
        authNonceTemplate: asText(authNonce["template"]),
        authSessionTemplate: asText(authSession["template"]),
        sessionMessageFields: strList(session["message_fields"] ?? []),
        sessionDomain: asText(session["domain"]),
        sessionHeader: asText(session["authorization_header"]),
        sessionScheme: asText(session["authorization_scheme"]),
        sessionTtlCity: ticksDay * tickHours,
        nonceTtlCity: tickHours,
        stateTemplate: asText(state["template"]),
        packTemplate: asText(packRule["template"]),
        packCache: asText(packRule["cache"]),
        readyTemplate: asText(readyRule["template"]),
        wsTemplate: asText(wsRule["template"]),
        envelopeOk: strList(api["envelope_ok_fields"] ?? []),
        envelopeErr: strList(api["envelope_error_fields"] ?? []),
        refusals: refusalsOf(pack),
        stubEffects: stubsOf(pack, prefix),
        stateSources: Object.keys(sources),
        metrics: metricsOf(pack),
        readinessRequires: strList(ready["requires"] ?? []),
        services: servicesOf(pack),
        schemaTables: tablesOf(pack),
    };
}
export function codeSlots(ctx, code) {
    const row = asObj(walk(ctx.pack, ["sections", "codes", "codes"]));
    const spec = row[code];
    if (spec === undefined)
        return [];
    return strList(asObj(spec)["slots"] ?? []);
}
export function commitPathsFromPack(ctx) {
    const actions = asObj(walk(ctx.pack, ["sections", "screens", "actions"]));
    const names = new Set();
    const template = ctx.commandTemplate;
    const prefix = asText(asObj(walk(ctx.pack, ["sections", "api", "path_rules", "command"]))["prefix"]);
    for (const key of Object.keys(actions)) {
        const spec = actions[key];
        if (spec === undefined)
            continue;
        const effect = asText(asObj(spec)["effect"]);
        if (!effect.startsWith(prefix))
            continue;
        const name = effect.slice(prefix.length);
        names.add(applyTemplate(template, "effect", name));
    }
    return [...names].sort();
}
export function applyTemplate(template, param, value) {
    const token = "{" + param + "}";
    let out = "";
    let i = 0;
    while (i < template.length) {
        if (template.slice(i, i + token.length) === token) {
            out += value;
            i += token.length;
            continue;
        }
        out += template[i] ?? "";
        i += 1;
    }
    return out;
}
export function matchTemplate(template, path) {
    const names = [];
    let rx = "^";
    let i = 0;
    while (i < template.length) {
        const ch = template[i] ?? "";
        if (ch === "{") {
            const end = template.indexOf("}", i);
            if (end < 0)
                return undefined;
            names.push(template.slice(i + 1, end));
            rx += "([^/]+)";
            i = end + 1;
            continue;
        }
        if ("\\^$+*?|()[]".includes(ch))
            rx += "\\" + ch;
        else
            rx += ch;
        i += 1;
    }
    rx += "$";
    const m = new RegExp(rx).exec(path);
    if (!m)
        return undefined;
    const out = {};
    for (let k = 0; k < names.length; k += 1) {
        const name = names[k];
        const cap = m[k + 1];
        if (name === undefined || cap === undefined)
            return undefined;
        out[name] = cap;
    }
    return out;
}

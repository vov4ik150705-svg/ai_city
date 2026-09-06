import { canonical, fromUtf8, parseJson } from "@corporator/contentpack";
import { bytesToHex, encodeHeader, encodeRecord, tick, tickHeader, TickError, } from "@corporator/engine";
import {} from "./pack_ctx.js";
import { listBytes, putBytes, getBytes } from "./store.js";
import { asBigint, asEngineDict, asObj, asText, jsonToDict } from "./values.js";
import { cityKind } from "./envelope.js";
function recordSpec(cfg) {
    return asEngineDict(cfg["record_spec"]);
}
function headerSpec(cfg) {
    return asEngineDict(cfg["header_spec"]);
}
function inputsFromHeader(hdr) {
    const row = asObj(hdr);
    return {
        city_id: asText(row["city_id"]),
        tick_index: asBigint(row["tick_index"]),
        city_time: asBigint(row["city_time"]),
        pack_hash: asText(row["pack_hash"]),
        corp_eth_wei_per_whole: asBigint(row["corp_eth_wei_per_whole"]),
        eth_usd_8dec: asBigint(row["eth_usd_8dec"]),
        feed_live: asBigint(row["feed_live"]),
        dex_turnover_usd_8dec: asBigint(row["dex_turnover_usd_8dec"]),
        price_sample_city_time: asBigint(row["price_sample_city_time"]),
        stake_snapshot: asBigint(row["stake_snapshot"]),
        companion_commands: [],
    };
}
function snapJson(value) {
    if (value === null)
        return null;
    if (typeof value === "bigint" || typeof value === "string" || typeof value === "boolean")
        return value;
    if (Array.isArray(value)) {
        const out = [];
        for (const item of value)
            out.push(snapJson(item));
        return out;
    }
    if (typeof value === "object") {
        const src = value;
        const out = {};
        for (const key of Object.keys(src)) {
            if (key === "cfg")
                continue;
            const child = src[key];
            if (child === undefined)
                continue;
            out[key] = snapJson(child);
        }
        return out;
    }
    return "";
}
function restoreState(cfg, snap) {
    const state = jsonToDict(snap);
    state["cfg"] = cfg;
    return state;
}
export async function runTick(ctx, store, state, inputs, attestor) {
    const cfg = asEngineDict(state["cfg"]);
    const cityId = asText(inputs["city_id"]) ||
        (Object.keys(asEngineDict(state["cities"]))[0] ?? "");
    const cityTime = asBigint(inputs["city_time"]);
    const kind = cityKind(state, cityId);
    const inputId = cityId + ":" + cityTime.toString();
    await store.exec("BEGIN");
    try {
        const stepped = tick(state, inputs);
        const next = stepped[0];
        const records = stepped[1];
        const hdr = tickHeader(next, inputs);
        const hdrBytes = encodeHeader(hdr, headerSpec(cfg));
        await putBytes(store, "tick_inputs", inputId, hdrBytes, undefined);
        const recBytes = [];
        const spec = recordSpec(cfg);
        for (const rec of records) {
            const blob = encodeRecord(rec, spec);
            recBytes.push(blob);
            const agent = asText(rec["agent_id"]);
            await putBytes(store, "records", cityId + ":" + cityTime.toString() + ":" + agent, blob, kind);
        }
        await putBytes(store, "outbox", cityId + ":" + cityTime.toString(), hdrBytes, undefined);
        if (asBigint(next["hour"]) === 0n) {
            await putBytes(store, "state_snapshots", cityId + ":" + cityTime.toString(), canonical(snapJson(next)), kind);
        }
        await store.exec("COMMIT");
        let attest;
        if (attestor !== undefined) {
            try {
                const leaves = [bytesToHex(hdrBytes)];
                for (const blob of recBytes)
                    leaves.push(bytesToHex(blob));
                attest = await attestor.submit(canonical({
                    city_id: cityId,
                    city_time: cityTime.toString(),
                    leaves,
                }));
            }
            catch {
                attest = undefined;
            }
        }
        return { state: next, records, headerBytes: hdrBytes, recordBytes: recBytes, attest };
    }
    catch (err) {
        await store.exec("ROLLBACK");
        throw err;
    }
}
export function isPackHashHalt(err) {
    return err instanceof TickError && err.code === "PACK_HASH";
}
export async function replayStored(ctx, store, genesis, cityId) {
    const rows = await listBytes(store, "tick_inputs", cityId + ":");
    const ordered = [...rows].sort((a, b) => {
        const ha = asObj(parseJson(fromUtf8(a.payload)));
        const hb = asObj(parseJson(fromUtf8(b.payload)));
        const ta = asBigint(ha["city_time"]);
        const tb = asBigint(hb["city_time"]);
        if (ta < tb)
            return 0 - 1;
        if (ta > tb)
            return 1;
        return 0;
    });
    let st = structuredClone(genesis);
    const headers = [];
    const records = [];
    const spec = recordSpec(ctx.cfg);
    const hspec = headerSpec(ctx.cfg);
    for (const row of ordered) {
        const hdr = parseJson(fromUtf8(row.payload));
        const inputs = inputsFromHeader(hdr);
        const stepped = tick(st, inputs);
        st = stepped[0];
        const encodedHdr = encodeHeader(tickHeader(st, inputs), hspec);
        headers.push(encodedHdr);
        for (const rec of stepped[1])
            records.push(encodeRecord(rec, spec));
    }
    return { headers, records };
}
export async function replayFromSnapshot(ctx, store, genesis, cityId, fromCityTime) {
    const snap = await getBytes(store, "state_snapshots", cityId + ":" + fromCityTime.toString());
    let st;
    if (snap === undefined)
        st = structuredClone(genesis);
    else
        st = restoreState(ctx.cfg, parseJson(fromUtf8(snap)));
    const rows = await listBytes(store, "tick_inputs", cityId + ":");
    const later = rows.filter((row) => {
        const hdr = asObj(parseJson(fromUtf8(row.payload)));
        return asBigint(hdr["city_time"]) > fromCityTime;
    });
    later.sort((a, b) => {
        const ta = asBigint(asObj(parseJson(fromUtf8(a.payload)))["city_time"]);
        const tb = asBigint(asObj(parseJson(fromUtf8(b.payload)))["city_time"]);
        if (ta < tb)
            return 0 - 1;
        if (ta > tb)
            return 1;
        return 0;
    });
    const headers = [];
    const records = [];
    const spec = recordSpec(ctx.cfg);
    const hspec = headerSpec(ctx.cfg);
    for (const row of later) {
        const hdr = parseJson(fromUtf8(row.payload));
        const inputs = inputsFromHeader(hdr);
        const stepped = tick(st, inputs);
        st = stepped[0];
        headers.push(encodeHeader(tickHeader(st, inputs), hspec));
        for (const rec of stepped[1])
            records.push(encodeRecord(rec, spec));
    }
    return { headers, records };
}
export { snapJson, restoreState, inputsFromHeader };

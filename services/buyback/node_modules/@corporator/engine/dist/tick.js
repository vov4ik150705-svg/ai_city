import { canonical } from "./canonical.js";
import { applyDexTurnover, applySpend, assertI11, assertI2, bankWithdraw, buyback, collectRequests, corkReturn, exitCoverageCorp, fixDayBudget, fundCap, pay, advanceResearch, reserveDrip, updateMintRate, } from "./economy.js";
import { accrueAmount } from "./fragments.js";
import { periodSettleDue, seasonSettle } from "./seasons.js";
import { encodeHeader, requireHeader, requireRecord } from "./record.js";
import { cityClock, companionCommandsHash, resolveCityTime, shiftSeedHex } from "./state.js";
import { asBig, asBool, asDict, asList, asStr, clampInt, sortedKeys, TickError } from "./values.js";
function pyOr(value, fallback) {
    if (value === undefined || value === null || value === false || value === "")
        return fallback;
    const n = asBig(value);
    if (n === 0n)
        return fallback;
    return n;
}
function applyCompanion(cfg, state, commands) {
    if (!commands)
        return;
    if (asBig(cfg["companion_replan_on_login"]) > 0n)
        return;
    for (const cmd of asList(commands)) {
        if (cmd === null || typeof cmd !== "object" || Array.isArray(cmd))
            continue;
        const row = cmd;
        const cid = asStr(row["city_id"]);
        const cities = asDict(state["cities"]);
        if (cid && cid in cities) {
            const city = asDict(cities[cid]);
            const journal = asList(city["companion_journal"]);
            journal.push(row);
            city["companion_journal"] = journal;
        }
    }
}
function recalcEfficiency(cfg, state) {
    const bps = asBig(cfg["bps"]);
    const stale = asBig(cfg["oracle_stale_city_hours"]);
    const decayAge = asBig(cfg["oracle_decay_city_hours"]);
    const step = asBig(cfg["oracle_decay_bps_per_day"]);
    const k = asBig(cfg["efficiency_k_bps"]);
    const clamp = asBig(cfg["efficiency_clamp_bps"]);
    const cities = asDict(state["cities"]);
    for (const cid of sortedKeys(cities)) {
        const city = asDict(cities[cid]);
        const districts = city["district_efficiency"];
        if (!districts || typeof districts !== "object")
            continue;
        const slots = asDict(districts);
        for (const did of Object.keys(slots)) {
            const slot = asDict(slots[did]);
            const ema24 = asBig(slot["ema_24h"]);
            const ema30 = asBig(slot["ema_30d"]);
            const age = asBig(slot["oracle_age_hours"]);
            if (age > decayAge) {
                const cur = asBig(slot["efficiency_bps"], bps);
                if (cur > bps) {
                    const nxt = cur - step;
                    slot["efficiency_bps"] = nxt > bps ? nxt : bps;
                }
                else if (cur < bps) {
                    const nxt = cur + step;
                    slot["efficiency_bps"] = nxt < bps ? nxt : bps;
                }
                const codes = asList(city["codes"]);
                codes.push("ORACLE_STALE");
                city["codes"] = codes;
                continue;
            }
            if (age > stale) {
                const codes = asList(city["codes"]);
                codes.push("ORACLE_STALE");
                city["codes"] = codes;
                continue;
            }
            const denom = ema30 > 1n ? ema30 : 1n;
            const ratioBps = (ema24 * bps) / denom;
            const boost = (k * (ratioBps - bps)) / bps;
            slot["efficiency_bps"] = clampInt(bps + boost, bps - clamp, bps + clamp);
        }
    }
}
function hourSix(cfg, state, day, hour) {
    if (hour !== asBig(cfg["efficiency_recalc_hour"]))
        return;
    recalcEfficiency(cfg, state);
    const data = asDict(cfg["data"]);
    if (Object.keys(data).length === 0)
        return;
    const cities = asDict(state["cities"]);
    for (const cid of sortedKeys(cities)) {
        const city = asDict(cities[cid]);
        if (!city["fragment_ledger"])
            continue;
        city["fragment_settlement"] = { pool: asBig(city["fragment_pool"]) };
    }
    if (!periodSettleDue(data, day, hour))
        return;
    const rows = [];
    for (const cid of sortedKeys(cities)) {
        const city = asDict(cities[cid]);
        if (!("influence" in city) && !("season_row" in city))
            continue;
        const seeded = asDict(city["season_row"]);
        if (Object.keys(seeded).length > 0) {
            rows.push(seeded);
        }
        else {
            rows.push({
                city_id: cid,
                influence: asBig(city["influence"]),
                positive_days: asBig(city["positive_days"]),
                live_stake: city["live_stake"],
                demo: city["demo"],
                spend_protocol: asBig(city["spend_protocol_period"]),
            });
        }
    }
    if (rows.length > 0) {
        const rawPools = state["season_prize_pools"];
        const poolArg = rawPools !== undefined && rawPools !== null && typeof rawPools === "object"
            ? asDict(rawPools)
            : asBig(state["season_prize_pool"]);
        state["season_settlement"] = seasonSettle(data, rows, poolArg, false, day, hour);
    }
}
function accrueFragments(cfg, state, city) {
    const data = asDict(cfg["data"]);
    const building = city["building"];
    if (Object.keys(data).length === 0 || !building || typeof building !== "object")
        return 0n;
    const idle = asStr(city["idle"]) !== "";
    const payout = asBig(city["payout"]);
    let status = payout > 0n && !idle ? asStr(cfg["status_paid"]) : asStr(cfg["status_idle"]);
    if (asBool(city["construction"]))
        status = asStr(cfg["status_construction"]);
    const mags = [];
    for (const m of asList(city["fragment_rate_mags"]))
        mags.push(asBig(m));
    const delta = accrueAmount(data, payout, mags, asDict(building), status, idle, asBig(cfg["bps"]), asStr(cfg["status_paid"]));
    city["fragments"] = asBig(city["fragments"]) + delta;
    return delta;
}
function recordsOf(state) {
    const cfg = asDict(state["cfg"]);
    const spec = asDict(cfg["record_spec"]);
    const length = asBig(cfg["tick_length_city_hours"]);
    const bps = asBig(cfg["bps"]);
    const out = [];
    const cities = asDict(state["cities"]);
    for (const cid of sortedKeys(cities)) {
        const city = asDict(cities[cid]);
        const idle = asStr(city["idle"]);
        const payout = asBig(city["payout"]);
        let status = idle || payout <= 0n ? asStr(cfg["status_idle"]) : asStr(cfg["status_paid"]);
        if (asBool(city["construction"]))
            status = asStr(cfg["status_construction"]);
        const delta = accrueFragments(cfg, state, city);
        const stage = asDict(city["stage_bps"]);
        let cityTime = state["city_time"];
        if (cityTime === undefined || cityTime === null) {
            cityTime = asBig(cfg["anchor_hour"]) + asBig(state["tick_index"]) * length;
        }
        const rec = {
            layout_version: asBig(cfg["layout_version"]),
            city_id: cid,
            tick_index: asBig(state["tick_index"]),
            city_time: asBig(cityTime),
            agent_id: "shift",
            building_id: asStr(city["building_id"]),
            objective: asStr(city["objective"]),
            inputs: {
                compute: asBig(city["compute_draw"]),
                energy: asBig(city["energy_draw"]),
                materials: 0n,
            },
            district_efficiency_bps: asBig(city["district_efficiency_bps"], bps),
            seed: shiftSeedHex(cid, asBig(state["tick_index"]), "shift"),
            output: payout,
            payroll_ratio_bps: asBig(state["payroll_ratio_bps"]),
            status,
            reason: idle,
            fragments_delta: delta,
            stage_bps: {
                base: asBig(stage["base"], bps),
                post: asBig(stage["post"], bps),
            },
        };
        if (Object.keys(spec).length > 0) {
            requireRecord(rec, spec, asBig(state["tick_index"]), cid);
        }
        out.push(rec);
        canonical(rec);
    }
    return out;
}
export function tick(state, inputs) {
    if (typeof inputs["eth_usd_8dec"] === "number") {
        throw new TickError("I9_FLOAT", asBig(state["tick_index"]), "-", { bad: 1n });
    }
    const cfg = asDict(state["cfg"]);
    assertI2(cfg, state);
    state["codes"] = [];
    const resolved = resolveCityTime(cfg, inputs, asBig(state["tick_index"]));
    state["tick_index"] = resolved[0];
    state["city_time"] = resolved[1];
    const clock = cityClock(cfg, asBig(state["tick_index"]));
    state["day"] = clock[0];
    state["hour"] = clock[1];
    state["weekday"] = clock[2];
    if (inputs["pack_hash"] && asStr(inputs["pack_hash"]) !== asStr(cfg["pack_hash"])) {
        throw new TickError("PACK_HASH", asBig(state["tick_index"]), "-", { got: 0n });
    }
    applyCompanion(cfg, state, inputs["companion_commands"] ?? []);
    updateMintRate(cfg, state, inputs, clock[1]);
    if (asBig(state["mint_rate"]) > asBig(cfg["capital_anchor"])) {
        throw new TickError("I1_RATE_CEILING", asBig(state["tick_index"]), "-", { rate: asBig(state["mint_rate"]) });
    }
    applyDexTurnover(cfg, state, asBig(inputs["dex_turnover_usd_8dec"]));
    hourSix(cfg, state, clock[0], clock[1]);
    fixDayBudget(cfg, state, clock[0], clock[1]);
    const rows = collectRequests(cfg, state, clock[1], clock[2]);
    pay(cfg, state, rows);
    advanceResearch(cfg, state);
    const cities = asDict(state["cities"]);
    for (const cid of sortedKeys(cities)) {
        const city = asDict(cities[cid]);
        city["codes"] = [];
        applySpend(cfg, state, city, asBig(city["spend_intent"]), asBig(city["spend_from_earned"]));
        city["spend_intent"] = 0n;
    }
    bankWithdraw(cfg, state, clock[0], clock[1], clock[2]);
    buyback(cfg, state);
    reserveDrip(cfg, state);
    fundCap(cfg, state);
    corkReturn(cfg, state);
    const cov = exitCoverageCorp(cfg, state);
    const mon = asDict(state["mon"]);
    const cur7 = mon["i7_cov_min"];
    if (cur7 === null || cur7 === undefined || cov < asBig(cur7)) {
        mon["i7_cov_min"] = cov;
        mon["i7_cov_min_day"] = clock[0];
        if (cov < 0n)
            asList(state["codes"]).push(asStr(cfg["exit_uncovered_code"]));
    }
    const vault = asBig(state["vault_corp"]);
    if (vault > 0n) {
        const covBps = (asBig(cfg["bps"]) * cov) / vault;
        const curCb = mon["i7_cov_min_bps"];
        if (curCb === null || curCb === undefined || covBps < asBig(curCb)) {
            mon["i7_cov_min_bps"] = covBps;
            mon["i7_cov_min_bps_day"] = clock[0];
        }
    }
    assertI11(cfg, state);
    return [state, recordsOf(state)];
}
export function tickHeader(state, inputs, prevStateHash = "") {
    const cfg = asDict(state["cfg"]);
    const cmds = inputs["companion_commands"] ?? [];
    const cities = asDict(state["cities"]);
    const cityId = asStr(inputs["city_id"]) || (Object.keys(cities).length > 0 ? (Object.keys(cities)[0] ?? "") : "");
    const hdr = {
        layout_version: asBig(cfg["layout_version"]),
        city_id: cityId,
        tick_index: asBig(state["tick_index"]),
        city_time: asBig(state["city_time"]),
        pack_hash: asStr(cfg["pack_hash"]),
        corp_eth_wei_per_whole: asBig(inputs["corp_eth_wei_per_whole"]),
        eth_usd_8dec: asBig(inputs["eth_usd_8dec"]),
        feed_live: asBig(inputs["feed_live"]),
        dex_turnover_usd_8dec: asBig(inputs["dex_turnover_usd_8dec"]),
        price_sample_city_time: pyOr(inputs["price_sample_city_time"], asBig(state["city_time"])),
        companion_commands_hash: companionCommandsHash(cmds),
        prev_state_hash: prevStateHash ? prevStateHash : "",
        stake_snapshot: asBig(inputs["stake_snapshot"]),
    };
    const spec = asDict(cfg["header_spec"]);
    if (Object.keys(spec).length > 0) {
        requireHeader(hdr, spec, asBig(state["tick_index"]), cityId);
    }
    return hdr;
}
export function catchUp(state, inputsNow, lastCityTime) {
    const cfg = asDict(state["cfg"]);
    const length = asBig(cfg["tick_length_city_hours"]);
    const now = asBig(inputsNow["city_time"]);
    const elapsed = length === 0n ? 0n : (now - lastCityTime) / length;
    if (elapsed <= 0n)
        return [state, []];
    const cap = length === 0n ? 0n : asBig(cfg["offline_cap"]) / length;
    const credited = elapsed < cap ? elapsed : cap;
    const skipped = elapsed - credited;
    const records = [];
    const bps = asBig(cfg["bps"]);
    if (skipped > 0n) {
        const fromTick = length === 0n ? 0n : (lastCityTime - asBig(cfg["anchor_hour"])) / length + 1n;
        const gapCity = asStr(inputsNow["city_id"]);
        records.push({
            layout_version: asBig(cfg["layout_version"]),
            city_id: gapCity,
            tick_index: fromTick,
            city_time: lastCityTime + length,
            agent_id: "shift",
            building_id: "",
            objective: "",
            inputs: { compute: 0n, energy: 0n, materials: 0n },
            district_efficiency_bps: bps,
            seed: shiftSeedHex(gapCity, fromTick, "shift"),
            output: 0n,
            payroll_ratio_bps: asBig(state["payroll_ratio_bps"]),
            status: asStr(cfg["status_gap"]),
            reason: asStr(cfg["idle_offline"]),
            fragments_delta: 0n,
            stage_bps: { base: bps, post: bps },
        });
    }
    const currentIndex = length === 0n ? 0n : (now - asBig(cfg["anchor_hour"])) / length;
    const first = currentIndex - credited + 1n;
    let i = 0n;
    let st = state;
    while (i < credited) {
        const idx = first + i;
        const inp = { ...inputsNow };
        inp["tick_index"] = idx;
        inp["city_time"] = asBig(cfg["anchor_hour"]) + idx * length;
        const stepped = tick(st, inp);
        st = stepped[0];
        for (const r of stepped[1])
            records.push(r);
        i += 1n;
    }
    return [st, records];
}
export { encodeHeader };

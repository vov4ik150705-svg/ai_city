import { asBig, asDict, asStr } from "./values.js";
function seasonParam(data, name) {
    return asBig(asDict(asDict(asDict(data["seasons"])["params"])[name])["v"]);
}
function flagOn(value) {
    if (value === true)
        return true;
    if (value === false || value === undefined || value === null)
        return false;
    return asBig(value) !== 0n;
}
function bpsOf(data) {
    return seasonParam(data, "prize_curve_alpha_bps");
}
export function shareFloor(pool, weight, total) {
    if (total <= 0n || pool <= 0n || weight <= 0n)
        return 0n;
    return (weight * pool) / total;
}
export function zipfWeights(n, bps) {
    const out = [];
    let k = 1n;
    while (k <= n) {
        out.push(bps / k);
        k += 1n;
    }
    return out;
}
export function zipfPayout(pool, n, bps) {
    if (n <= 0n) {
        return { payouts: [], weights: [], sumPayout: 0n, dust: pool > 0n ? pool : 0n };
    }
    const weights = zipfWeights(n, bps);
    let total = 0n;
    for (const w of weights)
        total += w;
    const payouts = [];
    let paid = 0n;
    for (const w of weights) {
        const share = shareFloor(pool, w, total);
        payouts.push(share);
        paid += share;
    }
    const leftover = pool - paid;
    return { payouts, weights, sumPayout: paid, dust: leftover > 0n ? leftover : 0n };
}
function prizeAssets(data) {
    const seas = asDict(data["seasons"]);
    const override = seas["prize_assets"];
    if (Array.isArray(override)) {
        const out = [];
        for (const x of override)
            out.push(asStr(x));
        return out;
    }
    const single = asStr(seas["prize_asset"]);
    if (single.length > 0)
        return [single];
    const districts = asDict(asDict(data["districts"])["districts"]);
    const out = [];
    for (const did of Object.keys(districts)) {
        out.push(asStr(asDict(districts[did])["ticker"]));
    }
    return out;
}
function shareCapBps(data, bps) {
    const seas = asDict(data["seasons"]);
    if (flagOn(seas["disable_share_cap"]))
        return 0n;
    const seam = seas["prize_share_cap_over_contribution_bps"];
    if (seam !== undefined && seam !== null && seam !== "")
        return asBig(seam);
    const params = asDict(seas["params"]);
    if ("prize_share_cap_over_contribution_bps" in params) {
        return asBig(asDict(params["prize_share_cap_over_contribution_bps"])["v"]);
    }
    const archs = asDict(asDict(data["sim"])["archetypes"]);
    const deps = [];
    for (const id of Object.keys(archs)) {
        deps.push(asBig(asDict(asDict(asDict(archs[id])["deposit_multiple_bps"]))["v"]));
    }
    if (deps.length === 0)
        return 0n;
    const pairN = 1n + 1n;
    const rankRow = zipfPayout(bps, pairN, bps);
    const rank1 = rankRow.payouts.length > 0 ? (rankRow.payouts[0] ?? 0n) : 0n;
    let k = 1n;
    for (const dep of deps) {
        let other = 0n;
        for (const d of deps) {
            if (d !== dep && d > other)
                other = d;
        }
        if (other === 0n)
            other = dep;
        const pair = dep + other;
        if (pair <= 0n)
            continue;
        const contrib = (dep * bps) / pair;
        if (contrib <= 0n)
            continue;
        const need = (rank1 * bps + contrib - 1n) / contrib;
        if (need > k)
            k = need;
    }
    return k;
}
function poolMap(data, pool) {
    const assets = prizeAssets(data);
    const out = {};
    if (typeof pool === "object" && pool !== null) {
        const src = asDict(pool);
        for (const a of assets) {
            out[a] = a in src ? asBig(src[a]) : 0n;
        }
        return out;
    }
    for (const a of assets)
        out[a] = pool;
    return out;
}
function shareCapMax(pool, contrib, totalContrib, kBps, nEligible, bps) {
    if (nEligible <= 1n || pool <= 0n || kBps <= 0n)
        return pool;
    if (totalContrib <= 0n || contrib <= 0n)
        return 0n;
    return (pool * contrib * kBps) / (totalContrib * bps);
}
function qualifyDays(data, bps) {
    const season = asBig(asDict(asDict(asDict(data["balance"])["params"])["season_city_days"])["v"]);
    const periods = seasonParam(data, "prize_periods_per_season");
    if (periods <= 0n)
        return 0n;
    const period = season / periods;
    return (period * seasonParam(data, "season_qualify_bps")) / bps;
}
function settleHour(data) {
    return asBig(asDict(asDict(asDict(data["time"])["params"])["efficiency_recalc_hour"])["v"]);
}
function periodDays(data) {
    const season = asBig(asDict(asDict(asDict(data["balance"])["params"])["season_city_days"])["v"]);
    const n = seasonParam(data, "prize_periods_per_season");
    if (n <= 0n)
        return 0n;
    return season / n;
}
export function periodSettleDue(data, cityDay, hour) {
    if (hour !== settleHour(data))
        return false;
    const pd = periodDays(data);
    if (pd <= 0n || cityDay <= 1n)
        return false;
    return (cityDay - 1n) % pd === 0n;
}
export function seasonSettleDue(data, cityDay, hour) {
    if (hour !== settleHour(data))
        return false;
    const sd = asBig(asDict(asDict(asDict(data["balance"])["params"])["season_city_days"])["v"]);
    if (sd <= 0n || cityDay <= 1n)
        return false;
    return (cityDay - 1n) % sd === 0n;
}
function settlementCodes(data, cityDay, hour) {
    const codes = [];
    if (periodSettleDue(data, cityDay, hour))
        codes.push("PRIZE_PERIOD_SETTLED");
    if (seasonSettleDue(data, cityDay, hour))
        codes.push("SEASON_SETTLED");
    return codes;
}
export function seasonSettle(data, rows, pool, hopStale = false, cityDay = -1n, hour = -1n) {
    const bps = bpsOf(data);
    const need = qualifyDays(data, bps);
    const requireStake = flagOn(seasonParam(data, "prize_require_live_stake"));
    const livePay = flagOn(seasonParam(data, "season_prizes_live"));
    const topN = seasonParam(data, "prize_top_n");
    const demoReal = flagOn(asDict(data["seasons"])["demo_prize_real"]);
    const demoAfter = flagOn(asDict(data["seasons"])["demo_after_qualify"]);
    const scope = asStr(asDict(asDict(asDict(data["seasons"])["scope"])["leaderboard_scope"])["v"]);
    const cityScope = scope === "city";
    const codes = [];
    const assets = prizeAssets(data);
    const kBps = shareCapBps(data, bps);
    const forceCapN1 = flagOn(asDict(data["seasons"])["force_share_cap_n1"]);
    const isDemo = (row) => flagOn(row["demo"]) || demoReal;
    const bySlot = new Map();
    const ingest = (row, skipDemo) => {
        const cityId = asStr(row["city_id"]);
        const wallet = asStr(row["wallet"], cityId);
        const influence = asBig(row["influence"]);
        const pos = asBig(row["positive_days"]);
        const stake = flagOn(row["live_stake"]);
        const spend = asBig(row["spend_protocol"]);
        if (isDemo(row)) {
            if (!skipDemo)
                codes.push("DEMO_NO_PRIZE");
            return;
        }
        if (pos < need) {
            codes.push("PRIZE_NOT_QUALIFIED");
            return;
        }
        if (requireStake && !stake) {
            codes.push("PRIZE_STAKE_REQUIRED");
            return;
        }
        const slotKey = cityScope ? cityId : wallet;
        const cur = bySlot.get(slotKey);
        if (cur === undefined) {
            bySlot.set(slotKey, { wallet, cityId, influence, positiveDays: pos, spend });
        }
        else if (!cityScope) {
            codes.push("PRIZE_WALLET_MERGED");
            cur.spend += spend;
            if (influence > cur.influence || (influence === cur.influence && cityId < cur.cityId)) {
                cur.influence = influence;
                cur.cityId = cityId;
                cur.positiveDays = pos;
            }
        }
    };
    if (demoAfter) {
        for (const row of rows)
            ingest(row, true);
        for (const row of rows) {
            if (isDemo(row))
                codes.push("DEMO_NO_PRIZE");
        }
    }
    else {
        for (const row of rows) {
            if (isDemo(row))
                codes.push("DEMO_NO_PRIZE");
        }
        for (const row of rows)
            ingest(row, true);
    }
    const eligible = [...bySlot.values()].sort((a, b) => {
        if (a.influence === b.influence)
            return a.cityId < b.cityId ? -1 : a.cityId > b.cityId ? 1 : 0;
        return a.influence > b.influence ? -1 : 1;
    });
    const pools = poolMap(data, pool);
    if (hopStale) {
        codes.push("PRIZE_HOP_STALE");
        for (const a of assets)
            pools[a] = 0n;
    }
    let allEmpty = true;
    for (const a of assets) {
        if ((pools[a] ?? 0n) > 0n)
            allEmpty = false;
    }
    if (allEmpty)
        codes.push("PRIZE_POOL_EMPTY");
    const nEligible = BigInt(eligible.length);
    const nPay = nEligible < topN ? nEligible : topN;
    const capN = forceCapN1 && nEligible <= 1n ? 1n + 1n : nEligible;
    const shareCapApplied = kBps > 0n && capN > 1n ? 1n : 0n;
    let totalContrib = 0n;
    for (const rec of eligible)
        totalContrib += rec.spend;
    const payoutRows = [];
    const dustByAsset = {};
    const byAsset = {};
    let paid = 0n;
    if (nPay <= 0n) {
        codes.push("PRIZE_NO_ELIGIBLE");
        for (const a of assets) {
            const empty = zipfPayout(pools[a] ?? 0n, 0n, bps);
            dustByAsset[a] = empty.dust;
            byAsset[a] = {
                sum_payout: 0n,
                dust: empty.dust,
                pool: pools[a] ?? 0n,
                invariant_ok: 1n,
                payouts: [],
            };
        }
    }
    else {
        const ranked = [];
        let take = 0n;
        for (const rec of eligible) {
            if (take >= nPay)
                break;
            ranked.push(rec);
            take += 1n;
        }
        const amountsByRank = [];
        let fill = 0;
        while (fill < ranked.length) {
            amountsByRank.push({});
            fill += 1;
        }
        for (const a of assets) {
            const zipf = zipfPayout(pools[a] ?? 0n, nPay, bps);
            let assetPaid = 0n;
            const assetRows = [];
            let i = 0;
            for (const rec of ranked) {
                let amt = 0n;
                if (livePay) {
                    amt = zipf.payouts[i] ?? 0n;
                    if (shareCapApplied === 1n) {
                        const capAmt = shareCapMax(pools[a] ?? 0n, rec.spend, totalContrib, kBps, capN, bps);
                        if (amt > capAmt) {
                            amt = capAmt;
                            codes.push("PRIZE_SHARE_CAPPED");
                        }
                    }
                }
                const slot = amountsByRank[i];
                if (slot !== undefined)
                    slot[a] = amt;
                assetPaid += amt;
                assetRows.push({
                    wallet: rec.wallet,
                    city_id: rec.cityId,
                    rank: BigInt(i) + 1n,
                    payout: amt,
                });
                i += 1;
            }
            let dustA = (pools[a] ?? 0n) - assetPaid;
            if (dustA < 0n)
                dustA = 0n;
            dustByAsset[a] = dustA;
            byAsset[a] = {
                sum_payout: assetPaid,
                dust: dustA,
                pool: pools[a] ?? 0n,
                invariant_ok: assetPaid <= (pools[a] ?? 0n) ? 1n : 0n,
                payouts: assetRows,
            };
            paid += assetPaid;
        }
        if (flagOn(asDict(data["seasons"])["cross_asset_dust"]) && assets.length > 1) {
            const a0 = assets[0];
            const a1 = assets[1];
            if (a0 !== undefined && a1 !== undefined) {
                const moved = dustByAsset[a0] ?? 0n;
                dustByAsset[a0] = 0n;
                dustByAsset[a1] = (dustByAsset[a1] ?? 0n) + moved;
                const left = byAsset[a0];
                const right = byAsset[a1];
                if (left !== undefined) {
                    byAsset[a0] = { ...left, dust: 0n };
                }
                if (right !== undefined) {
                    byAsset[a1] = { ...right, dust: dustByAsset[a1] ?? 0n };
                }
            }
        }
        let rank = 1n;
        let ri = 0;
        for (const rec of ranked) {
            const amounts = amountsByRank[ri] ?? {};
            let sumAmt = 0n;
            for (const a of assets)
                sumAmt += amounts[a] ?? 0n;
            payoutRows.push({
                wallet: rec.wallet,
                city_id: rec.cityId,
                influence: rec.influence,
                rank,
                payout: sumAmt,
                amounts,
            });
            rank += 1n;
            ri += 1;
        }
    }
    if (cityDay < 0n) {
        codes.push("SEASON_SETTLED");
    }
    else {
        const settleAt = hour < 0n ? settleHour(data) : hour;
        for (const c of settlementCodes(data, cityDay, settleAt))
            codes.push(c);
    }
    let dust = 0n;
    for (const a of assets)
        dust += dustByAsset[a] ?? 0n;
    let invariantOk = 1n;
    for (const a of assets) {
        if ((byAsset[a]?.invariant_ok ?? 1n) === 0n)
            invariantOk = 0n;
    }
    let qualifyRejected = 0n;
    for (const c of codes) {
        if (c === "PRIZE_NOT_QUALIFIED")
            qualifyRejected = 1n;
    }
    const kettleMonth = "month";
    return {
        payouts: payoutRows,
        n_eligible: nEligible,
        n_paid: BigInt(payoutRows.length),
        sum_payout: paid,
        dust: dust > 0n ? dust : 0n,
        pool_left: dust > 0n ? dust : 0n,
        dust_by_asset: dustByAsset,
        by_asset: byAsset,
        codes,
        assets: [...assets],
        asset: assets.length === 1 ? (assets[0] ?? "") : assets.join(","),
        kettle: kettleMonth,
        mints_capital: 0n,
        live: livePay ? 1n : 0n,
        need_days: need,
        invariant_ok: invariantOk,
        qualify_rejected: qualifyRejected,
        share_cap_applied: shareCapApplied,
        share_cap_bps: kBps,
    };
}

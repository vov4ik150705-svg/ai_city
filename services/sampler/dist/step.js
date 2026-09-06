import { canonical, fromUtf8, parseJson } from "@corporator/contentpack";
import { twapFromSamples } from "@corporator/engine";
import { cityDayOf } from "./pack.js";
import { samplerSilenceState } from "./silence.js";
import { asBig, asObj } from "./values.js";
export function emptySamplerState() {
    return {
        samples: [],
        seq: 0n,
        lastCorpTwap: 0n,
        lastUsdTwap: 0n,
        lastSampleCityTime: 0n,
        feedLive: 0n,
        age: 0n,
        ageAlert: 0n,
    };
}
function clipWindow(pack, samples) {
    if (BigInt(samples.length) <= pack.samplesPerTwapWindow)
        return samples;
    return samples.slice(1);
}
function series(samples, pick) {
    const out = [];
    for (const row of samples)
        out.push(pick(row));
    return out;
}
function declaredInputs(pack, corp, usd, live, sampledAt) {
    const raw = {
        corp_eth_wei_per_whole: corp,
        eth_usd_8dec: usd,
        feed_live: live,
        price_sample_city_time: sampledAt,
    };
    const out = {};
    for (const name of pack.inputFields) {
        const v = raw[name];
        if (v !== undefined)
            out[name] = v;
    }
    return {
        corp_eth_wei_per_whole: out["corp_eth_wei_per_whole"] ?? 0n,
        eth_usd_8dec: out["eth_usd_8dec"] ?? 0n,
        feed_live: out["feed_live"] ?? 0n,
        price_sample_city_time: out["price_sample_city_time"] ?? 0n,
    };
}
export function stepSampler(pack, state, cityTime, observation) {
    if (observation === undefined) {
        const silenced = samplerSilenceState(state.lastCorpTwap, state.lastSampleCityTime, cityTime, undefined);
        const usd = samplerSilenceState(state.lastUsdTwap, state.lastSampleCityTime, cityTime, undefined);
        const ageAlert = silenced.age >= pack.ageAlertCityHours ? 1n : 0n;
        const next = {
            samples: state.samples,
            seq: state.seq,
            lastCorpTwap: silenced.value,
            lastUsdTwap: usd.value,
            lastSampleCityTime: silenced.priceSampleCityTime,
            feedLive: silenced.feedLive,
            age: silenced.age,
            ageAlert,
        };
        return {
            next,
            inputs: declaredInputs(pack, next.lastCorpTwap, next.lastUsdTwap, next.feedLive, next.lastSampleCityTime),
        };
    }
    const sampled = {
        sampledAt: state.seq + 1n,
        corpEthWeiPerWhole: observation.corpEthWeiPerWhole,
        ethUsd8dec: observation.ethUsd8dec,
    };
    const samples = clipWindow(pack, [...state.samples, sampled]);
    const corpTwap = twapFromSamples(series(samples, (s) => s.corpEthWeiPerWhole));
    const usdTwap = twapFromSamples(series(samples, (s) => s.ethUsd8dec));
    const live = samplerSilenceState(state.lastCorpTwap, state.lastSampleCityTime, cityTime, corpTwap);
    const next = {
        samples,
        seq: sampled.sampledAt,
        lastCorpTwap: live.value,
        lastUsdTwap: usdTwap,
        lastSampleCityTime: live.priceSampleCityTime,
        feedLive: live.feedLive,
        age: live.age,
        ageAlert: 0n,
    };
    return {
        next,
        inputs: declaredInputs(pack, next.lastCorpTwap, next.lastUsdTwap, next.feedLive, next.lastSampleCityTime),
    };
}
function sampleJson(row) {
    return {
        sampled_at: row.sampledAt,
        corp_eth_wei_per_whole: row.corpEthWeiPerWhole,
        eth_usd_8dec: row.ethUsd8dec,
    };
}
export function priceDayJson(cityDay, state, inputs) {
    const samples = [];
    for (const row of state.samples)
        samples.push(sampleJson(row));
    return {
        city_day: cityDay,
        samples,
        header: {
            corp_eth_wei_per_whole: inputs.corp_eth_wei_per_whole,
            eth_usd_8dec: inputs.eth_usd_8dec,
            feed_live: inputs.feed_live,
            price_sample_city_time: inputs.price_sample_city_time,
        },
    };
}
export function publishPriceDay(store, pack, cityTime, state, inputs) {
    if (pack.priceDayPublished === 0n)
        return;
    store.putPriceDay(cityDayOf(pack, cityTime), canonical(priceDayJson(cityDayOf(pack, cityTime), state, inputs)));
}
export function corpSeriesFromPriceDay(payload) {
    const root = asObj(parseJson(fromUtf8(payload)));
    const rows = root["samples"];
    if (!Array.isArray(rows))
        return [];
    const out = [];
    for (const row of rows) {
        out.push(asBig(asObj(row)["corp_eth_wei_per_whole"]));
    }
    return out;
}
export function headerFromPriceDay(payload) {
    const hdr = asObj(asObj(parseJson(fromUtf8(payload)))["header"]);
    return {
        corp_eth_wei_per_whole: asBig(hdr["corp_eth_wei_per_whole"]),
        eth_usd_8dec: asBig(hdr["eth_usd_8dec"]),
        feed_live: asBig(hdr["feed_live"]),
        price_sample_city_time: asBig(hdr["price_sample_city_time"]),
    };
}

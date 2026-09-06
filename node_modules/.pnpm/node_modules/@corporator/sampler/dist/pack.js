import { atPath, loadPack } from "@corporator/contentpack";
import { asBig, asObj, asText, strList } from "./values.js";
function paramV(section, name) {
    const params = asObj(asObj(section)["params"]);
    return asBig(asObj(params[name])["v"]);
}
export function loadSamplerPack(bytes) {
    const loaded = loadPack(bytes);
    const pack = loaded.pack;
    const archGen = asObj(atPath(pack, ["generated", "arch"]));
    const apiGen = asObj(atPath(pack, ["generated", "api"]));
    const timeGen = asObj(atPath(pack, ["generated", "time"]));
    const arch = asObj(atPath(pack, ["sections", "arch"]));
    const economy = asObj(atPath(pack, ["sections", "economy"]));
    const sampler = asObj(asObj(arch["services"])["sampler"]);
    return {
        hash: loaded.hash,
        samplerPeriodS: asBig(apiGen["sampler_period_s"]),
        samplerPeriodMaxS: asBig(archGen["sampler_period_max_s"]),
        tickLengthS: asBig(archGen["tick_length_real_seconds"]),
        samplesPerTwapWindow: asBig(apiGen["samples_per_twap_window"]),
        samplesPerTick: asBig(archGen["sampler_samples_per_tick"]),
        ageAlertCityHours: asBig(archGen["sampler_age_alert_city_hours"]),
        stalenessMaxCityHours: paramV(economy, "price_staleness_max_city_hours"),
        ticksPerCityDay: asBig(timeGen["ticks_per_city_day"]),
        inputFields: strList(arch["sampler_input_fields"]),
        priceDayPublished: asBig(archGen["price_day_published"]),
        blocksTick: asBig(sampler["blocks_tick"]),
        failMode: asText(sampler["fail_mode"]),
        aggregation: asText(arch["aggregation"]),
    };
}
export function cityDayOf(pack, cityTime) {
    if (pack.ticksPerCityDay === 0n)
        return 0n;
    return cityTime / pack.ticksPerCityDay;
}
export function samplerPeriodOk(pack) {
    if (pack.samplerPeriodS <= 0n)
        return false;
    return pack.tickLengthS % pack.samplerPeriodS === 0n && pack.samplerPeriodS <= pack.samplerPeriodMaxS;
}
export function ageAlertBeforeStale(pack) {
    return pack.ageAlertCityHours < pack.stalenessMaxCityHours;
}

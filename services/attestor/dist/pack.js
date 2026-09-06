import { atPath, loadPack } from "@corporator/contentpack";
import { codes } from "@corporator/protocol";
import { asBig, asObj, asText, byteOf, LoadError } from "./values.js";
function paramV(section, name) {
    const params = asObj(asObj(section)["params"]);
    return asBig(asObj(params[name])["v"]);
}
function domainPrefix(value) {
    return new Uint8Array([byteOf(value)]);
}
export function loadAttestorPack(bytes) {
    const loaded = loadPack(bytes);
    const pack = loaded.pack;
    const attest = asObj(atPath(pack, ["sections", "attest"]));
    const arch = asObj(atPath(pack, ["sections", "arch"]));
    const tick = asObj(atPath(pack, ["sections", "tick"]));
    const attestGen = asObj(atPath(pack, ["generated", "attest"]));
    const timeGen = asObj(atPath(pack, ["generated", "time"]));
    const balanceGen = asObj(atPath(pack, ["generated", "balance"]));
    const services = asObj(arch["services"]);
    const attestor = asObj(services["attestor"]);
    const key = attestGen["ipfs_aggregate_key"];
    const ipfsKey = Array.isArray(key) ? key.filter((x) => typeof x === "string") : [];
    if (ipfsKey.length === 0)
        throw new LoadError(codes.API_MALFORMED);
    const cidMhLength = paramV(attest, "cid_mh_length");
    if (cidMhLength <= 0n)
        throw new LoadError(codes.API_MALFORMED);
    return {
        hash: loaded.hash,
        rootPeriodS: paramV(attest, "attest_root_period_s"),
        leafPrefix: domainPrefix(paramV(attest, "merkle_leaf_domain_byte")),
        nodePrefix: domainPrefix(paramV(attest, "merkle_node_domain_byte")),
        cidVersion: paramV(attest, "cid_version"),
        cidCodec: paramV(attest, "cid_codec"),
        cidMhCode: paramV(attest, "cid_mh_code"),
        cidMhLength,
        lagAlertTicks: paramV(arch, "attest_lag_alert_ticks"),
        ticksPerCityDay: asBig(timeGen["ticks_per_city_day"]),
        tickLengthS: asBig(balanceGen["tick_length_real_seconds"]),
        ipfsKey,
        failureMode: asText(attestGen["attest_failure_mode"]),
        blocksTick: asBig(attestor["blocks_tick"]),
        failMode: asText(attestor["fail_mode"]),
        layoutVersion: paramV(tick, "layout_version"),
    };
}
export function cityDayOf(pack, cityTime) {
    if (pack.ticksPerCityDay === 0n)
        return 0n;
    return cityTime / pack.ticksPerCityDay;
}
export function aggregateKey(cityId, cityDay) {
    return cityId + "/" + cityDay.toString();
}
export function keyIsCityDay(pack) {
    return pack.ipfsKey.includes("city_id") && pack.ipfsKey.includes("city_day") && !pack.ipfsKey.includes("wall_hour");
}
export function domainsDiffer(pack) {
    if (pack.leafPrefix.length !== 1 || pack.nodePrefix.length !== 1)
        return false;
    return pack.leafPrefix[0] !== pack.nodePrefix[0];
}
export function rootPeriodOk(pack) {
    if (pack.rootPeriodS <= 0n)
        return false;
    if (pack.rootPeriodS > pack.tickLengthS)
        return false;
    return true;
}

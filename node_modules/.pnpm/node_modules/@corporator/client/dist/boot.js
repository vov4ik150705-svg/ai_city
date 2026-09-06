import { loadPack, parseJson, fromUtf8 } from "@corporator/contentpack";
import { codes, packTemplate, stateTemplate } from "@corporator/protocol";
import { applyPath } from "./command.js";
import { asObj, asBig } from "./values.js";
function sectionBig(sections, id) {
    const val = sections[id];
    if (typeof val === "bigint")
        return val;
    return 0n;
}
function potBig(row, id) {
    const val = row[id];
    if (typeof val === "bigint")
        return val;
    return 0n;
}
function prizeFromSections(sections) {
    let prizeNoticeKey = "";
    const prizeBasket = [];
    const raw = sections["seasons.prize_basket"];
    if (raw !== undefined && raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        const obj = raw;
        const notice = obj["notice"];
        if (typeof notice === "string")
            prizeNoticeKey = notice;
        for (const ticker of Object.keys(obj)) {
            if (ticker === "notice")
                continue;
            const row = obj[ticker];
            if (row === null || typeof row !== "object" || Array.isArray(row))
                continue;
            const pots = row;
            prizeBasket.push({ ticker, farm: potBig(pots, "farm"), month: potBig(pots, "month") });
        }
    }
    return {
        prizeNoticeKey,
        protocolEthInFlight: sectionBig(sections, "wallet.protocol_eth_in_flight"),
        protocolVaultCorp: sectionBig(sections, "wallet.protocol_vault_corp"),
        protocolStudioEth: sectionBig(sections, "wallet.protocol_studio_eth"),
        prizeBasket,
    };
}
function logFromSections(sections) {
    const raw = sections["log.events"];
    if (raw === undefined || raw === null || typeof raw !== "object" || Array.isArray(raw))
        return [];
    const obj = raw;
    const rows = obj["rows"];
    if (!Array.isArray(rows))
        return [];
    const out = [];
    for (const item of rows) {
        if (item === null || typeof item !== "object" || Array.isArray(item))
            continue;
        const row = item;
        const id = row["id"];
        const key = row["key"];
        const badge = row["badge"];
        const root = row["root"];
        const cid = row["cid"];
        if (typeof id !== "string" || typeof key !== "string")
            continue;
        out.push({
            id,
            key,
            badge: typeof badge === "string" ? badge : "",
            root: typeof root === "string" ? root : "",
            cid: typeof cid === "string" ? cid : "",
        });
    }
    return out;
}
export function snapshotFromEnvelope(body) {
    const obj = asObj(body);
    if (!("city_time" in obj))
        throw new Error(codes.API_PACK_STALE);
    const sectionsRaw = obj["sections"];
    const sections = sectionsRaw === undefined ? {} : asObj(sectionsRaw);
    const kind = obj["account_kind"];
    const prize = prizeFromSections(sections);
    return {
        cityTime: asBig(obj["city_time"]),
        accountKind: typeof kind === "string" ? kind : "wallet",
        capital: sectionBig(sections, "tick.capital"),
        corp: sectionBig(sections, "wallet.corp_balance"),
        energy: sectionBig(sections, "tick.energy"),
        compute: sectionBig(sections, "tick.compute"),
        population: 0n,
        payrollRatioBps: sectionBig(sections, "aggregate.payroll_ratio"),
        gdp: sectionBig(sections, "aggregate.gdp"),
        happiness: sectionBig(sections, "aggregate.happiness"),
        stability: sectionBig(sections, "aggregate.stability"),
        stocks: [],
        agents: [],
        log: logFromSections(sections),
        prizeNoticeKey: prize.prizeNoticeKey,
        protocolEthInFlight: prize.protocolEthInFlight,
        protocolVaultCorp: prize.protocolVaultCorp,
        protocolStudioEth: prize.protocolStudioEth,
        prizeBasket: prize.prizeBasket,
    };
}
export async function bootFromHost(args) {
    try {
        const packPath = applyPath(packTemplate, "pack_hash", args.packHash);
        const packBytes = await args.fetchBytes(args.origin + packPath);
        const loaded = loadPack(packBytes);
        if (loaded.hash !== args.packHash)
            return { ok: false, code: codes.API_PACK_STALE };
        const statePath = applyPath(stateTemplate, "city_id", args.cityId);
        const stateBytes = await args.fetchBytes(args.origin + statePath);
        const envelope = parseJson(fromUtf8(stateBytes));
        const snapshot = snapshotFromEnvelope(envelope);
        return {
            ok: true,
            packBytes,
            packJson: loaded.pack,
            snapshot,
            cityTime: snapshot.cityTime,
            accountKind: snapshot.accountKind,
            packHash: loaded.hash,
        };
    }
    catch {
        return { ok: false, code: codes.API_PACK_STALE };
    }
}
export function originFromListen(bind, port) {
    return "http://" + bind + ":" + port.toString();
}

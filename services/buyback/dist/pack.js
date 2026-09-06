import { atPath, loadPack } from "@corporator/contentpack";
import { LoadError, asBig, asObj, asText, strList } from "./values.js";
import { codes } from "@corporator/protocol";
const REF_SKIP = new Set(["src", "why"]);
function paramV(section, name) {
    const params = asObj(asObj(section)["params"]);
    return asBig(asObj(params[name])["v"]);
}
function resolveParamRef(root, ref) {
    const dot = ".";
    const i = ref.indexOf(dot);
    if (i <= 0)
        throw new LoadError(codes.API_MALFORMED);
    const section = ref.slice(0, i);
    const rest = ref.slice(i + 1);
    const j = rest.indexOf(dot);
    if (j <= 0)
        throw new LoadError(codes.API_MALFORMED);
    const kind = rest.slice(0, j);
    const name = rest.slice(j + 1);
    if (name.length === 0 || name.includes(dot) || kind !== "params") {
        throw new LoadError(codes.API_MALFORMED);
    }
    return paramV(asObj(atPath(root, ["sections", section])), name);
}
function isStampField(name) {
    return (name === "eth_collected" ||
        name === "corp_bought" ||
        name === "deposit_confirmed" ||
        name === "mint");
}
function orderOf(names) {
    const out = [];
    for (const name of names) {
        if (!isStampField(name))
            throw new LoadError(codes.API_MALFORMED);
        out.push(name);
    }
    return out;
}
export function loadBuybackPack(bytes) {
    const loaded = loadPack(bytes);
    const pack = loaded.pack;
    const arch = asObj(atPath(pack, ["sections", "arch"]));
    const launch = asObj(atPath(pack, ["sections", "launch"]));
    const economy = asObj(atPath(pack, ["sections", "economy"]));
    const meta = asObj(atPath(pack, ["sections", "meta"]));
    const refs = asObj(arch["buyback_refs"]);
    const resolved = {};
    for (const key of Object.keys(refs)) {
        if (REF_SKIP.has(key))
            continue;
        resolved[key] = resolveParamRef(pack, asText(refs[key]));
    }
    const cadence = resolved["cadence"];
    const trancheCapBps = resolved["tranche_cap_bps"];
    const minBatchWei = resolved["min_batch_wei"];
    const slippageSafety = resolved["slippage_safety"];
    if (cadence === undefined ||
        trancheCapBps === undefined ||
        minBatchWei === undefined ||
        slippageSafety === undefined) {
        throw new LoadError(codes.API_MALFORMED);
    }
    const burn = paramV(economy, "spend_burn_bps");
    const fund = paramV(economy, "spend_fund_bps");
    const proto = paramV(economy, "spend_protocol_bps");
    const bps = burn + fund + proto;
    if (bps <= 0n)
        throw new LoadError(codes.API_MALFORMED);
    const keys = asObj(arch["keys"]);
    const buy = asObj(keys["buyback_executor"]);
    const voucher = asObj(keys["voucher_signer"]);
    const payer = asObj(keys["prize_payer"]);
    const services = asObj(arch["services"]);
    const buyback = asObj(services["buyback"]);
    const seasons = asObj(atPath(pack, ["sections", "seasons"]));
    const frag = asObj(atPath(pack, ["sections", "fragments"]));
    const seasonsG = asObj(atPath(pack, ["generated", "seasons"]));
    const fragG = asObj(atPath(pack, ["generated", "fragments"]));
    const tickers = strList(seasonsG["prize_assets"]);
    if (tickers.length === 0)
        throw new LoadError(codes.API_MALFORMED);
    const quoteRaw = asObj(fragG["quote_asset_by_ticker"]);
    const quoteAssetByTicker = {};
    for (const ticker of tickers) {
        quoteAssetByTicker[ticker] = asText(quoteRaw[ticker]);
    }
    return {
        hash: loaded.hash,
        cadence,
        trancheCapBps,
        minBatchWei,
        slippageSafety,
        slippageSafetyMin: paramV(meta, "buyback_slippage_safety_min"),
        capitalAnchor: paramV(economy, "capital_anchor"),
        creatorTaxBps: paramV(economy, "creator_tax_bps"),
        bps,
        order: orderOf(strList(arch["buyback_order"])),
        executorService: asText(buy["service"]),
        voucherService: asText(voucher["service"]),
        payerService: asText(payer["service"]),
        blocksTick: asBig(buyback["blocks_tick"]),
        failMode: asText(buyback["fail_mode"]),
        depthHalfWei: paramV(launch, "risk4_depth_half_eth_day_wei"),
        depthTwoWei: paramV(launch, "risk4_depth_two_eth_day_wei"),
        depthTenWei: paramV(launch, "risk4_depth_ten_eth_day_wei"),
        prizeShareBps: paramV(seasons, "prize_creator_tax_share_bps"),
        studioShareBps: paramV(economy, "studio_eth_share_bps"),
        hopHaircutBps: paramV(frag, "fragment_hop_haircut_bps"),
        tickers,
        quoteAssetByTicker,
        studioRecipient: asText(economy["studio_eth_recipient"], ""),
        basketOrder: strList(arch["basket_order"]),
    };
}

import { createElement } from "react";
import { codes } from "@corporator/protocol";
export function blockingRefusal(args) {
    if (args.action.v1 === "stub") {
        return { code: codes.FEATURE_NOT_IN_V1, rest: [] };
    }
    const failed = new Set(args.failed);
    const skipDemoTok = !(args.demo && args.isolated && args.action.demoBlocked);
    if (!skipDemoTok) {
        for (const tok of args.action.requires) {
            if (tok.startsWith("not_demo_"))
                failed.add(tok);
        }
    }
    const gates = [];
    for (const tok of args.action.requires) {
        if (skipDemoTok && tok.startsWith("not_demo_"))
            continue;
        const cap = args.capabilities[tok];
        if (cap === undefined || cap.kind !== "blocking")
            continue;
        gates.push({ token: tok, code: cap.code, tier: cap.tier });
    }
    gates.sort((a, b) => {
        if (a.tier !== b.tier)
            return a.tier < b.tier ? -1 : 1;
        if (a.token < b.token)
            return -1;
        if (a.token > b.token)
            return 1;
        return 0;
    });
    const fallen = gates.filter((g) => failed.has(g.token));
    const shown = [];
    const rest = [];
    let n = 0n;
    for (const g of fallen) {
        if (n < args.showCount)
            shown.push(g.code);
        else
            rest.push(g.code);
        n += 1n;
    }
    const first = shown[0];
    return { code: first, rest };
}
export function failedTokens(args) {
    const out = new Set();
    if (args.demo) {
        out.add("not_demo_withdraw");
        out.add("not_demo_claim");
        out.add("not_demo_prize");
        out.add("not_demo_companion");
    }
    if (!args.walletConnected)
        out.add("wallet");
    if (!args.capitalPositive)
        out.add("capital");
    if (!args.corpPositive)
        out.add("corp");
    if (!args.bankOpen)
        out.add("bank_open");
    if (args.bankSunday)
        out.add("bank_weekday");
    if (args.buildTileIllegal)
        out.add("build_tile");
    out.add("v1_feature");
    return out;
}
export function Refusal(props) {
    return createElement("span", { "data-refusal": props.code, className: "hud-refusal", title: props.rest.join(" ") }, props.text);
}

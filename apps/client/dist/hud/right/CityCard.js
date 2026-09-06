import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Empty } from "../parts/Empty.js";
import { Panel } from "../parts/Panel.js";
import { Value } from "../parts/Value.js";
export function ProtocolPlaque(props) {
    return (_jsxs("div", { "data-key": "UI_PROTOCOL", children: [props.view.protocol.map((p) => (_jsxs("p", { "data-key": p.key, className: "hud-row", children: [_jsx("span", { className: "hud-muted", children: p.caption }), _jsx("span", { children: p.value })] }, p.id))), props.view.basket.map((b) => (_jsxs("p", { "data-ticker": b.ticker, className: "hud-row", children: [b.ticker, " ", b.farm] }, b.ticker)))] }));
}
export function CityCard(props) {
    return (_jsxs(Panel, { id: "city", title: props.title, titleKey: props.titleKey, children: [_jsxs("p", { "data-key": props.view.treasury.key, className: "hud-row", children: [_jsx("span", { className: "hud-muted", children: props.view.treasury.caption }), _jsx(Value, { display: props.view.treasury.value, exact: props.view.treasury.exact })] }), _jsx(ProtocolPlaque, { view: props.view }), props.view.prizeNotice ? (_jsx("p", { "data-key": props.view.prizeNotice.key, className: "hud-row hud-row--trim", children: props.view.prizeNotice.text })) : null, _jsx("p", { "data-key": "UI_PRIZE_PERIOD", className: "hud-row hud-muted", children: props.view.periodHours })] }));
}
export function AgentsPanel(props) {
    return (_jsxs(Panel, { id: "agents", title: props.title, titleKey: props.titleKey, children: [props.view.agents.map((a) => (_jsx("div", { "data-key": a.idleKey, className: "hud-row", children: a.idleText }, a.id))), props.view.agents.length === 0 ? _jsx(Empty, { textKey: "UI_EMPTY_NO_ENTITIES", text: props.view.agentsEmpty }) : null, _jsx("button", { type: "button", className: "hud-hire", "data-key": "UI_HIRE", onClick: props.onHire, children: props.view.hireText })] }));
}
export function LogPanel(props) {
    const rows = [...props.view.log, ...props.extra.map((a) => ({
            id: a.id,
            key: a.key,
            text: a.text,
            badgeKey: "UI_ATTEST_LOGGED",
            badgeText: "",
            root: "",
            cid: "",
        }))].filter((a) => {
        if (props.needle.length === 0)
            return true;
        return a.key.startsWith(props.needle);
    });
    return (_jsxs(Panel, { id: "log", title: props.title, titleKey: props.titleKey, children: [_jsx("button", { type: "button", "data-action": "log_filter_companion", "data-on": props.needle.length === 0 ? "0" : "1", onClick: props.onFilter, children: props.filterLabel }), rows.map((a) => (_jsxs("div", { "data-key": a.key, className: "hud-log", children: [_jsx("span", { children: a.text }), a.badgeText.length > 0 ? (_jsx("button", { type: "button", "data-attest": a.badgeKey, onClick: () => {
                            props.onBadge(a.id);
                        }, children: a.badgeText })) : null, props.openId === a.id ? (_jsxs("div", { "data-key": "UI_ATTEST_PROOF", children: [_jsx("span", { "data-field": "root", children: a.root }), _jsx("span", { "data-field": "cid", children: a.cid })] })) : null] }, a.id))), rows.length === 0 ? _jsx(Empty, { textKey: "UI_EMPTY_NO_ENTITIES", text: props.view.logEmpty }) : null] }));
}
export function DistrictOverview(props) {
    return (_jsx(Panel, { id: "schema", title: props.title, titleKey: props.titleKey, children: _jsx("div", { className: "hud-schema", children: props.rows.map((d) => (_jsx("div", { "data-district": d.id, "data-ticker": d.ticker, className: "hud-schema__cell", onClick: () => {
                    props.onLook(d.id);
                }, children: d.ticker }, d.id))) }) }));
}

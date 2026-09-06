import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Empty } from "../parts/Empty.js";
import { Panel } from "../parts/Panel.js";
import { Value } from "../parts/Value.js";
export function Overview(props) {
    return (_jsxs(Panel, { id: "overview", title: props.title, titleKey: props.titleKey, children: [props.rows.map((line) => (_jsxs("p", { "data-key": line.key, className: line.tone === "ok" ? "hud-row" : `hud-row hud-row--${line.tone}`, children: [_jsx("span", { className: "hud-muted", children: line.caption }), _jsx(Value, { display: line.value, exact: line.exact })] }, line.id))), props.payroll ? (_jsx("p", { "data-key": props.payroll.key, className: "hud-row hud-row--trim", children: props.payroll.text })) : null] }));
}
export function ActiveEvents(props) {
    return (_jsx(Panel, { id: "events", title: props.title, titleKey: props.titleKey, children: _jsx(Empty, { textKey: "UI_EMPTY_NO_EVENTS", text: props.empty }) }));
}
export function DistrictsPanel(props) {
    return (_jsx(Panel, { id: "districts", title: props.title, titleKey: props.titleKey, children: props.rows.map((d) => (_jsxs("div", { "data-district": d.id, "data-ticker": d.ticker, className: d.tone === "ok" ? "hud-district" : `hud-district hud-district--${d.tone}`, onClick: () => {
                props.onLook(d.id);
            }, children: [_jsx("span", { className: "hud-district__t", children: d.ticker }), _jsx("span", { className: "hud-muted", children: d.role }), _jsx("span", { className: "hud-district__fx", children: d.effect })] }, d.id))) }));
}

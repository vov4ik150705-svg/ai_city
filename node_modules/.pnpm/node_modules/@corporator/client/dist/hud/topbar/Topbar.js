import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { screens } from "@corporator/protocol";
import { BankPlaque } from "./BankPlaque.js";
import { CapitalSlot } from "./CapitalSlot.js";
import { ClockSlot } from "./ClockSlot.js";
import { Value } from "../parts/Value.js";
export function Topbar(props) {
    return (_jsxs("header", { "data-surface": screens.topbar, className: "hud-panel hud-topbar", children: [_jsx("span", { className: "hud-brand", "data-key": "UI_TOPBAR", children: props.brand }), props.view.topbar.map((row) => {
                if (row.id === "settings") {
                    return (_jsx("button", { type: "button", "data-key": row.key, "data-id": row.id, className: "hud-metric", onClick: () => props.onNavigate("settings"), children: _jsx("span", { className: "hud-metric__k", children: row.caption }) }, row.id));
                }
                if (row.id === "corp") {
                    return (_jsxs("button", { type: "button", "data-key": row.key, "data-id": row.id, className: "hud-metric", onClick: () => props.onNavigate("bank"), children: [row.caption.length > 0 ? _jsx("span", { className: "hud-metric__k", children: row.caption }) : null, _jsx(Value, { className: "hud-metric__v", display: row.value, exact: row.exact })] }, row.id));
                }
                if (row.id === "capital") {
                    return (_jsx(CapitalSlot, { caption: row.caption, captionKey: row.key, display: row.value, exact: row.exact }, row.id));
                }
                if (row.id === "clock") {
                    return _jsx(ClockSlot, { value: row.value, valueKey: row.key }, row.id);
                }
                return (_jsxs("span", { "data-key": row.key, "data-id": row.id, className: "hud-metric", children: [row.caption.length > 0 ? _jsx("span", { className: "hud-metric__k", children: row.caption }) : null, _jsx(Value, { className: "hud-metric__v", display: row.value, exact: row.exact })] }, row.id));
            }), _jsx(BankPlaque, { plaque: props.view.plaque })] }));
}

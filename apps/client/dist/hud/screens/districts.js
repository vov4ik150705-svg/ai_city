import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function DistrictsScreen(props) {
    return (_jsxs(ScreenFrame, { id: "districts", view: props.view, loading: props.loading, empty: props.view.districts.length === 0, onClose: props.onClose, children: [_jsx("ul", { className: "hud-list", children: props.view.districts.map((d) => (_jsx("li", { children: _jsx("button", { type: "button", "data-district": d.id, onClick: () => props.onNavigate("district_card"), children: d.ticker }) }, d.id))) }), _jsx(ActionButton, { ...props, actionId: "districts_open" }), _jsx(ActionButton, { ...props, actionId: "districts_to_exchange" })] }));
}

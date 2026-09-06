import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Value } from "../parts/Value.js";
export function CapitalSlot(props) {
    return (_jsxs("span", { "data-key": props.captionKey, "data-id": "capital", className: "hud-metric hud-metric--hero", children: [_jsx("span", { className: "hud-metric__k", children: props.caption }), _jsx(Value, { className: "hud-metric__v", display: props.display, exact: props.exact })] }));
}

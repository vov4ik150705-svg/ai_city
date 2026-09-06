import { jsx as _jsx } from "react/jsx-runtime";
export function ClockSlot(props) {
    return (_jsx("span", { "data-key": props.valueKey, "data-id": "clock", className: "hud-metric", children: _jsx("span", { className: "hud-metric__v", children: props.value }) }));
}

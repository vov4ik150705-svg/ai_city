import { jsx as _jsx } from "react/jsx-runtime";
export function BankPlaque(props) {
    const warn = props.plaque.key === "BANK_CLOSED" || props.plaque.key === "BANK_SUNDAY";
    const tone = warn ? "hud-plaque--warn" : "hud-plaque--ok";
    return (_jsx("span", { "data-key": props.plaque.key, className: `hud-plaque ${tone}`, children: props.plaque.text }));
}

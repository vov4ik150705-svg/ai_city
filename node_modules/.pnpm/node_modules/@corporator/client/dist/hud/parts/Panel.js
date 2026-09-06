import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Panel(props) {
    return (_jsxs("section", { "data-key": props.titleKey, "data-id": props.id, className: "hud-panel hud-card", children: [_jsx("h2", { className: "hud-card__h", children: props.title }), props.children] }));
}

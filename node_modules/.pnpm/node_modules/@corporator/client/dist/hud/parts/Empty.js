import { jsx as _jsx } from "react/jsx-runtime";
export function Empty(props) {
    return (_jsx("p", { "data-key": props.textKey, className: "hud-muted", children: props.text }));
}

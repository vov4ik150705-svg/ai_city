import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Empty } from "./Empty.js";
import { Loading } from "./Loading.js";
export function ScreenFrame(props) {
    const chrome = props.view.chrome[props.id];
    const titleKey = chrome === undefined ? "" : chrome.titleKey;
    const title = chrome === undefined ? "" : chrome.title;
    const emptyKey = chrome === undefined ? "" : chrome.emptyKey;
    const emptyText = chrome === undefined ? "" : chrome.emptyText;
    const loadingKind = chrome === undefined ? "" : chrome.loadingKind;
    const mount = chrome === undefined ? "fullscreen" : chrome.mount;
    return (_jsxs("section", { "data-screen": props.id, "data-mount": mount, "data-loading-kind": loadingKind, "data-empty-kind": chrome === undefined ? "" : chrome.emptyKind, className: `hud-screen hud-screen--${mount}`, children: [_jsxs("header", { className: "hud-screen__bar", children: [_jsx("h1", { "data-key": titleKey, className: "hud-screen__h", children: title }), _jsx("button", { type: "button", "data-key": props.view.close.key, className: "hud-screen__x", onClick: props.onClose, children: props.view.close.text })] }), props.loading ? _jsx(Loading, { kind: loadingKind }) : null, !props.loading && props.empty ? _jsx(Empty, { textKey: emptyKey, text: emptyText }) : null, !props.loading ? props.children : null] }));
}

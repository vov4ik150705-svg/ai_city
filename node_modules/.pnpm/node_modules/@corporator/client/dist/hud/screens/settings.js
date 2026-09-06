import { jsx as _jsx } from "react/jsx-runtime";
import { lookup } from "../../strings.js";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function SettingsScreen(props) {
    const used = new Set();
    return (_jsx(ScreenFrame, { id: "settings", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: _jsx("ul", { className: "hud-list", children: props.pack.settingsRows.map((row) => (_jsx("li", { "data-setting": row.id, "data-v1": row.v1, children: row.id === "autopilot" ? (_jsx(ActionButton, { ...props, actionId: "settings_open_companion" })) : (lookup(props.strings, row.labelKey, used)) }, row.id))) }) }));
}

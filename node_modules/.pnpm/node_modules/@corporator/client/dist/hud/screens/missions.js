import { jsx as _jsx } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function MissionsScreen(props) {
    return (_jsx(ScreenFrame, { id: "missions", view: props.view, loading: props.loading, empty: true, onClose: props.onClose, children: _jsx(ActionButton, { ...props, actionId: "missions_start" }) }));
}

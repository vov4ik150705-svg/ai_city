import { jsx as _jsx } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function OfflineReturnScreen(props) {
    return (_jsx(ScreenFrame, { id: "offline_return", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: _jsx(ActionButton, { ...props, actionId: "offline_continue" }) }));
}

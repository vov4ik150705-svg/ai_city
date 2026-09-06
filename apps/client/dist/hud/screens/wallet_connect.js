import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function WalletConnectScreen(props) {
    return (_jsxs(ScreenFrame, { id: "wallet_connect", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: [_jsx(ActionButton, { ...props, actionId: "wallet_connect_start" }), _jsx(ActionButton, { ...props, actionId: "wallet_confirm" })] }));
}

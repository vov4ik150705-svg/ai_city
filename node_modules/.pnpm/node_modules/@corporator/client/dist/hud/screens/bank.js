import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
import { Value } from "../parts/Value.js";
export function BankScreen(props) {
    return (_jsxs(ScreenFrame, { id: "bank", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: [_jsx("p", { "data-mint-rate": props.view.mintRate, children: _jsx(Value, { display: props.view.mintRate, exact: props.view.mintRate }) }), _jsx("p", { "data-bank-limit": props.view.bankLimit, children: _jsx(Value, { display: props.view.bankLimit, exact: props.view.bankLimit }) }), _jsx(ActionButton, { ...props, actionId: "bank_deposit" }), _jsx(ActionButton, { ...props, actionId: "bank_withdraw" })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
import { Value } from "../parts/Value.js";
export function ExchangeScreen(props) {
    return (_jsxs(ScreenFrame, { id: "exchange", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: [_jsxs("p", { "data-quote-lo": props.view.quoteLo, "data-quote-hi": props.view.quoteHi, children: [_jsx(Value, { display: props.view.quoteLo, exact: props.view.quoteLo }), _jsx(Value, { display: props.view.quoteHi, exact: props.view.quoteHi })] }), _jsx(ActionButton, { ...props, actionId: "exchange_buy" })] }));
}

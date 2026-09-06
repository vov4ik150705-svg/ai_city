import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function DistrictCardScreen(props) {
    return (_jsxs(ScreenFrame, { id: "district_card", view: props.view, loading: props.loading, empty: props.view.districts.length === 0, onClose: props.onClose, children: [_jsx(ActionButton, { ...props, actionId: "district_claim_fragment" }), _jsx(ActionButton, { ...props, actionId: "district_unlock_tier" }), _jsx(ActionButton, { ...props, actionId: "district_stake_more" })] }));
}

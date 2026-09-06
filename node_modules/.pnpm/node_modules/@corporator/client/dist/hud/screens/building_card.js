import { jsx as _jsx } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function BuildingCardScreen(props) {
    return (_jsx(ScreenFrame, { id: "building_card", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: _jsx(ActionButton, { ...props, actionId: "building_upgrade" }) }));
}

import { jsx as _jsx } from "react/jsx-runtime";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function ResearchScreen(props) {
    return (_jsx(ScreenFrame, { id: "research", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: _jsx("p", { "data-research": "1" }) }));
}

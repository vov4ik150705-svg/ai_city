import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function AgentCardScreen(props) {
    const empty = props.view.agents.length === 0;
    return (_jsxs(ScreenFrame, { id: "agent_card", view: props.view, loading: props.loading, empty: empty, onClose: props.onClose, children: [_jsx("ul", { className: "hud-list", children: props.view.agents.map((row) => (_jsx("li", { "data-key": row.idleKey, children: row.idleText }, row.id))) }), _jsx(ActionButton, { ...props, actionId: "agent_set_objective" })] }));
}

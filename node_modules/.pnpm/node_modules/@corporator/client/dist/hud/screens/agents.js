import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function AgentsScreen(props) {
    return (_jsxs(ScreenFrame, { id: "agents", view: props.view, loading: props.loading, empty: props.view.agents.length === 0, onClose: props.onClose, children: [_jsx(ActionButton, { ...props, actionId: "agents_hire" }), _jsx("ul", { className: "hud-list", children: props.view.agents.map((row) => (_jsx("li", { children: _jsx("button", { type: "button", "data-agent": row.id, onClick: () => props.onNavigate("agent_card"), children: _jsx("span", { "data-key": row.idleKey, children: row.idleText }) }) }, row.id))) })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function LeaderboardScreen(props) {
    const empty = props.view.basket.length === 0;
    return (_jsxs(ScreenFrame, { id: "leaderboard", view: props.view, loading: props.loading, empty: empty, onClose: props.onClose, children: [_jsx("p", { "data-period": props.view.periodHours, children: props.view.periodHours }), _jsx("ul", { className: "hud-list", children: props.view.basket.map((row) => (_jsx("li", { "data-ticker": row.ticker, children: row.ticker }, row.ticker))) }), _jsx(ActionButton, { ...props, actionId: "leaderboard_claim" })] }));
}

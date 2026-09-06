import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { screens } from "@corporator/protocol";
export function StockBar(props) {
    return (_jsx("div", { "data-surface": screens.stock_bar, className: "hud-panel hud-stocks", children: props.stocks.map((s) => (_jsxs("div", { className: "hud-stock", "data-ticker": s.ticker, children: [_jsx("div", { className: "hud-stock__t", children: s.ticker }), _jsx("div", { className: "hud-stock__n", "data-stock-market": true, children: s.price }), _jsx("div", { className: s.tone === "ok" ? "hud-stock__n hud-muted" : `hud-stock__n hud-row--${s.tone}`, children: s.dayPct }), _jsx("div", { className: "hud-stock__n hud-muted", "data-stock-effect": true, children: s.effect })] }, s.ticker))) }));
}
export function BottomMenu(props) {
    return (_jsx("nav", { "data-surface": screens.bottom_menu, className: "hud-panel hud-menu", children: props.items.map((item) => (_jsx("button", { type: "button", "data-key": item.key, "data-blocked": item.blocked ? "1" : "0", disabled: item.blocked, onClick: () => {
                if (item.target.length > 0)
                    props.onNavigate(item.target);
            }, children: item.text }, item.id))) }));
}

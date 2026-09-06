import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { lookup } from "../../strings.js";
import { blockingRefusal, Refusal } from "../parts/refusal.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function BuildScreen(props) {
    const used = new Set();
    const action = props.pack.actions["build_place"];
    const hit = action === undefined
        ? { code: undefined, rest: [] }
        : blockingRefusal({
            action,
            capabilities: props.pack.capabilities,
            demo: props.demo,
            isolated: props.pack.demoIsolated,
            failed: props.failed,
            showCount: props.pack.refusalShowCount,
        });
    const blocked = hit.code !== undefined;
    const codeText = hit.code === undefined ? "" : lookup(props.strings, hit.code, used);
    return (_jsxs(ScreenFrame, { id: "build", view: props.view, loading: props.loading, empty: props.pack.catalog.length === 0, onClose: props.onClose, children: [blocked && hit.code !== undefined ? _jsx(Refusal, { code: hit.code, text: codeText, rest: hit.rest }) : null, _jsx("ul", { className: "hud-list", children: props.pack.catalog.map((row) => {
                    const key = "UI_BLD_" + row.id.toUpperCase();
                    const label = lookup(props.strings, key, used);
                    return (_jsx("li", { children: _jsx("button", { type: "button", "data-building": row.id, "data-action": "build_place", disabled: blocked, onClick: () => {
                                if (blocked)
                                    return;
                                props.onCommit("build", {
                                    building_id: row.id,
                                    tile_x: props.pendingTileX,
                                    tile_y: props.pendingTileY,
                                });
                            }, children: label }) }, row.id));
                }) })] }));
}

import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
import { navigateTarget } from "../../packview.js";
import { lookup, labelKey } from "../../strings.js";
import { blockingRefusal, Refusal } from "./refusal.js";
const COMMIT = "commit:";
export function ActionButton(props) {
    const action = props.pack.actions[props.actionId];
    if (action === undefined)
        return _jsx(_Fragment, {});
    const effect = action.effect;
    const used = new Set();
    const label = lookup(props.strings, labelKey(action.label), used);
    const hit = blockingRefusal({
        action,
        capabilities: props.pack.capabilities,
        demo: props.demo,
        isolated: props.pack.demoIsolated,
        failed: props.failed,
        showCount: props.pack.refusalShowCount,
    });
    const blocked = hit.code !== undefined;
    const codeText = hit.code === undefined ? "" : lookup(props.strings, hit.code, used);
    function go() {
        if (blocked)
            return;
        if (effect.startsWith(COMMIT)) {
            props.onCommit(effect.slice(COMMIT.length));
            return;
        }
        const dest = navigateTarget(effect);
        if (dest !== undefined) {
            props.onNavigate(dest);
            return;
        }
        props.onLocal(effect);
    }
    return (_jsx("button", { type: "button", "data-action": props.actionId, "data-blocked": blocked ? "1" : "0", "data-blocked-code": hit.code ?? "", disabled: blocked, onClick: go, children: blocked && hit.code !== undefined ? _jsx(Refusal, { code: hit.code, text: codeText, rest: hit.rest }) : label }));
}

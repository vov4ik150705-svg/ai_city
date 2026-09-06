import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { codes } from "@corporator/protocol";
import { lookup } from "../../strings.js";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
import { Value } from "../parts/Value.js";
export function journalMatchesCompanion(key, needle) {
    if (key === codes.DEMO_NO_COMPANION)
        return true;
    return needle.length > 0 && key.startsWith(needle);
}
export function filterNeedle(effect) {
    const prefix = "filter:";
    if (!effect.startsWith(prefix))
        return "";
    return effect.slice(prefix.length);
}
export function autopilotJournalCode(nextOn) {
    return nextOn ? codes.COMPANION_ACTED : codes.COMPANION_OFF;
}
export function CompanionScreen(props) {
    const used = new Set();
    const pack = props.pack;
    const filter = pack.actions["companion_filter"];
    const needle = filter === undefined ? "" : filterNeedle(filter.effect);
    const relief = pack.companionReliefBps.toString();
    const cmdCap = pack.companionCmdPerTick.toString();
    const depth = pack.companionAdvisorDepth.toString();
    const calls = pack.companionAdvisorCalls.toString();
    const cool = pack.companionAdvisorCooldown.toString();
    const windowCap = pack.companionOfflineCap.toString();
    const log = [...props.view.log, ...props.journalExtra].filter((row) => journalMatchesCompanion(row.key, needle));
    return (_jsx(ScreenFrame, { id: "companion", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: _jsxs("div", { className: "hud-companion", "data-autopilot": props.autopilotOn ? "1" : "0", children: [_jsx("p", { "data-key": "UI_PERSONA", children: lookup(props.strings, "UI_PERSONA", used) }), _jsxs("p", { "data-key": "UI_IDLE_RELIEF", children: [lookup(props.strings, "UI_IDLE_RELIEF", used), " ", _jsx(Value, { display: relief, exact: relief })] }), _jsxs("p", { "data-key": "UI_COMPANION_WINDOW", children: [lookup(props.strings, "UI_COMPANION_WINDOW", used), " ", _jsx(Value, { display: windowCap, exact: windowCap })] }), pack.companionCarryOver === 0n ? (_jsx("p", { "data-key": "UI_COMPANION_CARRY", children: lookup(props.strings, "UI_COMPANION_CARRY", used) })) : null, _jsxs("p", { "data-key": "UI_COMPANION_LIMITS", children: [lookup(props.strings, "UI_COMPANION_LIMITS", used), " ", cmdCap, " ", depth, " ", calls, " ", cool] }), _jsxs("p", { "data-key": "UI_ADVISOR_CALLS", children: [lookup(props.strings, "UI_ADVISOR_CALLS", used), " ", _jsx(Value, { display: calls, exact: calls })] }), _jsx("ul", { className: "hud-list", "data-key": "UI_COMPANION_COMMANDS", children: pack.companionCommands.map((cmd) => (_jsx("li", { "data-command": cmd.id, children: cmd.id }, cmd.id))) }), _jsx(ActionButton, { ...props, actionId: "companion_toggle" }), _jsx(ActionButton, { ...props, actionId: "companion_ask_advisor" }), _jsx(ActionButton, { ...props, actionId: "companion_filter" }), _jsx("div", { "data-journal": "companion", children: log.map((row) => (_jsx("div", { "data-key": row.key, className: "hud-log", children: row.text }, row.id))) })] }) }));
}

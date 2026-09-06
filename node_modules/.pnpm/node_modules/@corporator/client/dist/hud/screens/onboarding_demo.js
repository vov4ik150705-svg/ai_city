import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ActionButton } from "../parts/ActionButton.js";
import { ScreenFrame } from "../parts/ScreenFrame.js";
export function OnboardingDemoScreen(props) {
    return (_jsxs(ScreenFrame, { id: "onboarding_demo", view: props.view, loading: props.loading, empty: false, onClose: props.onClose, children: [_jsx("ol", { "data-onboard": "1", children: props.pack.onboardSteps.map((step) => (_jsx("li", { "data-step": step.step.toString(), "data-onboard-id": step.id, children: step.codes.map((code) => (_jsx("span", { "data-code": code }, code))) }, step.id))) }), _jsx(ActionButton, { ...props, actionId: "onboard_next" }), _jsx(ActionButton, { ...props, actionId: "onboard_wallet_offer" })] }));
}

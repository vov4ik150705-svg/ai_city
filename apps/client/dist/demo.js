import { codes } from "@corporator/protocol";
export function attemptAction(args) {
    if (args.demo && args.isolated && args.action.demoBlocked) {
        for (const req of args.action.requires) {
            if (!req.startsWith("not_demo_"))
                continue;
            const cap = args.capabilities[req];
            if (cap !== undefined)
                return cap.code;
        }
        return codes.DEMO_NO_WITHDRAW;
    }
    if (args.action.v1 === "stub")
        return codes.FEATURE_NOT_IN_V1;
    return undefined;
}

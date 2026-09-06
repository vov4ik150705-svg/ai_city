import { canonical } from "@corporator/contentpack";
import { sessionHeader, sessionScheme } from "@corporator/protocol";
export function applyPath(template, param, value) {
    const token = "{" + param + "}";
    return template.split(token).join(value);
}
export async function postCommand(args) {
    void args.cityId;
    const path = applyPath(args.commandTemplate, "effect", args.effect);
    const payload = {
        intent_id: args.intentId,
        expected_city_time: args.expectedCityTime,
    };
    if (args.extra !== undefined) {
        for (const key of Object.keys(args.extra)) {
            const val = args.extra[key];
            if (val !== undefined)
                payload[key] = val;
        }
    }
    const headers = {};
    headers[sessionHeader] = sessionScheme + " " + args.sessionId;
    return args.post(args.origin + path, canonical(payload), headers);
}
export function nextIntentId(cityId, cityTime, seq) {
    return cityId + ":" + cityTime.toString() + ":" + seq.toString();
}

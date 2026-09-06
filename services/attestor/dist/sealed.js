import { hexToBytes } from "@corporator/engine";
import { parseJson, fromUtf8 } from "@corporator/contentpack";
import { asObj, asText, strList } from "./values.js";
export function sealedFromPayload(raw) {
    try {
        const row = asObj(parseJson(fromUtf8(raw)));
        const cityId = asText(row["city_id"]);
        const cityTime = asText(row["city_time"]);
        if (cityId.length === 0 || cityTime.length === 0)
            return undefined;
        const leaves = [];
        for (const hex of strList(row["leaves"])) {
            if (hex.length === 0)
                continue;
            leaves.push(hexToBytes(hex));
        }
        return { cityId, cityTime: BigInt(cityTime), leaves };
    }
    catch {
        return undefined;
    }
}

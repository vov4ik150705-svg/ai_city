import { bytesToHex } from "@corporator/engine";
import { submitMinuteRoot as putHex } from "@corporator/chainport";
export async function submitMinuteRoot(port, cityId, cityDay, root) {
    return putHex(port, cityId, cityDay, bytesToHex(root));
}

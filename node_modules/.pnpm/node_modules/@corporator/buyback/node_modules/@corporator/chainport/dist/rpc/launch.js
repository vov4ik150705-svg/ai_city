import { dataCreatorTaxBps, decodeUint, isAddr } from "./abi.js";
import { postEth } from "./jsonrpc.js";
const RAW_TX = /^0x[0-9a-fA-F]+$/;
export function launchIntent(shareBps, taxBps) {
    // docs/LAUNCH.md §4: share 0 means no ETH on the launch tx.
    if (shareBps !== 0n)
        return undefined;
    return { valueWei: 0n, taxBps };
}
export async function postSignedRaw(post, signedRaw) {
    if (!RAW_TX.test(signedRaw) || signedRaw.length < 4)
        return { status: "silence" };
    return postEth(post, "eth_sendRawTransaction", [signedRaw]);
}
export async function readCreatorTaxBps(post, curve) {
    if (!isAddr(curve))
        return undefined;
    const data = dataCreatorTaxBps();
    if (data.length === 0)
        return undefined;
    const raw = await postEth(post, "eth_call", [{ to: curve, data }, "latest"]);
    if (raw.status !== "ok")
        return undefined;
    return decodeUint(raw.body);
}

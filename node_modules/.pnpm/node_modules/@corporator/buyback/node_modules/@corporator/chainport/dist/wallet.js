import {} from "./values.js";
import { decodeChain, rpcMethod } from "./rpc/codec.js";
export function recordedStakeSnapshot(rows) {
    let total = 0n;
    for (const row of rows)
        total += row.amount;
    return total;
}
export async function readWalletPrice(port, account, transport, last) {
    const fallback = last === undefined ? { chain: "", corp: 0n } : last;
    const bal = await port.corpToken.balanceOf(account);
    const corp = bal.ok ? bal.amount : fallback.corp;
    if (transport === undefined)
        return { chain: fallback.chain, corp };
    let outcome;
    try {
        outcome = await transport.call(rpcMethod.chainId, []);
    }
    catch {
        return { chain: fallback.chain, corp };
    }
    const chain = decodeChain(outcome);
    if (chain === undefined)
        return { chain: fallback.chain, corp };
    return { chain, corp };
}

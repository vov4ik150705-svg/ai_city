import { codes } from "@corporator/protocol";
import { applyStamp } from "./policy.js";
function refuse(stamps) {
    return { ok: false, code: codes.API_MALFORMED, stamps };
}
export async function depositThenMint(port, pack, account, corpAmount, capitalAmount, stamps, depositTime, mintTime) {
    if (port.buybackExecutorService !== pack.executorService)
        return refuse(stamps);
    if (pack.executorService === pack.voucherService)
        return refuse(stamps);
    if (capitalAmount > corpAmount * pack.capitalAnchor)
        return refuse(stamps);
    if (mintTime <= depositTime)
        return refuse(stamps);
    const previewDep = applyStamp(pack, stamps, "deposit_confirmed", depositTime);
    if (previewDep === undefined)
        return refuse(stamps);
    const previewMint = applyStamp(pack, previewDep, "mint", mintTime);
    if (previewMint === undefined)
        return refuse(stamps);
    const deposited = await port.vault.deposit(account, corpAmount);
    if (deposited.ok === false)
        return { ok: false, code: deposited.code, stamps };
    const minted = await port.vault.mintCapital(account, capitalAmount);
    if (minted.ok === false)
        return { ok: false, code: minted.code, stamps: previewDep };
    return { ok: true, stamps: previewMint };
}

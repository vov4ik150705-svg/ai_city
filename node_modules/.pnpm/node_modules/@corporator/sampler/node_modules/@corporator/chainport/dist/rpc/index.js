import { silentTransport } from "../values.js";
import { dec, decodeAmount, decodeResult, decodeRoot, decodeSnapshot, rpcMethod } from "./codec.js";
export { createLiveTransport } from "./live.js";
export { launchIntent, postSignedRaw, readCreatorTaxBps } from "./launch.js";
export { readPlayerReady } from "./playerReady.js";
async function invoke(transport, method, args) {
    try {
        return await transport.call(method, args);
    }
    catch {
        return { status: "silence" };
    }
}
function voucherArgs(voucher, nowS) {
    if (nowS === undefined) {
        return [voucher.nonce, voucher.account, dec(voucher.corpAmount), dec(voucher.issuedAtS)];
    }
    return [voucher.nonce, voucher.account, dec(voucher.corpAmount), dec(voucher.issuedAtS), dec(nowS)];
}
function bind(transport) {
    const corpToken = {
        async balanceOf(account) {
            return decodeAmount(await invoke(transport, rpcMethod.balanceOf, [account]));
        },
        async transfer(from, to, amount) {
            return decodeResult(await invoke(transport, rpcMethod.transfer, [from, to, dec(amount)]));
        },
    };
    const vault = {
        async vaultCorp() {
            return decodeAmount(await invoke(transport, rpcMethod.vaultCorp, []));
        },
        async capitalOf(account) {
            return decodeAmount(await invoke(transport, rpcMethod.capitalOf, [account]));
        },
        async deposit(account, corpAmount) {
            return decodeResult(await invoke(transport, rpcMethod.deposit, [account, dec(corpAmount)]));
        },
        async mintCapital(account, capitalAmount) {
            return decodeResult(await invoke(transport, rpcMethod.mintCapital, [account, dec(capitalAmount)]));
        },
        async issueVoucher(voucher) {
            return decodeResult(await invoke(transport, rpcMethod.issueVoucher, voucherArgs(voucher)));
        },
        async presentVoucher(voucher, nowS) {
            return decodeResult(await invoke(transport, rpcMethod.presentVoucher, voucherArgs(voucher, nowS)));
        },
    };
    const stakeRegistry = {
        async stake(account, ticker, amount) {
            return decodeResult(await invoke(transport, rpcMethod.stake, [account, ticker, dec(amount)]));
        },
        async snapshot(account) {
            return decodeSnapshot(await invoke(transport, rpcMethod.snapshot, [account]));
        },
    };
    const merkleRoots = {
        async putRoot(cityId, cityDay, root) {
            return decodeResult(await invoke(transport, rpcMethod.putRoot, [cityId, dec(cityDay), root]));
        },
        async getRoot(cityId, cityDay) {
            return decodeRoot(await invoke(transport, rpcMethod.getRoot, [cityId, dec(cityDay)]));
        },
    };
    return { corpToken, vault, stakeRegistry, merkleRoots };
}
export function createRpcPort(cfg, transport) {
    const bound = bind(transport === undefined ? silentTransport() : transport);
    return {
        kind: "rpc",
        voucherSignerService: cfg.voucherSignerService,
        buybackExecutorService: cfg.buybackExecutorService,
        corpToken: bound.corpToken,
        vault: bound.vault,
        stakeRegistry: bound.stakeRegistry,
        merkleRoots: bound.merkleRoots,
    };
}

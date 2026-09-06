import { codes } from "@corporator/protocol";
import { amountOk, err, mapGet, ok, } from "./values.js";
function rootKey(cityId, cityDay) {
    return cityId + "/" + cityDay.toString();
}
export function createMockPort(cfg, seed) {
    const corp = new Map();
    const capital = new Map();
    const pending = new Map();
    const issued = new Map();
    const used = new Set();
    const stakes = new Map();
    const roots = new Map();
    let vaultHeld = 0n;
    const initial = seed === undefined ? undefined : seed.corp;
    if (initial !== undefined) {
        for (const account of Object.keys(initial)) {
            const v = initial[account];
            if (v !== undefined)
                corp.set(account, v);
        }
    }
    const corpToken = {
        async balanceOf(account) {
            return amountOk(mapGet(corp, account));
        },
        async transfer(from, to, amount) {
            if (amount <= 0n || from.length === 0 || to.length === 0)
                return err(codes.API_MALFORMED);
            const have = mapGet(corp, from);
            if (have < amount)
                return err(codes.NOT_ENOUGH_CORP);
            corp.set(from, have - amount);
            corp.set(to, mapGet(corp, to) + amount);
            return ok();
        },
    };
    const vault = {
        async vaultCorp() {
            return amountOk(vaultHeld);
        },
        async capitalOf(account) {
            return amountOk(mapGet(capital, account));
        },
        async deposit(account, corpAmount) {
            if (corpAmount <= 0n || account.length === 0)
                return err(codes.API_MALFORMED);
            const have = mapGet(corp, account);
            if (have < corpAmount)
                return err(codes.NOT_ENOUGH_CORP);
            corp.set(account, have - corpAmount);
            vaultHeld += corpAmount;
            pending.set(account, mapGet(pending, account) + corpAmount);
            return ok();
        },
        async mintCapital(account, capitalAmount) {
            if (capitalAmount <= 0n || account.length === 0)
                return err(codes.API_MALFORMED);
            const queued = mapGet(pending, account);
            if (queued <= 0n)
                return err(codes.API_MALFORMED);
            pending.set(account, 0n);
            capital.set(account, mapGet(capital, account) + capitalAmount);
            return ok();
        },
        async issueVoucher(voucher) {
            if (voucher.nonce.length === 0 || voucher.account.length === 0 || voucher.corpAmount <= 0n) {
                return err(codes.API_MALFORMED);
            }
            if (issued.has(voucher.nonce) || used.has(voucher.nonce))
                return err(codes.API_INTENT_REPLAY);
            issued.set(voucher.nonce, voucher);
            return ok();
        },
        async presentVoucher(voucher, nowS) {
            if (voucher.nonce.length === 0 || voucher.account.length === 0 || voucher.corpAmount <= 0n) {
                return err(codes.API_MALFORMED);
            }
            if (nowS > voucher.issuedAtS + cfg.voucherTtlS)
                return err(codes.API_MALFORMED);
            const known = issued.get(voucher.nonce);
            if (known === undefined)
                return err(codes.API_MALFORMED);
            if (known.account !== voucher.account ||
                known.corpAmount !== voucher.corpAmount ||
                known.issuedAtS !== voucher.issuedAtS) {
                return err(codes.API_MALFORMED);
            }
            if (used.has(voucher.nonce))
                return err(codes.API_INTENT_REPLAY);
            if (vaultHeld < voucher.corpAmount)
                return err(codes.NOT_ENOUGH_CORP);
            used.add(voucher.nonce);
            vaultHeld -= voucher.corpAmount;
            corp.set(voucher.account, mapGet(corp, voucher.account) + voucher.corpAmount);
            return ok();
        },
    };
    const stakeRegistry = {
        async stake(account, ticker, amount) {
            if (account.length === 0 || ticker.length === 0 || amount <= 0n)
                return err(codes.API_MALFORMED);
            let inner = stakes.get(account);
            if (inner === undefined) {
                inner = new Map();
                stakes.set(account, inner);
            }
            inner.set(ticker, mapGet(inner, ticker) + amount);
            return ok();
        },
        async snapshot(account) {
            const inner = stakes.get(account);
            const rows = [];
            if (inner !== undefined) {
                const tickers = [...inner.keys()].sort();
                for (const ticker of tickers) {
                    rows.push({ ticker, amount: mapGet(inner, ticker) });
                }
            }
            return { ok: true, rows };
        },
    };
    const merkleRoots = {
        async putRoot(cityId, cityDay, root) {
            if (cityId.length === 0 || root.length === 0)
                return err(codes.API_MALFORMED);
            roots.set(rootKey(cityId, cityDay), root);
            return ok();
        },
        async getRoot(cityId, cityDay) {
            const root = roots.get(rootKey(cityId, cityDay));
            if (root === undefined)
                return err(codes.API_MALFORMED);
            return { ok: true, root };
        },
    };
    return {
        kind: "mock",
        voucherSignerService: cfg.voucherSignerService,
        buybackExecutorService: cfg.buybackExecutorService,
        corpToken,
        vault,
        stakeRegistry,
        merkleRoots,
    };
}

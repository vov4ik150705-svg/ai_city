export const KETTLE_FARM = "farm";
export const KETTLE_MONTH = "month";
export const RETURN_FN = "returnUnsettled";
export const REFUND_FN = "refundPlayer";
export const POOL_IN_MEASURED = "measured";
export const CODE_UNSETTLED = "PRIZE_UNSETTLED_RETURNED";
export const CODE_UNCOVERED = "PRIZE_CLAIM_UNCOVERED";
export const CODE_DEMO_NO_PRIZE = "DEMO_NO_PRIZE";
export function returnUnsettled(unsliced, owed) {
    const kept = {};
    let owedSum = 0n;
    for (const key of Object.keys(owed)) {
        const v = owed[key] ?? 0n;
        kept[key] = v;
        owedSum += v;
    }
    return { toBot: unsliced, owedSum, owed: kept };
}
export function returnUnsettledAttack(unsliced, owed, eatSettled) {
    if (!eatSettled)
        return returnUnsettled(unsliced, owed);
    const kept = {};
    let toBot = unsliced;
    for (const key of Object.keys(owed)) {
        toBot += owed[key] ?? 0n;
        kept[key] = 0n;
    }
    return { toBot, owedSum: 0n, owed: kept };
}
export function claimPrize(args) {
    if (args.demo) {
        return { paid: 0n, code: CODE_DEMO_NO_PRIZE, owed: args.owed, assetPool: args.poolIn };
    }
    if (args.paused && args.honorPause) {
        return { paid: 0n, code: "", owed: args.owed, assetPool: args.poolIn };
    }
    if (args.poolIn < args.owed) {
        return { paid: 0n, code: CODE_UNCOVERED, owed: args.owed, assetPool: args.poolIn };
    }
    return { paid: args.owed, code: "", owed: args.owed, assetPool: args.poolIn };
}
export function claimEveryAsset(args) {
    const out = [];
    for (const asset of args.assets) {
        const row = claimPrize({
            owed: args.owed[asset] ?? 0n,
            poolIn: args.poolIn[asset] ?? 0n,
            paused: args.paused,
            demo: args.demo,
            honorPause: args.honorPause,
        });
        out.push({
            asset,
            paid: row.paid,
            code: row.code,
            owed: row.owed,
            assetPool: row.assetPool,
        });
    }
    return out;
}
export function refundPlayer(args) {
    if (args.amount > args.backing || args.amount <= 0n) {
        return {
            ok: 0n,
            reason: "over_backing",
            paid: 0n,
            backing: args.backing,
            capital: args.capital,
            reserve: 0n,
            corpLeft: args.corpInVault,
        };
    }
    if (args.amount > args.corpInVault) {
        return {
            ok: 0n,
            reason: "over_vault",
            paid: 0n,
            backing: args.backing,
            capital: args.capital,
            reserve: 0n,
            corpLeft: args.corpInVault,
        };
    }
    let reserve = args.corpInVault - args.totalBacking;
    if (reserve < 0n)
        reserve = 0n;
    if (args.totalBacking - args.amount < 0n) {
        return {
            ok: 0n,
            reason: "over_total_backing",
            paid: 0n,
            backing: args.backing,
            capital: args.capital,
            reserve,
            corpLeft: args.corpInVault,
        };
    }
    const newBacking = args.backing - args.amount;
    const cap = newBacking * args.anchor;
    const newCapital = args.capital <= cap ? args.capital : cap;
    return {
        ok: 1n,
        reason: "",
        paid: args.amount,
        backing: newBacking,
        capital: newCapital,
        reserve,
        corpLeft: args.corpInVault - args.amount,
    };
}

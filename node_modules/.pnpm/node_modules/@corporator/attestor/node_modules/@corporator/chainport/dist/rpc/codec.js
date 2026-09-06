import { codes } from "@corporator/protocol";
import { err } from "../values.js";
export const rpcMethod = {
    balanceOf: "corp_token_balanceOf",
    transfer: "corp_token_transfer",
    vaultCorp: "vault_vaultCorp",
    capitalOf: "vault_capitalOf",
    deposit: "vault_deposit",
    mintCapital: "vault_mintCapital",
    issueVoucher: "vault_issueVoucher",
    presentVoucher: "vault_presentVoucher",
    stake: "stake_registry_stake",
    snapshot: "stake_registry_snapshot",
    putRoot: "merkle_roots_putRoot",
    getRoot: "merkle_roots_getRoot",
    chainId: "eth_chainId",
};
export function silence() {
    return err(codes.SERVICE_DEGRADED);
}
export function dec(value) {
    return value.toString();
}
const DEC = /^[0-9]+$/;
// RPC amounts are decimal strings; BigInt("0x10") would accept a lie. docs/ARCHITECTURE.md §6
export function parseDec(raw) {
    if (!DEC.test(raw))
        return undefined;
    try {
        return BigInt(raw);
    }
    catch {
        return undefined;
    }
}
function asRecord(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        return undefined;
    return value;
}
function noJsonNumber(value) {
    if (typeof value === "number")
        return false;
    if (value === null || typeof value !== "object")
        return true;
    if (Array.isArray(value)) {
        for (const item of value) {
            if (!noJsonNumber(item))
                return false;
        }
        return true;
    }
    const rec = value;
    for (const key of Object.keys(rec)) {
        if (!noJsonNumber(rec[key]))
            return false;
    }
    return true;
}
export function parseBody(body) {
    try {
        return JSON.parse(body);
    }
    catch {
        return undefined;
    }
}
export function decodeOutcome(outcome) {
    if (outcome.status !== "ok")
        return undefined;
    const parsed = parseBody(outcome.body);
    if (parsed === undefined)
        return undefined;
    if (!noJsonNumber(parsed))
        return undefined;
    return parsed;
}
function flagOk(row) {
    const v = row["ok"];
    if (typeof v === "boolean")
        return v;
    return undefined;
}
export function decodeResult(outcome) {
    const parsed = decodeOutcome(outcome);
    const row = asRecord(parsed);
    if (row === undefined)
        return silence();
    const flag = flagOk(row);
    if (flag === true)
        return { ok: true };
    if (flag === false) {
        const code = row["code"];
        if (typeof code !== "string" || code.length === 0)
            return silence();
        return err(code);
    }
    return silence();
}
export function decodeAmount(outcome) {
    const parsed = decodeOutcome(outcome);
    const row = asRecord(parsed);
    if (row === undefined)
        return silence();
    const flag = flagOk(row);
    if (flag === false) {
        const code = row["code"];
        if (typeof code !== "string" || code.length === 0)
            return silence();
        return err(code);
    }
    if (flag !== true)
        return silence();
    const raw = row["amount"];
    if (typeof raw !== "string" || raw.length === 0)
        return silence();
    const amount = parseDec(raw);
    if (amount === undefined)
        return silence();
    return { ok: true, amount };
}
export function decodeRoot(outcome) {
    const parsed = decodeOutcome(outcome);
    const row = asRecord(parsed);
    if (row === undefined)
        return silence();
    const flag = flagOk(row);
    if (flag === false) {
        const code = row["code"];
        if (typeof code !== "string" || code.length === 0)
            return silence();
        return err(code);
    }
    if (flag !== true)
        return silence();
    const root = row["root"];
    if (typeof root !== "string" || root.length === 0)
        return silence();
    return { ok: true, root };
}
export function decodeSnapshot(outcome) {
    const parsed = decodeOutcome(outcome);
    const row = asRecord(parsed);
    if (row === undefined)
        return silence();
    const flag = flagOk(row);
    if (flag === false) {
        const code = row["code"];
        if (typeof code !== "string" || code.length === 0)
            return silence();
        return err(code);
    }
    if (flag !== true)
        return silence();
    const raw = row["rows"];
    if (!Array.isArray(raw))
        return silence();
    const rows = [];
    for (const item of raw) {
        const rec = asRecord(item);
        if (rec === undefined)
            return silence();
        const ticker = rec["ticker"];
        const amount = rec["amount"];
        if (typeof ticker !== "string" || ticker.length === 0)
            return silence();
        if (typeof amount !== "string" || amount.length === 0)
            return silence();
        const qty = parseDec(amount);
        if (qty === undefined)
            return silence();
        rows.push({ ticker, amount: qty });
    }
    return { ok: true, rows };
}
export function decodeChain(outcome) {
    const parsed = decodeOutcome(outcome);
    const row = asRecord(parsed);
    if (row === undefined)
        return undefined;
    const flag = flagOk(row);
    if (flag !== true)
        return undefined;
    const chain = row["chain"];
    if (typeof chain !== "string")
        return undefined;
    return chain;
}
export function encodeOk() {
    return JSON.stringify({ ok: true });
}
export function encodeErr(code) {
    return JSON.stringify({ ok: false, code });
}
export function encodeAmount(amount) {
    return JSON.stringify({ ok: true, amount: dec(amount) });
}
export function encodeRoot(root) {
    return JSON.stringify({ ok: true, root });
}
export function encodeChain(chain) {
    return JSON.stringify({ ok: true, chain });
}
export function encodeSnapshot(rows) {
    const out = [];
    for (const row of rows)
        out.push({ ticker: row.ticker, amount: dec(row.amount) });
    return JSON.stringify({ ok: true, rows: out });
}
export function encodeResult(result) {
    if (result.ok)
        return encodeOk();
    return encodeErr(result.code);
}
export function encodeAmountResult(result) {
    if (result.ok)
        return encodeAmount(result.amount);
    return encodeErr(result.code);
}

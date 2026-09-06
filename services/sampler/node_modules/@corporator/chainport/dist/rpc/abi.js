export const selector = {
    balanceOf: "70a08231",
    transfer: "a9059cbb",
    vaultCorp: "79f73390",
    capitalOf: "4b0c8014",
    deposit: "47e7ef24",
    mintCapital: "4cd07e71",
    issueVoucher: "437b0a2b",
    presentVoucher: "d60a25e1",
    stake: "90b8436f",
    snapshot: "26512160",
    putRoot: "434d4b00",
    getRoot: "335b6101",
    // docs/LAUNCH.md §8: creatorTaxBps() on the live curve.
    creatorTaxBps: "c1bb8901",
};
const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const HEX32_RE = /^[0-9a-fA-F]{64}$/;
export function isAddr(raw) {
    return ADDR_RE.test(raw);
}
function pad64(hex) {
    let out = hex;
    while (out.length < 64)
        out = "0" + out;
    return out;
}
export function encodeUint(value) {
    if (value < 0n)
        return "";
    return pad64(value.toString(16));
}
export function encodeAddr(raw) {
    if (!isAddr(raw))
        return "";
    return pad64(raw.slice(2));
}
export function encodeBytes32(raw) {
    const hex = raw.startsWith("0x") || raw.startsWith("0X") ? raw.slice(2) : raw;
    if (!HEX32_RE.test(hex))
        return "";
    return hex.toLowerCase();
}
function utf8Hex(text) {
    const bytes = new TextEncoder().encode(text);
    let hex = "";
    for (let i = 0; i < bytes.length; i += 1) {
        const b = bytes[i];
        if (b === undefined)
            continue;
        hex += pad64(b.toString(16)).slice(62);
    }
    return hex;
}
function encodeBytes(hex) {
    const n = BigInt(hex.length / 2);
    let body = hex;
    while (body.length % 64 !== 0)
        body += "0";
    return encodeUint(n) + body;
}
export function encodeString(text) {
    return encodeBytes(utf8Hex(text));
}
function concatSel(sel, data) {
    if (data.length % 64 !== 0)
        return "";
    return "0x" + sel + data;
}
export function dataBalanceOf(account) {
    const a = encodeAddr(account);
    if (a.length === 0)
        return "";
    return concatSel(selector.balanceOf, a);
}
export function dataTransfer(to, amount) {
    const a = encodeAddr(to);
    const n = encodeUint(amount);
    if (a.length === 0 || n.length === 0)
        return "";
    return concatSel(selector.transfer, a + n);
}
export function dataVaultCorp() {
    return "0x" + selector.vaultCorp;
}
export function dataCapitalOf(account) {
    const a = encodeAddr(account);
    if (a.length === 0)
        return "";
    return concatSel(selector.capitalOf, a);
}
export function dataDeposit(account, amount) {
    const a = encodeAddr(account);
    const n = encodeUint(amount);
    if (a.length === 0 || n.length === 0)
        return "";
    return concatSel(selector.deposit, a + n);
}
export function dataMintCapital(account, amount) {
    const a = encodeAddr(account);
    const n = encodeUint(amount);
    if (a.length === 0 || n.length === 0)
        return "";
    return concatSel(selector.mintCapital, a + n);
}
function dataStringThenStatics(sel, text, statics) {
    const head = encodeUint(32n + BigInt(statics.length / 2));
    if (head.length === 0)
        return "";
    return concatSel(sel, head + statics + encodeString(text));
}
export function dataIssueVoucher(nonce, account, amount, issued) {
    const a = encodeAddr(account);
    const n = encodeUint(amount);
    const t = encodeUint(issued);
    if (a.length === 0 || n.length === 0 || t.length === 0)
        return "";
    return dataStringThenStatics(selector.issueVoucher, nonce, a + n + t);
}
export function dataPresentVoucher(nonce, account, amount, issued) {
    const a = encodeAddr(account);
    const n = encodeUint(amount);
    const t = encodeUint(issued);
    if (a.length === 0 || n.length === 0 || t.length === 0)
        return "";
    return dataStringThenStatics(selector.presentVoucher, nonce, a + n + t);
}
export function dataStake(account, ticker, amount) {
    const a = encodeAddr(account);
    const n = encodeUint(amount);
    if (a.length === 0 || n.length === 0)
        return "";
    const head = a + encodeUint(96n) + n;
    return concatSel(selector.stake, head + encodeString(ticker));
}
export function dataSnapshot(account) {
    const a = encodeAddr(account);
    if (a.length === 0)
        return "";
    return concatSel(selector.snapshot, a);
}
export function dataPutRoot(cityId, day, root) {
    const d = encodeUint(day);
    const r = encodeBytes32(root);
    if (d.length === 0 || r.length === 0)
        return "";
    return dataStringThenStatics(selector.putRoot, cityId, d + r);
}
export function dataGetRoot(cityId, day) {
    const d = encodeUint(day);
    if (d.length === 0)
        return "";
    return dataStringThenStatics(selector.getRoot, cityId, d);
}
export function dataCreatorTaxBps() {
    return "0x" + selector.creatorTaxBps;
}
export function decodeUint(hex) {
    const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (raw.length === 0 || raw.length % 2 !== 0)
        return undefined;
    if (!/^[0-9a-fA-F]+$/.test(raw))
        return undefined;
    try {
        return BigInt("0x" + raw);
    }
    catch {
        return undefined;
    }
}
export function decodeBytes32(hex) {
    const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (raw.length < 64)
        return undefined;
    const word = raw.slice(0, 64);
    if (!HEX32_RE.test(word))
        return undefined;
    return word.toLowerCase();
}
function wordAt(raw, index) {
    const start = Number(index) * 64;
    if (start < 0 || start + 64 > raw.length)
        return undefined;
    return raw.slice(start, start + 64);
}
function decodeStringAt(raw, byteOffset) {
    const wordIndex = byteOffset / 32n;
    const lenWord = wordAt(raw, wordIndex);
    if (lenWord === undefined)
        return undefined;
    const length = decodeUint("0x" + lenWord);
    if (length === undefined)
        return undefined;
    const start = Number(wordIndex + 1n) * 64;
    const hexLen = Number(length) * 2;
    if (start + hexLen > raw.length)
        return undefined;
    const hex = raw.slice(start, start + hexLen);
    const bytes = new Uint8Array(Number(length));
    for (let i = 0; i < bytes.length; i += 1) {
        const hi = hex.slice(i * 2, i * 2 + 2);
        bytes[i] = Number.parseInt(hi, 16);
    }
    return new TextDecoder().decode(bytes);
}
export function decodeSnapshot(hex) {
    const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (raw.length < 128)
        return undefined;
    const off0 = decodeUint("0x" + (wordAt(raw, 0n) ?? ""));
    const off1 = decodeUint("0x" + (wordAt(raw, 1n) ?? ""));
    if (off0 === undefined || off1 === undefined)
        return undefined;
    const tIndex = off0 / 32n;
    const aIndex = off1 / 32n;
    const tLenWord = wordAt(raw, tIndex);
    const aLenWord = wordAt(raw, aIndex);
    if (tLenWord === undefined || aLenWord === undefined)
        return undefined;
    const nTick = decodeUint("0x" + tLenWord);
    const nAmt = decodeUint("0x" + aLenWord);
    if (nTick === undefined || nAmt === undefined || nTick !== nAmt)
        return undefined;
    const rows = [];
    for (let i = 0n; i < nTick; i += 1n) {
        const rel = wordAt(raw, tIndex + 1n + i);
        const amtWord = wordAt(raw, aIndex + 1n + i);
        if (rel === undefined || amtWord === undefined)
            return undefined;
        const relOff = decodeUint("0x" + rel);
        const amount = decodeUint("0x" + amtWord);
        if (relOff === undefined || amount === undefined)
            return undefined;
        const ticker = decodeStringAt(raw, off0 + relOff);
        if (ticker === undefined)
            return undefined;
        rows.push({ ticker, amount });
    }
    return rows;
}

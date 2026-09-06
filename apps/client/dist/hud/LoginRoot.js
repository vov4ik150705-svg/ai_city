import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { codes } from "@corporator/protocol";
import { openDemoSession, openWalletSession } from "../session.js";
import { hudCssVars } from "../palette.js";
import { FontFaces } from "./parts/FontFaces.js";
import "./hud.css";
function walletOf(globalObj) {
    if (globalObj === null || typeof globalObj !== "object")
        return undefined;
    const eth = globalObj.ethereum;
    if (eth === null || typeof eth !== "object")
        return undefined;
    const req = eth.request;
    if (typeof req !== "function")
        return undefined;
    return {
        request: (args) => req.call(eth, args),
    };
}
async function post(url, body) {
    const copy = new ArrayBuffer(body.byteLength);
    new Uint8Array(copy).set(body);
    const res = await fetch(url, { method: "POST", body: copy });
    return { status: res.status, body: new Uint8Array(await res.arrayBuffer()) };
}
export function LoginRoot(props) {
    const [code, setCode] = useState("");
    const vars = hudCssVars(props.palette);
    const pageBg = vars["--bg-panel"];
    const pageFg = vars["--text"];
    if (pageBg === undefined || pageFg === undefined)
        throw new Error(codes.API_MALFORMED);
    const geo = { ...vars, background: pageBg, color: pageFg };
    async function onDemo() {
        const got = await openDemoSession(props.origin, post);
        if (got === undefined) {
            setCode(codes.API_UNAUTHORIZED);
            return;
        }
        props.onReady(got);
    }
    async function onWallet() {
        const wallet = walletOf(globalThis);
        if (wallet === undefined) {
            setCode(codes.WALLET_NOT_CONNECTED);
            return;
        }
        const accounts = await wallet.request({ method: "eth_requestAccounts" });
        if (!Array.isArray(accounts) || typeof accounts[0] !== "string") {
            setCode(codes.WALLET_NOT_CONNECTED);
            return;
        }
        const address = accounts[0];
        const got = await openWalletSession({
            origin: props.origin,
            address,
            sign: async (message) => {
                const sig = await wallet.request({
                    method: "personal_sign",
                    params: [message, address],
                });
                if (typeof sig !== "string")
                    throw new Error(codes.API_UNAUTHORIZED);
                return sig;
            },
            post,
        });
        if (got === undefined) {
            setCode(codes.API_UNAUTHORIZED);
            return;
        }
        props.onReady(got);
    }
    return (_jsxs("div", { "data-app": "login", className: "hud-root hud-login", style: geo, children: [_jsx(FontFaces, {}), _jsxs("section", { className: "hud-panel hud-card hud-login__card", children: [_jsx("span", { className: "hud-brand", children: "Corporator" }), _jsx("button", { type: "button", "data-key": "UI_ENTER_DEMO", onClick: () => void onDemo(), children: props.strings["UI_ENTER_DEMO"] ?? "" }), _jsx("button", { type: "button", "data-key": "UI_CONNECT_WALLET", onClick: () => void onWallet(), children: props.strings["UI_CONNECT_WALLET"] ?? "" }), code.length > 0 ? _jsx("span", { "data-key": code, className: "hud-muted" }) : null] })] }));
}

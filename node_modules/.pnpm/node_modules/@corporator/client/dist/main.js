import { jsx as _jsx } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { codes, listenBind, listenPorts, packHash } from "@corporator/protocol";
import { parseJson } from "@corporator/contentpack";
import { LiveRoot } from "./hud/LiveRoot.js";
import { LoginRoot } from "./hud/LoginRoot.js";
import { bootFromHost, originFromListen } from "./boot.js";
import { loadClientPack, loadHudFixture } from "./packview.js";
import { loadStringTable } from "./strings.js";
import { parsePalette } from "./palette.js";
import stringsUrl from "../../../content/strings/ru.json?url";
import hudUrl from "../../../content/fixtures/hud_layout.json?url";
import paletteUrl from "../../../art/palette/corporator.hex?url";
async function fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(codes.API_PACK_STALE);
    return new Uint8Array(await res.arrayBuffer());
}
async function fetchText(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(codes.API_PACK_STALE);
    return await res.text();
}
function BootError(props) {
    return _jsx("div", { "data-app": "boot-error", "data-key": props.code });
}
async function mountLive(origin, session, strings) {
    const result = await bootFromHost({
        origin,
        packHash,
        cityId: session.cityId,
        fetchBytes,
    });
    if (!result.ok)
        return _jsx(BootError, { code: result.code });
    const pack = loadClientPack(result.packJson);
    const hud = loadHudFixture(parseJson(await fetchText(hudUrl)));
    const palette = parsePalette(await fetchText(paletteUrl));
    return (_jsx(LiveRoot, { origin: origin, cityId: session.cityId, sessionId: session.sessionId, pack: pack, strings: strings, hud: hud, palette: palette, snapshot: result.snapshot, demo: session.accountKind === "demo" }));
}
async function boot() {
    const rootEl = document.getElementById("root");
    if (rootEl === null)
        throw new Error(codes.API_MALFORMED);
    const root = createRoot(rootEl);
    const origin = originFromListen(listenBind, listenPorts.api);
    const strings = loadStringTable(parseJson(await fetchText(stringsUrl)));
    const palette = parsePalette(await fetchText(paletteUrl));
    root.render(_jsx(LoginRoot, { origin: origin, strings: strings, palette: palette, onReady: (session) => {
            void mountLive(origin, session, strings).then((el) => {
                root.render(el);
            });
        } }));
}
void boot();

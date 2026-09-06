import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { codes } from "@corporator/protocol";
import { isShore, loadScene } from "@corporator/render";
import { hudCssVars } from "../palette.js";
import { format, lookup } from "../strings.js";
import { SceneHost } from "./SceneHost.js";
import { Topbar } from "./topbar/Topbar.js";
import { Overview, ActiveEvents, DistrictsPanel } from "./left/Overview.js";
import { AgentsPanel, CityCard, DistrictOverview, LogPanel } from "./right/CityCard.js";
import { BottomMenu, StockBar } from "./center/StockBar.js";
import { hudShellVars } from "./parts/shell.js";
import { failedTokens } from "./parts/refusal.js";
import { renderPackScreen } from "./screens/registry.js";
import { autopilotJournalCode } from "./screens/companion.js";
import "./hud.css";
const NO_OPENED = {};
function sceneLabels(strings) {
    const prefix = "UI_BLD_";
    const out = {};
    for (const key of Object.keys(strings)) {
        if (!key.startsWith(prefix))
            continue;
        const text = strings[key];
        if (text === undefined)
            continue;
        out[key.slice(prefix.length).toLowerCase()] = text;
    }
    return out;
}
function sceneTickers(pack) {
    const out = {};
    for (const row of pack.districts) {
        out[row.beacon] = row.ticker;
    }
    return out;
}
export function App(props) {
    const [route, setRoute] = useState("");
    const [lookId, setLookId] = useState("");
    const [lookRev, setLookRev] = useState(0n);
    const [autopilotOn, setAutopilotOn] = useState(false);
    const [proofId, setProofId] = useState("");
    const [logNeedle, setLogNeedle] = useState("");
    const [journalExtra, setJournalExtra] = useState([]);
    const [pendingCell, setPendingCell] = useState("");
    const [pendingTileX, setPendingTileX] = useState(0n);
    const [pendingTileY, setPendingTileY] = useState(0n);
    const vars = hudCssVars(props.palette);
    const pageBg = vars["--bg-panel"];
    const pageFg = vars["--text"];
    if (pageBg === undefined || pageFg === undefined)
        throw new Error(codes.API_MALFORMED);
    const geo = {
        ...vars,
        background: pageBg,
        color: pageFg,
        ...hudShellVars(props.hud),
    };
    const left = props.view.left;
    const right = props.view.right;
    const overview = left.find((row) => row.id === "overview");
    const events = left.find((row) => row.id === "events");
    const districts = left.find((row) => row.id === "districts");
    const city = right.find((row) => row.id === "city");
    const agents = right.find((row) => row.id === "agents");
    const log = right.find((row) => row.id === "log");
    const schema = right.find((row) => row.id === "schema");
    const sceneMap = loadScene(props.scene).map;
    const tileBad = pendingCell.length === 0 ||
        (pendingCell !== "." && pendingCell !== "p") ||
        isShore(sceneMap, pendingTileX, pendingTileY);
    const failed = failedTokens({
        demo: props.demo,
        walletConnected: !props.demo,
        capitalPositive: props.view.treasury.exact !== "0",
        corpPositive: props.view.corp !== 0n,
        bankOpen: props.view.plaque.key !== "BANK_CLOSED" && props.view.plaque.key !== "BANK_SUNDAY",
        bankSunday: props.view.plaque.key === "BANK_SUNDAY",
        buildTileIllegal: tileBad,
    });
    function look(id) {
        setLookId(id);
        setLookRev((n) => n + 1n);
    }
    function go(id) {
        if (id !== "build") {
            setPendingCell("");
        }
        setRoute(id);
    }
    function appendJournal(key, slots) {
        const used = new Set();
        const raw = lookup(props.strings, key, used);
        const text = Object.keys(slots).length === 0 ? raw : format(raw, slots);
        setJournalExtra((rows) => [...rows, { id: `local-${rows.length}`, key, text }]);
    }
    function onLocal(effect) {
        const toggle = props.pack.actions["companion_toggle"];
        if (toggle !== undefined && effect === toggle.effect) {
            const next = !autopilotOn;
            setAutopilotOn(next);
            const key = autopilotJournalCode(next);
            appendJournal(key, next ? { command: "seat_agent", target: "on" } : {});
            return;
        }
        const filter = props.pack.actions["log_filter_companion"];
        if (filter !== undefined && effect === filter.effect) {
            const prefix = "filter:";
            const needle = effect.startsWith(prefix) ? effect.slice(prefix.length) : "";
            setLogNeedle((cur) => (cur === needle ? "" : needle));
            return;
        }
        const advisor = props.pack.actions["companion_ask_advisor"];
        if (advisor !== undefined && effect === advisor.effect) {
            appendJournal(codes.COMPANION_LLM_TEMPLATE, {});
        }
    }
    const overlay = route.length === 0
        ? null
        : renderPackScreen(route, {
            view: props.view,
            pack: props.pack,
            strings: props.strings,
            demo: props.demo,
            failed,
            loading: false,
            onClose: () => {
                setRoute("");
            },
            onNavigate: go,
            pendingCell,
            pendingTileX,
            pendingTileY,
            onCommit: props.onCommit,
            onLocal,
            autopilotOn,
            logNeedle,
            journalExtra,
        });
    return (_jsxs("div", { "data-app": "corporator", className: "hud-root", style: geo, "data-scene-route": route, "data-narrow": props.narrow ? "1" : "0", "data-drawer": props.drawer, children: [_jsx(SceneHost, { scene: props.scene, palette: props.palette, tileW: props.tileW, cubeH: props.pack.cubeH, chunkTiles: props.pack.chunkTiles, waterFrames: props.pack.waterFrames, waterSteps: props.pack.waterSteps, waterStrip: props.pack.waterStrip, roadAutotile: props.pack.roadAutotile, sidewalkAutotile: props.pack.sidewalkAutotile, shadowOffset: props.pack.shadowOffset, groundSprites: props.pack.groundSprites, cubeDirt: props.pack.cubeDirt, cubeCliff: props.pack.cubeCliff, cubeRock: props.pack.cubeRock, snapLutSide: props.pack.snapLutSide, lotPad: props.pack.lotPad, lotPadSkip: props.pack.lotPadSkip, zoomMinNum: props.pack.zoomMinNum, zoomMinDen: props.pack.zoomMinDen, pipStep: props.pack.pipStep, pipOffset: props.pack.pipOffset, pulsePeriod: props.pack.pulsePeriod, hoverOutlinePx: props.pack.hoverOutlinePx, selectLift: props.pack.selectLift, contactShadowAlphaBps: props.pack.contactShadowAlphaBps, contactShadowInsetBps: props.pack.contactShadowInsetBps, labelMinZoomNum: props.pack.labelMinZoomNum, labelMinZoomDen: props.pack.labelMinZoomDen, overlays: props.pack.overlays, badges: props.pack.badges, energy: props.view.energy, compute: props.view.compute, cityTime: props.view.cityTime, ticksDay: props.pack.ticksDay, light: props.pack.light, camera: props.pack.camera, motion: props.pack.motion, lookId: lookId, lookRev: lookRev, opened: NO_OPENED, onSceneRoute: (screen, _objectId, cell, tileX, tileY) => {
                    setPendingCell(cell);
                    setPendingTileX(tileX);
                    setPendingTileY(tileY);
                    setRoute(screen);
                }, noGpuText: props.view.noGpu.text, labels: sceneLabels(props.strings), tickers: sceneTickers(props.pack) }), _jsx(Topbar, { view: props.view, brand: "Corporator", onNavigate: go }), props.narrow ? (_jsxs("div", { className: "hud-drawers", children: [_jsx("button", { type: "button", "data-key": "UI_COL_LEFT", onClick: () => props.onDrawer(props.drawer === "left" ? "" : "left"), children: props.view.colLeft }), _jsx("button", { type: "button", "data-key": "UI_COL_RIGHT", onClick: () => props.onDrawer(props.drawer === "right" ? "" : "right"), children: props.view.colRight })] })) : null, _jsxs("aside", { "data-surface": "left_panel", className: "hud-col hud-col--left", children: [overview ? (_jsx(Overview, { title: overview.title, titleKey: overview.key, rows: props.view.overview, payroll: props.view.payroll })) : null, events ? _jsx(ActiveEvents, { title: events.title, titleKey: events.key, empty: props.view.eventsEmpty }) : null, districts ? (_jsx(DistrictsPanel, { title: districts.title, titleKey: districts.key, rows: props.view.districts, onLook: look })) : null] }), _jsxs("aside", { "data-surface": "right_panel", className: "hud-col hud-col--right", children: [city ? _jsx(CityCard, { title: city.title, titleKey: city.key, view: props.view }) : null, agents ? (_jsx(AgentsPanel, { title: agents.title, titleKey: agents.key, view: props.view, onHire: () => {
                            props.onCommit("hire");
                        } })) : null, log ? (_jsx(LogPanel, { title: log.title, titleKey: log.key, view: props.view, extra: journalExtra, needle: logNeedle, filterLabel: lookup(props.strings, "UI_FILTER_COMPANION", new Set()), onFilter: () => {
                            const row = props.pack.actions["log_filter_companion"];
                            if (row !== undefined)
                                onLocal(row.effect);
                        }, openId: proofId, onBadge: (id) => {
                            setProofId((cur) => (cur === id ? "" : id));
                        } })) : null, schema ? (_jsx(DistrictOverview, { title: schema.title, titleKey: schema.key, rows: props.view.districts, onLook: look })) : null] }), _jsx(StockBar, { stocks: props.view.stocks }), _jsx(BottomMenu, { items: props.view.menu, onNavigate: go }), overlay] }));
}

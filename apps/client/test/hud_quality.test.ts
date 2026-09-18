import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { loadPack, parseJson, type Json } from "@corporator/contentpack"
import { buildHud, emptySnapshot, loadClientPack, loadHudFixture, loadStringTable } from "../src/index.ts"
import { hudFocusRelocate, isHudFocusShell, resolveHudFocusReturn } from "../src/hud/keys.ts"
import { FunctionStrip } from "../src/hud/center/FunctionStrip.tsx"
import { EventLog, eventKickers } from "../src/hud/parts/EventLog.tsx"
import { EmptyState, ErrorState, StaleState, UnavailableState } from "../src/hud/parts/Empty.tsx"
import { Loading } from "../src/hud/parts/Loading.tsx"
import { IconButton } from "../src/hud/parts/IconButton.tsx"
import { BankPlaque } from "../src/hud/topbar/BankPlaque.tsx"
import { RecentActivity } from "../src/hud/right/RightRail.tsx"
import { BuildingCard } from "../src/hud/parts/BuildingCard.tsx"
import { FactRow } from "../src/hud/parts/Facts.tsx"
import { readyField } from "../src/hud/fields.ts"
import {
  HUD_BP_DESKTOP,
  HUD_BP_MOBILE,
  HUD_BP_PORTRAIT,
  HUD_BP_TABLET,
  HUD_MOTION_DURATION,
  HUD_MOTION_MS_MAX,
  HUD_MOTION_MS_MIN,
  HUD_TOUCH_MIN,
  hudBpPx,
  hudNarrowLimit,
  hudPresentationMode,
  hudRootFontPx,
  hudSelectionNarrow,
} from "../src/hud/parts/shell.ts"

const repo = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const client = join(repo, "apps/client")

function packBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(repo, "content/out/pack.json")))
}

function readJson(rel: string): Json {
  return parseJson(readFileSync(join(repo, rel), "utf8"))
}

function markup(node: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(node)
}

function firstBuildingId(ids: readonly string[]): string {
  const hit = ids[0]
  if (hit === undefined) throw new Error("missing building id")
  return hit
}

describe("HUD quality contract", () => {
  it("keeps FunctionStrip as keyboard non-3D access at narrow widths", () => {
    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const buildingId = firstBuildingId(pack.buildingIds)
    const view = buildHud({
      pack,
      strings,
      snapshot: {
        ...emptySnapshot(),
        functions: [{ id: buildingId, nameKey: "UI_BANK", statusKey: "UI_UNAVAILABLE" }],
      },
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    expect(view.shell.functions.kind).toBe("ready")
    const html = markup(
      createElement(FunctionStrip, {
        view,
        pack,
        onViewAll: () => {},
        onSelectBuilding: () => {},
      }),
    )
    expect(html.includes("data-surface=\"active_functions\"")).toBe(true)
    expect(html.includes("type=\"button\"")).toBe(true)
    expect(html.includes("aria-label=")).toBe(true)
    expect(html.includes("hud-tile")).toBe(true)
    expect(html.includes("tabindex=\"-1\"")).toBe(false)
    expect(html.includes("BottomNav")).toBe(false)
    const app = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    expect(app.includes("FunctionStrip")).toBe(true)
    expect(app.includes("BottomNav")).toBe(false)
    expect(app.includes("BottomMenu")).toBe(false)
    expect(app.includes("onNavigate(\"settings\")")).toBe(false)
    const tabletAt = css.indexOf("@media (max-width: 64rem)")
    const portraitAt = css.indexOf("@media (orientation: portrait)")
    expect(tabletAt >= 0).toBe(true)
    expect(portraitAt > tabletAt).toBe(true)
    const tablet = css.slice(tabletAt, portraitAt)
    expect(tablet.includes(".hud-col")).toBe(true)
    expect(tablet.includes("display: none")).toBe(true)
    expect(tablet.includes(".hud-functions")).toBe(true)
    expect(tablet.includes("visibility: visible")).toBe(true)
    expect(tablet.includes("grid-area: functions")).toBe(true)
    expect(tablet.includes("grid-area: activity")).toBe(true)
    expect(tablet.includes("overflow-x: auto")).toBe(false)
    expect(tablet.includes("auto minmax(0, 1fr) auto")).toBe(true)
    expect(tablet.includes(".hud-menu")).toBe(false)
    expect(css.includes("navigation-mode: more")).toBe(false)
    const portrait = css.slice(portraitAt)
    expect(portrait.includes(".hud-activity .hud-event__meta")).toBe(true)
    expect(portrait.includes(".hud-activity .hud-card__body")).toBe(true)
    expect(portrait.includes("display: none")).toBe(true)
    expect(portrait.includes(".hud-header__tools .hud-chip")).toBe(true)
    const mobileAt = css.indexOf("@media (max-width: 24.375rem)")
    expect(mobileAt > portraitAt).toBe(true)
    const mobile = css.slice(mobileAt)
    expect(mobile.includes("grid-area: scene-safe-center")).toBe(true)
    expect(mobile.includes(".hud-activity")).toBe(true)
    expect(mobile.includes("max-height: var(--hud-recent-activity-height)")).toBe(true)
    expect(css.includes("max-width: 7.5rem")).toBe(false)
    expect(css.includes("overflow: clip")).toBe(true)
    const listAt = css.indexOf(".hud-functions__list {")
    expect(listAt >= 0).toBe(true)
    const listBlock = css.slice(listAt, css.indexOf(".hud-functions__item {", listAt))
    expect(listBlock.includes("overflow: hidden")).toBe(true)
    expect(css.includes("grid-template-columns: repeat(5, minmax(0, 1fr))")).toBe(true)
    expect(listBlock.includes("overscroll-behavior-x: contain")).toBe(false)
    expect(css.includes("width: var(--hud-active-functions-width)")).toBe(true)
    expect(css.includes("grid-template-columns: var(--hud-thumb-building) minmax(0, 1fr) max-content")).toBe(true)
    expect(css.includes(".hud-bcard__who")).toBe(true)
    expect(css.includes(".hud-bcard__end")).toBe(true)
    expect(css.includes("max-width: 9rem")).toBe(false)
    expect(css.includes("max-width: 55%")).toBe(false)
    expect(css.includes(".hud-attest")).toBe(true)
    expect(css.includes("min-height: var(--hud-control-min-size)")).toBe(true)
    const attestAt = css.indexOf(".hud-attest {")
    expect(attestAt > 0).toBe(true)
    expect(css.includes("grid-template-columns: minmax(0, 1fr) auto")).toBe(true)
    expect(css.includes(".hud-acard__who")).toBe(true)
    expect(css.includes(".hud-bcard__end .hud-status")).toBe(true)
    expect(app.includes("openRoute(\"overview\", \"functions\")")).toBe(true)
    expect(app.includes("openRoute(\"overview\", \"summary\")")).toBe(true)
    expect(app.includes("openRoute(\"overview\", \"production\")")).toBe(true)
    expect(app.includes("setOverviewTab(\"functions\")")).toBe(false)
  })

  it("keeps compact chrome copy unclipped without hiding primary state", () => {
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    expect(css.includes("--hud-rail-compact: 15.625rem")).toBe(true)
    expect(css.includes("--hud-active-functions-width: 16.75rem")).toBe(true)
    expect(css.includes("--hud-recent-activity-width: 17.5rem")).toBe(true)
    expect(css.includes("--hud-visible-events: 3")).toBe(true)
    expect(css.includes("navigation-mode: more")).toBe(false)

    const plaqueAt = css.indexOf(".hud-plaque {")
    expect(plaqueAt >= 0).toBe(true)
    const plaqueBlock = css.slice(plaqueAt, css.indexOf(".hud-plaque--ok {", plaqueAt))
    expect(plaqueBlock.includes("overflow: visible")).toBe(true)
    expect(plaqueBlock.includes("flex: 0 0 auto")).toBe(true)
    expect(plaqueBlock.includes("text-overflow: ellipsis")).toBe(false)

    const extraAt = css.indexOf(".hud-card__h-extra {")
    expect(extraAt >= 0).toBe(true)
    const extraBlock = css.slice(extraAt, css.indexOf(".hud-card__h .hud-linkbtn {", extraAt))
    expect(extraBlock.includes("flex: 0 0 auto")).toBe(true)
    expect(extraBlock.includes("min-width: min-content")).toBe(true)

    const factsAt = css.indexOf(".hud-facts__row .hud-card__label {")
    expect(factsAt >= 0).toBe(true)
    const factsBlock = css.slice(factsAt, css.indexOf(".hud-facts__row dd {", factsAt))
    expect(factsBlock.includes("white-space: normal")).toBe(true)
    expect(factsBlock.includes("text-overflow: ellipsis")).toBe(false)

    const titleAt = css.indexOf(".hud-functions .hud-panel-h__t,")
    expect(titleAt >= 0).toBe(true)
    const titleBlock = css.slice(titleAt, css.indexOf(".hud-card__hero {", titleAt))
    expect(titleBlock.includes(".hud-activity .hud-panel-h__t")).toBe(true)
    expect(titleBlock.includes("overflow: visible")).toBe(true)
    expect(titleBlock.includes("min-width: min-content")).toBe(true)
    expect(titleBlock.includes("white-space: normal")).toBe(true)
    expect(titleBlock.includes("text-overflow: ellipsis")).toBe(false)

    const activityHeadAt = css.indexOf(".hud-activity .hud-card__h,")
    expect(activityHeadAt >= 0).toBe(true)
    const activityHeadBlock = css.slice(
      activityHeadAt,
      css.indexOf(".hud-activity .hud-card__h-extra,", activityHeadAt),
    )
    expect(activityHeadBlock.includes("flex-wrap: wrap")).toBe(true)
    expect(activityHeadBlock.includes("min-width: 0")).toBe(true)

    const activityWidthAt = css.indexOf("width: min(var(--hud-recent-activity-width), 42%)")
    expect(activityWidthAt >= 0).toBe(true)
    const activityBlock = css.slice(activityWidthAt, css.indexOf(".hud-functions .hud-panel-h,", activityWidthAt))
    expect(activityBlock.includes("overflow-x: hidden")).toBe(true)
    expect(activityBlock.includes("overflow-y: auto")).toBe(true)
    expect(activityBlock.includes("overflow-x: auto")).toBe(false)

    const drawerBarAt = css.indexOf(".hud-drawer__bar {")
    expect(drawerBarAt >= 0).toBe(true)
    const drawerBarBlock = css.slice(drawerBarAt, css.indexOf(".hud-drawer__body {", drawerBarAt))
    expect(drawerBarBlock.includes("flex-wrap: wrap")).toBe(true)

    const drawerTitleAt = css.indexOf(".hud-drawer__h,")
    expect(drawerTitleAt >= 0).toBe(true)
    const drawerTitleBlock = css.slice(drawerTitleAt, css.indexOf(".hud-functions .hud-panel-h__t,", drawerTitleAt))
    expect(drawerTitleBlock.includes("white-space: normal")).toBe(true)
    expect(drawerTitleBlock.includes("overflow: visible")).toBe(true)
    expect(drawerTitleBlock.includes("text-overflow: ellipsis")).toBe(false)

    const endAt = css.indexOf(".hud-bcard__end .hud-status,")
    expect(endAt >= 0).toBe(true)
    const endBlock = css.slice(endAt, css.indexOf(".hud-bcard__thumb,", endAt))
    expect(endBlock.includes("min-width: min-content")).toBe(true)
    expect(endBlock.includes("overflow: visible")).toBe(true)
    expect(endBlock.includes("text-overflow: ellipsis")).toBe(false)

    const compactAt = css.indexOf("@media (max-width: 80rem)")
    const tabletAt = css.indexOf("@media (max-width: 64rem)")
    const portraitAt = css.indexOf("@media (orientation: portrait)")
    const compact = css.slice(compactAt, tabletAt)
    const tablet = css.slice(tabletAt, portraitAt)
    expect(compact.includes("auto minmax(0, 1fr) auto")).toBe(true)
    expect(tablet.includes("auto minmax(0, 1fr) auto")).toBe(true)
    expect(tablet.includes(".hud-menu")).toBe(false)

    const plaqueHtml = markup(
      createElement(BankPlaque, {
        plaque: { key: "BANK_CLOSED", text: "Bank closed, opens in 20h city time" },
      }),
    )
    expect(plaqueHtml.includes("Bank closed, opens in 20h city time")).toBe(true)
    expect(plaqueHtml.includes("{opens_in}")).toBe(false)

    const demandHtml = markup(
      createElement(FactRow, {
        label: "Last evaluated demand",
        labelKey: "UI_RESOURCE_DEMAND",
        field: readyField("UI_RESOURCE_DEMAND", "800", "800"),
      }),
    )
    expect(demandHtml.includes("Last evaluated demand")).toBe(true)
    expect(demandHtml.includes("data-key=\"UI_RESOURCE_DEMAND\"")).toBe(true)
    expect(demandHtml.includes("800")).toBe(true)

    const hub = markup(
      createElement(BuildingCard, {
        buildingId: "agent_hub",
        title: "Agent Hub",
        titleKey: "UI_BLD_AGENT_HUB",
        ticker: "MSFT",
        districtId: "automation",
        mapped: true,
        decorative: "No economic function. Not in the pack.",
        statusLabel: "Status",
        statusText: "no energy",
        statusKey: "IDLE_NO_ENERGY",
        missingStatus: false,
        manageLabel: "Manage",
        unmapped: "Decorative building",
        unavailable: "Unavailable",
        facts: [],
        onManage: () => {},
      }),
    )
    expect(hub.includes("Agent Hub")).toBe(true)
    expect(hub.includes("no energy")).toBe(true)
    expect(hub.includes("hud-bcard__name")).toBe(true)
    expect(hub.includes("hud-bcard__end")).toBe(true)
    expect(hub.includes("hud-status")).toBe(true)

    const pack = loadClientPack(loadPack(packBytes()).pack)
    const strings = loadStringTable(readJson("content/strings/en.json"))
    const view = buildHud({
      pack,
      strings,
      snapshot: emptySnapshot(),
      nowMs: 0n,
      firstLoginMs: 0n,
      demo: true,
    })
    const functions = markup(
      createElement(FunctionStrip, {
        view,
        pack,
        onViewAll: () => {},
        onSelectBuilding: () => {},
      }),
    )
    expect(functions.includes("Active Functions")).toBe(true)
    expect(functions.includes("View All")).toBe(true)
    const activity = markup(
      createElement(RecentActivity, {
        view,
        strings,
        extra: [],
        openId: "",
        onBadge: () => {},
        onViewAll: () => {},
      }),
    )
    expect(activity.includes("Recent events")).toBe(true)
    expect(activity.includes("View All")).toBe(true)
    expect(activity.includes("BottomNav")).toBe(false)
  })

  it("announces loading and error distinctly from empty/unavailable/stale", () => {
    const loading = markup(createElement(Loading, { kind: "events", text: "Loading events", textKey: "UI_EVENTS_LOADING" }))
    expect(loading.includes("Loading events")).toBe(true)
    expect(loading.includes("hud-load__text")).toBe(true)
    expect(loading.includes("hud-sr")).toBe(false)
    expect(loading.includes("role=\"status\"")).toBe(true)
    expect(loading.includes("aria-live=\"polite\"")).toBe(true)
    expect(loading.includes("aria-busy=\"true\"")).toBe(true)
    expect(loading.includes("data-state=\"loading\"")).toBe(true)

    const broken = markup(createElement(ErrorState, { textKey: "UI_EVENTS_ERROR", text: "Events unavailable" }))
    const missing = markup(createElement(UnavailableState, { textKey: "UI_UNAVAILABLE", text: "Unavailable" }))
    const empty = markup(createElement(EmptyState, { textKey: "UI_EMPTY_NO_EVENTS", text: "No recent activity" }))
    const stale = markup(createElement(StaleState, { textKey: "UI_QUOTE_STALE", text: "Quote is stale" }))
    expect(broken.includes("role=\"alert\"")).toBe(true)
    expect(broken.includes("aria-live=\"assertive\"")).toBe(true)
    expect(broken.includes("data-state=\"error\"")).toBe(true)
    expect(broken.includes("hud-error")).toBe(true)
    expect(missing.includes("data-state=\"unavailable\"")).toBe(true)
    expect(missing.includes("hud-unavailable")).toBe(true)
    expect(missing.includes("role=\"alert\"")).toBe(false)
    expect(empty.includes("data-state=\"empty\"")).toBe(true)
    expect(empty.includes("hud-empty")).toBe(true)
    expect(stale.includes("data-state=\"stale\"")).toBe(true)
    expect(stale.includes("hud-stale")).toBe(true)
    expect(broken === missing).toBe(false)

    const strings = loadStringTable(readJson("content/strings/en.json"))
    const logError = markup(
      createElement(EventLog, {
        kind: "error",
        messageKey: "UI_EVENTS_ERROR",
        message: "Events unavailable",
        rows: [],
        bound: 3,
        openId: "",
        kickers: eventKickers(strings),
        unavailable: "Unavailable",
        timeLabel: "City Time",
        entityLabel: "Selected building",
        unreadLabel: "Notifications",
        onProof: () => {},
      }),
    )
    expect(logError.includes("hud-error")).toBe(true)
    expect(logError.includes("hud-unavailable")).toBe(false)
    const logLoad = markup(
      createElement(EventLog, {
        kind: "loading",
        messageKey: "UI_EVENTS_LOADING",
        message: "Loading events",
        rows: [],
        bound: 3,
        openId: "",
        kickers: eventKickers(strings),
        unavailable: "Unavailable",
        timeLabel: "City Time",
        entityLabel: "Selected building",
        unreadLabel: "Notifications",
        onProof: () => {},
      }),
    )
    expect(logLoad.includes("Loading events")).toBe(true)
    expect(logLoad.includes("data-state=\"loading\"")).toBe(true)
  })

  it("uses shared 120-180ms motion token and reduced-motion without perpetual HUD animation", () => {
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    expect(css.includes(`--hud-motion-duration: ${HUD_MOTION_DURATION}`)).toBe(true)
    expect(css.includes("--hud-motion-duration-min: 0.12s")).toBe(true)
    expect(css.includes("--hud-motion-duration-max: 0.18s")).toBe(true)
    const ms = Number.parseFloat(HUD_MOTION_DURATION) * 1000
    expect(ms >= HUD_MOTION_MS_MIN).toBe(true)
    expect(ms <= HUD_MOTION_MS_MAX).toBe(true)
    expect(css.includes("@media (prefers-reduced-motion: reduce)")).toBe(true)
    expect(css.includes("@keyframes")).toBe(false)
    expect(css.includes("animation: infinite")).toBe(false)
    expect(css.includes("animation-iteration-count: infinite")).toBe(false)
    expect(css.includes(`--hud-touch-min: var(--hud-control-min-size)`)).toBe(true)
    expect(css.includes(`--hud-control-min-size: ${HUD_TOUCH_MIN}`)).toBe(true)
    const icon = markup(createElement(IconButton, { label: "Notifications", labelKey: "UI_NOTIFICATIONS" }))
    expect(icon.includes("aria-label=\"Notifications\"")).toBe(true)
    expect(icon.includes("title=\"Notifications\"")).toBe(true)
    expect(icon.includes("type=\"button\"")).toBe(true)
    expect(css.includes("#245A9A")).toBe(true)
    expect(css.includes("#1D4B86")).toBe(true)
    expect(css.includes("#2E68AA")).toBe(true)
    expect(css.includes("#2C67AA")).toBe(true)
    expect(css.includes("#1E4F8C")).toBe(true)
    expect(css.includes("#F4F7FA")).toBe(true)
    expect(css.includes("#C7D5E3")).toBe(true)
    expect(css.includes("#8FA8C0")).toBe(true)
    expect(css.includes("#45C7F4")).toBe(true)
    expect(css.includes("#FFB64A")).toBe(true)
    expect(css.includes("#63D68A")).toBe(true)
    expect(css.includes("#F0B85B")).toBe(true)
    expect(css.includes("#E97878")).toBe(true)
    expect(css.includes("#071522")).toBe(false)
    expect(css.includes("IBM Plex Sans")).toBe(true)
    expect(css.includes("Source Serif 4")).toBe(false)
    expect(css.includes("--hud-icon-stroke: 1.75")).toBe(true)
    expect(css.includes(".hud-btn--primary")).toBe(true)
    expect(css.includes(".hud-btn--secondary")).toBe(true)
    expect(css.includes(".hud-btn--ghost")).toBe(true)
    const faces = readFileSync(join(client, "src/hud/parts/FontFaces.tsx"), "utf8")
    expect(faces.includes("ibm_plex_sans.woff2")).toBe(true)
    expect(faces.includes("jetbrains_mono.woff2")).toBe(true)
    expect(faces.includes("fonts.googleapis")).toBe(false)
    expect(faces.includes("source_serif_4.woff2")).toBe(false)
    const icons = readFileSync(join(client, "src/hud/parts/hudIcons.ts"), "utf8")
    expect(icons.includes("from \"lucide-react\"")).toBe(true)
    expect(icons.includes("HUD_ICON_STROKE")).toBe(true)
    expect(icons.includes("HUD_ICON_NAME")).toBe(true)
    const motionApp = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    expect(motionApp.includes("BottomNav")).toBe(false)
    expect(motionApp.includes("onNavigate(\"settings\")")).toBe(false)
    const bcard = readFileSync(join(client, "src/hud/parts/BuildingCard.tsx"), "utf8")
    expect(bcard.includes("BuildingThumbnail")).toBe(true)
    expect(readFileSync(join(client, "src/hud/parts/BuildingThumbnail.tsx"), "utf8").includes("data-thumb=\"unavailable\"")).toBe(true)
    expect(readFileSync(join(client, "src/hud/parts/AgentCard.tsx"), "utf8").includes("export function AgentCard")).toBe(true)
    expect(readFileSync(join(client, "src/hud/parts/ResearchCard.tsx"), "utf8").includes("export function ResearchCard")).toBe(true)
    expect(readFileSync(join(client, "src/hud/parts/IndustryCard.tsx"), "utf8").includes("export function IndustryCard")).toBe(true)
  })

  it("localizes clock updates without remounting the Three scene", () => {
    const app = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    const live = readFileSync(join(client, "src/hud/LiveRoot.tsx"), "utf8")
    const scene = readFileSync(join(client, "src/hud/SceneHost.tsx"), "utf8")
    expect(app.includes("memo(function IslandScene")).toBe(true)
    expect(app.includes("cityTime={cityTime}")).toBe(true)
    expect(app.includes("key={cityTime}")).toBe(false)
    expect(app.includes("key={props.view.cityTime}")).toBe(false)
    expect(live.includes("chromeNowMs")).toBe(true)
    expect(live.includes("cityTime={liveCityTime}")).toBe(true)
    expect(live.includes("nowMs: chromeNowMs")).toBe(true)
    expect(scene.includes("handle.setCityTime(props.cityTime)")).toBe(true)
    const mount = scene.match(/useEffect\(\(\) => \{[\s\S]*?props\.bloomThresholdBps,[\s\S]*?\]\)/)
    expect(mount === null).toBe(false)
    const mountText = mount === null ? "" : (mount[0] ?? "")
    expect(mountText.includes("cityTime")).toBe(false)
    expect(mountText.includes("adapterStatus")).toBe(false)
    expect(mountText.includes("narrow")).toBe(false)
    expect(app.includes("pointer-events")).toBe(false)
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    expect(css.includes(".hud-overlay")).toBe(true)
    expect(css.includes("pointer-events: none")).toBe(true)
    expect(scene.includes("setPixelRatio")).toBe(false)
  })

  it("centralizes presentation thresholds without contradicting pack geometry", () => {
    const css = readFileSync(join(client, "src/hud/hud.css"), "utf8")
    expect(css.includes(`--hud-bp-desktop: ${HUD_BP_DESKTOP}`)).toBe(true)
    expect(css.includes(`--hud-bp-tablet: ${HUD_BP_TABLET}`)).toBe(true)
    expect(css.includes(`--hud-bp-portrait: ${HUD_BP_PORTRAIT}`)).toBe(true)
    expect(css.includes(`--hud-bp-mobile: ${HUD_BP_MOBILE}`)).toBe(true)
    expect(css.includes(`@media (max-width: ${HUD_BP_DESKTOP})`)).toBe(true)
    expect(css.includes(`@media (max-width: ${HUD_BP_TABLET})`)).toBe(true)
    expect(css.includes(`@media (orientation: portrait) and (max-width: ${HUD_BP_PORTRAIT})`)).toBe(true)
    expect(css.includes(`@media (max-width: ${HUD_BP_MOBILE})`)).toBe(true)
    expect(hudRootFontPx("16px")).toBe(16n)
    expect(hudRootFontPx("0")).toBe(16n)
    expect(hudBpPx("desktop", 16n)).toBe(1280n)
    expect(hudBpPx("tablet", 16n)).toBe(1024n)
    expect(hudBpPx("mobile", 16n)).toBe(390n)
    expect(hudPresentationMode(2000n, 16n)).toBe("large")
    expect(hudPresentationMode(1440n, 16n)).toBe("desktop")
    expect(hudPresentationMode(1280n, 16n)).toBe("compact")
    expect(hudPresentationMode(1024n, 16n)).toBe("tablet")
    expect(hudPresentationMode(768n, 16n)).toBe("portrait")
    const hud = loadHudFixture(readJson("content/fixtures/hud_layout.json"))
    const packFit = hudNarrowLimit(hud, 1n)
    expect(
      hudSelectionNarrow({
        widthPx: 900n,
        hud,
        packSafeW: 1n,
        rootFontPx: 16n,
      }),
    ).toBe(true)
    expect(packFit < 900n).toBe(true)
    expect(
      hudSelectionNarrow({
        widthPx: 1600n,
        hud,
        packSafeW: 1n,
        rootFontPx: 16n,
      }),
    ).toBe(false)
  })

  it("returns focus after workspace close without focusing a detached trigger", () => {
    type FocusNode = {
      closest: (selector: string) => FocusNode | null
      getAttribute: (name: string) => string | null
    }
    function attrNode(attrs: Record<string, string>, parent?: FocusNode): FocusNode {
      const self: FocusNode = {
        getAttribute: (name) => {
          const hit = attrs[name]
          return hit === undefined ? null : hit
        },
        closest(selector) {
          for (const part of selector.split(",")) {
            const name = part.trim().slice(1, -1)
            const value = attrs[name]
            if (value !== undefined && value.length > 0) return self
          }
          return parent === undefined ? null : parent.closest(selector)
        },
      }
      return self
    }
    const functions = attrNode({ "data-surface": "active_functions" })
    expect(hudFocusRelocate(attrNode({ "data-function": "city_hall" }, functions))).toBe(
      '[data-function="city_hall"] button',
    )
    expect(hudFocusRelocate(attrNode({ "data-key": "UI_VIEW_ALL" }, functions))).toBe(
      '[data-surface="active_functions"] [data-key="UI_VIEW_ALL"]',
    )
    expect(
      hudFocusRelocate(attrNode({ "data-key": "UI_MANAGE" }, attrNode({ "data-surface": "selection" }))),
    ).toBe('[data-surface="selection"] [data-key="UI_MANAGE"]')
    expect(isHudFocusShell(attrNode({ "data-app": "corporator" }))).toBe(true)
    expect(isHudFocusShell(attrNode({ "data-key": "UI_MANAGE" }))).toBe(false)
    expect(hudFocusRelocate(attrNode({}, attrNode({ "data-id": "payroll" })))).toBe(
      '[data-id="payroll"] button, [data-id="payroll"] [role="button"]',
    )

    const detached = { id: "old" } as unknown as HTMLElement
    const remounted = { id: "new" } as unknown as HTMLElement
    const root = { id: "root" } as unknown as HTMLElement
    const saved = { node: detached, relocate: '[data-surface="active_functions"] [data-key="UI_VIEW_ALL"]' }
    expect(
      resolveHudFocusReturn({
        saved,
        contains: (node) => node === remounted,
        query: () => remounted,
        fallback: root,
      }),
    ).toBe(remounted)
    expect(
      resolveHudFocusReturn({
        saved,
        contains: () => false,
        query: () => undefined,
        fallback: root,
      }),
    ).toBe(root)
    expect(
      resolveHudFocusReturn({
        saved,
        contains: (node) => node === detached,
        query: () => remounted,
        fallback: root,
      }),
    ).toBe(detached)

    const app = readFileSync(join(client, "src/hud/App.tsx"), "utf8")
    const applyAt = app.indexOf("function applyRoute")
    const applyFn = app.slice(applyAt, app.indexOf("function go("))
    expect(applyFn.includes("rememberFocus()")).toBe(true)
    expect(applyFn.indexOf("rememberFocus()") < applyFn.indexOf("setRoute(dest.route)")).toBe(true)
    expect(app.includes("captureHudFocus")).toBe(true)
    expect(app.includes("resolveHudFocusReturn")).toBe(true)
    expect(app.includes("document.contains")).toBe(true)
    expect(app.includes("requestRestore()")).toBe(true)
    const closeFn = app.slice(app.indexOf("function closeWorkspace"), app.indexOf("function manageSelected"))
    expect(closeFn.includes("isTxnInFlight")).toBe(true)
    expect(closeFn.includes("requestRestore()")).toBe(true)
    const manageFn = app.slice(app.indexOf("function manageSelected"), app.indexOf("const screenProps"))
    expect(manageFn.includes("rememberFocus(manage)")).toBe(true)
    expect(manageFn.includes("UI_MANAGE")).toBe(true)
    const escapeFn = app.slice(app.indexOf('if (e.key === "Escape")'), app.indexOf("window.addEventListener"))
    expect(escapeFn.indexOf('target === "hold"') < escapeFn.indexOf('target === "workspace"')).toBe(true)
    expect(escapeFn.includes("closeWorkspace()")).toBe(true)
    expect(escapeFn.includes("setTxnHold(true)")).toBe(true)
    const workspace = readFileSync(join(client, "src/hud/parts/Workspace.tsx"), "utf8")
    expect(workspace.includes("document.contains(previous)")).toBe(true)
    expect(workspace.includes("isHudFocusShell")).toBe(true)
    const bcard = readFileSync(join(client, "src/hud/parts/BuildingCard.tsx"), "utf8")
    expect(bcard.includes("event.currentTarget.focus()")).toBe(true)
    expect(app.includes("openRoute(\"bank\")")).toBe(true)
    expect(app.includes("openRoute(\"overview\", \"summary\")")).toBe(true)
    expect(app.includes("openRoute(\"overview\", \"functions\")")).toBe(true)
    expect(app.includes("openRoute(\"journal\")")).toBe(true)
    expect(app.includes("onNavigate={go}")).toBe(true)
    expect(app.includes("onManage={manageSelected}")).toBe(true)
  })
})

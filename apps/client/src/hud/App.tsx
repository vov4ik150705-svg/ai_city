import { useState, type CSSProperties, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { isShore, loadScene } from "@corporator/render"
import type { ClientPack } from "../packview.js"
import { hudCssVars } from "../palette.js"
import type { Palette } from "../palette.js"
import type { HudFixture } from "../layout.js"
import { format, lookup, type StringTable } from "../strings.js"
import { SceneHost } from "./SceneHost.js"
import { Topbar } from "./topbar/Topbar.js"
import { Overview, ActiveEvents, DistrictsPanel } from "./left/Overview.js"
import { AgentsPanel, CityCard, DistrictOverview, LogPanel } from "./right/CityCard.js"
import { BottomMenu, StockBar } from "./center/StockBar.js"
import { hudShellVars } from "./parts/shell.js"
import { failedTokens } from "./parts/refusal.js"
import { renderPackScreen } from "./screens/registry.js"
import { autopilotJournalCode } from "./screens/companion.js"
import type { HudView } from "./model.js"
import "./hud.css"

const NO_OPENED: { readonly [district: string]: bigint } = {}

export function App(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly hud: HudFixture
  readonly palette: Palette
  readonly tileW: bigint
  readonly scene: unknown
  readonly narrow: boolean
  readonly drawer: string
  readonly demo: boolean
  readonly onDrawer: (id: string) => void
  readonly onCommit: (effect: string, extra?: { readonly [key: string]: import("@corporator/contentpack").Json }) => void
}): ReactElement {
  const [route, setRoute] = useState("")
  const [lookId, setLookId] = useState("")
  const [lookRev, setLookRev] = useState(0n)
  const [autopilotOn, setAutopilotOn] = useState(false)
  const [proofId, setProofId] = useState("")
  const [logNeedle, setLogNeedle] = useState("")
  const [journalExtra, setJournalExtra] = useState<
    readonly { readonly id: string; readonly key: string; readonly text: string }[]
  >([])
  const [pendingCell, setPendingCell] = useState("")
  const [pendingTileX, setPendingTileX] = useState(0n)
  const [pendingTileY, setPendingTileY] = useState(0n)
  const vars = hudCssVars(props.palette)
  const pageBg = vars["--bg-panel"]
  const pageFg = vars["--text"]
  if (pageBg === undefined || pageFg === undefined) throw new Error(codes.API_MALFORMED)
  const geo: CSSProperties = {
    ...vars,
    background: pageBg,
    color: pageFg,
    ...hudShellVars(props.hud),
  }
  const left = props.view.left
  const right = props.view.right
  const overview = left.find((row) => row.id === "overview")
  const events = left.find((row) => row.id === "events")
  const districts = left.find((row) => row.id === "districts")
  const city = right.find((row) => row.id === "city")
  const agents = right.find((row) => row.id === "agents")
  const log = right.find((row) => row.id === "log")
  const schema = right.find((row) => row.id === "schema")
  const sceneMap = loadScene(props.scene).map
  const tileBad =
    pendingCell.length === 0 ||
    (pendingCell !== "." && pendingCell !== "p") ||
    isShore(sceneMap, pendingTileX, pendingTileY)
  const failed = failedTokens({
    demo: props.demo,
    walletConnected: !props.demo,
    capitalPositive: props.view.treasury.exact !== "0",
    corpPositive: props.view.corp !== 0n,
    bankOpen: props.view.plaque.key !== "BANK_CLOSED" && props.view.plaque.key !== "BANK_SUNDAY",
    bankSunday: props.view.plaque.key === "BANK_SUNDAY",
    buildTileIllegal: tileBad,
  })
  function look(id: string): void {
    setLookId(id)
    setLookRev((n) => n + 1n)
  }
  function go(id: string): void {
    if (id !== "build") {
      setPendingCell("")
    }
    setRoute(id)
  }
  function appendJournal(key: string, slots: { readonly [name: string]: string }): void {
    const used = new Set<string>()
    const raw = lookup(props.strings, key, used)
    const text = Object.keys(slots).length === 0 ? raw : format(raw, slots)
    setJournalExtra((rows) => [...rows, { id: `local-${rows.length}`, key, text }])
  }
  function onLocal(effect: string): void {
    const toggle = props.pack.actions["companion_toggle"]
    if (toggle !== undefined && effect === toggle.effect) {
      const next = !autopilotOn
      setAutopilotOn(next)
      const key = autopilotJournalCode(next)
      appendJournal(key, next ? { command: "seat_agent", target: "on" } : {})
      return
    }
    const filter = props.pack.actions["log_filter_companion"]
    if (filter !== undefined && effect === filter.effect) {
      const prefix = "filter:"
      const needle = effect.startsWith(prefix) ? effect.slice(prefix.length) : ""
      setLogNeedle((cur) => (cur === needle ? "" : needle))
      return
    }
    const advisor = props.pack.actions["companion_ask_advisor"]
    if (advisor !== undefined && effect === advisor.effect) {
      appendJournal(codes.COMPANION_LLM_TEMPLATE, {})
    }
  }
  const overlay =
    route.length === 0
      ? null
      : renderPackScreen(route, {
          view: props.view,
          pack: props.pack,
          strings: props.strings,
          demo: props.demo,
          failed,
          loading: false,
          onClose: () => {
            setRoute("")
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
        })
  return (
    <div
      data-app="corporator"
      className="hud-root"
      style={geo}
      data-scene-route={route}
      data-narrow={props.narrow ? "1" : "0"}
      data-drawer={props.drawer}
    >
      <SceneHost
        scene={props.scene}
        palette={props.palette}
        gridSize={props.pack.gridSize}
        camera={props.pack.camera}
        cityTime={props.view.cityTime}
        lookId={lookId}
        lookRev={lookRev}
        opened={NO_OPENED}
        onSceneRoute={(screen, _objectId, cell, tileX, tileY) => {
          setPendingCell(cell)
          setPendingTileX(tileX)
          setPendingTileY(tileY)
          setRoute(screen)
        }}
        noGpuText={props.view.noGpu.text}
        lots={props.pack.lots}
        heroCatalog={props.pack.heroCatalog}
        lodNear={props.pack.lodNear}
        light={props.pack.light}
        ticksDay={props.pack.ticksDay}
        unitHeightBps={props.pack.unitHeightBps}
        unitShiftPeriod={props.pack.unitShiftPeriod}
        unitShiftSpanBps={props.pack.unitShiftSpanBps}
        motion={props.pack.motion}
        decorHeightBps={props.pack.decorHeightBps}
        lanternHeightBps={props.pack.lanternHeightBps}
        canopyHeightBps={props.pack.canopyHeightBps}
        vehicleHeightBps={props.pack.vehicleHeightBps}
        droneHoverHeightBps={props.pack.droneHoverHeightBps}
      />
      <Topbar view={props.view} brand="Corporator" onNavigate={go} />
      {props.narrow ? (
        <div className="hud-drawers">
          <button type="button" data-key="UI_COL_LEFT" onClick={() => props.onDrawer(props.drawer === "left" ? "" : "left")}>
            {props.view.colLeft}
          </button>
          <button type="button" data-key="UI_COL_RIGHT" onClick={() => props.onDrawer(props.drawer === "right" ? "" : "right")}>
            {props.view.colRight}
          </button>
        </div>
      ) : null}
      <aside data-surface="left_panel" className="hud-col hud-col--left">
        {overview ? (
          <Overview title={overview.title} titleKey={overview.key} rows={props.view.overview} payroll={props.view.payroll} />
        ) : null}
        {events ? <ActiveEvents title={events.title} titleKey={events.key} empty={props.view.eventsEmpty} /> : null}
        {districts ? (
          <DistrictsPanel title={districts.title} titleKey={districts.key} rows={props.view.districts} onLook={look} />
        ) : null}
      </aside>
      <aside data-surface="right_panel" className="hud-col hud-col--right">
        {city ? <CityCard title={city.title} titleKey={city.key} view={props.view} /> : null}
        {agents ? (
          <AgentsPanel
            title={agents.title}
            titleKey={agents.key}
            view={props.view}
            onHire={() => {
              props.onCommit("hire")
            }}
          />
        ) : null}
        {log ? (
          <LogPanel
            title={log.title}
            titleKey={log.key}
            view={props.view}
            extra={journalExtra}
            needle={logNeedle}
            filterLabel={lookup(props.strings, "UI_FILTER_COMPANION", new Set())}
            onFilter={() => {
              const row = props.pack.actions["log_filter_companion"]
              if (row !== undefined) onLocal(row.effect)
            }}
            openId={proofId}
            onBadge={(id) => {
              setProofId((cur) => (cur === id ? "" : id))
            }}
          />
        ) : null}
        {schema ? (
          <DistrictOverview title={schema.title} titleKey={schema.key} rows={props.view.districts} onLook={look} />
        ) : null}
      </aside>
      <StockBar stocks={props.view.stocks} />
      <BottomMenu items={props.view.menu} onNavigate={go} />
      {overlay}
    </div>
  )
}

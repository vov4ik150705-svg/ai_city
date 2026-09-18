import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { isShore, loadScene } from "@corporator/render/ground"
import type { ClientPack } from "../packview.js"
import { hudCssVars } from "../palette.js"
import type { Palette } from "../palette.js"
import type { HudFixture } from "../layout.js"
import { lookup, type StringTable } from "../strings.js"
import { SceneStub } from "./SceneStub.js"
import { IslandTopbar as Topbar } from "./topbar/IslandTopbar.js"
import { LeftRail } from "./left/LeftRail.js"
import { RecentActivity, RightRail } from "./right/RightRail.js"
import { FunctionStrip } from "./center/FunctionStrip.js"
import { WorkspaceDrawer } from "./parts/Drawer.js"
import { failedTokens } from "./parts/refusal.js"
import { renderPackScreen } from "./screens/registry.js"
import type { ScreenProps } from "./parts/ScreenFrame.js"
import type { HudView } from "./model.js"
import type { OverviewTabId } from "./fields.js"
import {
  packWorkspaceId,
  resolveHudRoute,
  sceneClickOpensWorkspace,
  workspaceDrawerWide,
} from "./navigation.js"
import {
  captureHudFocus,
  hudEscapeTarget,
  isTypingTarget,
  resolveHudFocusReturn,
  type HudFocusReturn,
} from "./keys.js"
import { OverviewWorkspace } from "./workspace/OverviewWorkspace.js"
import { IndustriesWorkspace } from "./workspace/IndustriesWorkspace.js"
import { JournalFromLog } from "./workspace/JournalFromLog.js"
import { BuildingPopover } from "./BuildingPopover.js"
import { islandChromeVisible, resolveBuildingSelection } from "./selection.js"
import { isTxnInFlight, type UiTxnState } from "./uiState.js"
import type { SceneProjection } from "./sceneProjection.js"
import { HudShell } from "./HudShell.js"
import type { CommitExtra, LiveAdapterResult, UiIntent } from "./liveAdapter.js"
import "./hud.css"

const NO_OPENED: { readonly [district: string]: bigint } = {}

const LiveSceneHost = lazy(async () => {
  const mod = await import("./SceneHost.js")
  return { default: mod.SceneHost }
})

type StubBuilding = { readonly id: string; readonly label: string }

type IslandSceneProps = {
  readonly stubMode: boolean
  readonly selectedObjectId: string
  readonly stubBuildings: readonly StubBuilding[]
  readonly onProjection: (proj: SceneProjection | undefined) => void
  readonly onSceneRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void
  readonly palette: Palette
  readonly camera: ClientPack["camera"]
  readonly cityTime: bigint
  readonly lookId: string
  readonly lookRev: bigint
  readonly noGpuText: string
  readonly light: ClientPack["light"]
  readonly ticksDay: bigint
  readonly occupied: ClientPack["islandOccupied"]
  readonly bloomStrengthBps: bigint
  readonly bloomRadiusBps: bigint
  readonly bloomThresholdBps: bigint
}

const IslandScene = memo(function IslandScene(props: IslandSceneProps): ReactElement {
  if (props.stubMode) {
    return (
      <SceneStub
        selectedObjectId={props.selectedObjectId}
        buildings={props.stubBuildings}
        onProjection={props.onProjection}
        onSceneRoute={props.onSceneRoute}
      />
    )
  }
  return (
    <Suspense fallback={<div data-surface="scene" className="hud-scene" />}>
      <LiveSceneHost
        palette={props.palette}
        camera={props.camera}
        cityTime={props.cityTime}
        lookId={props.lookId}
        lookRev={props.lookRev}
        opened={NO_OPENED}
        selectedObjectId={props.selectedObjectId}
        onProjection={props.onProjection}
        onSceneRoute={props.onSceneRoute}
        noGpuText={props.noGpuText}
        light={props.light}
        ticksDay={props.ticksDay}
        occupied={props.occupied}
        bloomStrengthBps={props.bloomStrengthBps}
        bloomRadiusBps={props.bloomRadiusBps}
        bloomThresholdBps={props.bloomThresholdBps}
      />
    </Suspense>
  )
})

export type HudSceneMode = "live" | "stub"

export const App = memo(function App(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly hud: HudFixture
  readonly palette: Palette
  readonly tileW: bigint
  readonly scene: unknown
  readonly sceneMode?: HudSceneMode
  readonly cityTime?: bigint
  readonly narrow: boolean
  readonly drawer: string
  readonly demo: boolean
  readonly adapterStatus: string
  readonly adapterCode: string
  readonly onDrawer: (id: string) => void
  readonly onIntent: (intent: UiIntent, extra?: CommitExtra) => void | Promise<void | LiveAdapterResult>
  readonly onCommit: (effect: string, extra?: CommitExtra) => void | Promise<void | LiveAdapterResult>
}): ReactElement {
  const [route, setRoute] = useState("")
  const [lookId, setLookId] = useState("")
  const [lookRev, setLookRev] = useState(0n)
  const [proofId, setProofId] = useState("")
  const [pendingCell, setPendingCell] = useState("")
  const [pendingTileX, setPendingTileX] = useState(0n)
  const [pendingTileY, setPendingTileY] = useState(0n)
  const [overviewTab, setOverviewTab] = useState<OverviewTabId>("summary")
  const [selectedId, setSelectedId] = useState("")
  const [projection, setProjection] = useState<SceneProjection | undefined>(undefined)
  const [moneyTxn, setMoneyTxn] = useState<UiTxnState | undefined>(undefined)
  const [txnHold, setTxnHold] = useState(false)
  const lastReturnRef = useRef<HudFocusReturn | undefined>(undefined)
  const pendingRestoreRef = useRef(false)
  const routeRef = useRef(route)
  routeRef.current = route
  const cityTime = props.cityTime === undefined ? props.view.cityTime : props.cityTime
  const vars = hudCssVars(props.palette)
  const pageBg = vars["--bg-panel"]
  const pageFg = vars["--text"]
  if (pageBg === undefined || pageFg === undefined) throw new Error(codes.API_MALFORMED)
  const geo: CSSProperties = {
    ...vars,
    background: pageBg,
    color: pageFg,
  }
  void props.hud
  void props.tileW
  void props.drawer
  void props.onDrawer
  const sceneMap = useMemo(() => loadScene(props.scene).map, [props.scene])
  const tileBad =
    pendingCell.length === 0 ||
    (pendingCell !== "." && pendingCell !== "p") ||
    isShore(sceneMap, pendingTileX, pendingTileY)
  const failed = failedTokens({
    demo: props.demo,
    walletConnected: !props.demo,
    capitalPositive: props.view.treasury.kind === "ready" && props.view.treasury.exact !== "0",
    corpPositive: props.view.corp !== undefined && props.view.corp !== 0n,
    bankOpen: props.view.plaque.key !== "BANK_CLOSED" && props.view.plaque.key !== "BANK_SUNDAY",
    bankSunday: props.view.plaque.key === "BANK_SUNDAY",
    buildTileIllegal: tileBad,
  })
  const selection = resolveBuildingSelection(selectedId, props.pack)
  const used = new Set<string>()
  const continuesText = lookup(props.strings, "UI_TXN_CONTINUES", used)
  function rememberFocus(from?: EventTarget | null): void {
    const source = from === undefined ? document.activeElement : from
    const hit = captureHudFocus(source)
    if (hit !== undefined) lastReturnRef.current = hit
  }
  function restoreFocus(): void {
    const saved = lastReturnRef.current
    lastReturnRef.current = undefined
    const root = document.querySelector("[data-app='corporator']")
    function pick(): HTMLElement | undefined {
      return resolveHudFocusReturn({
        saved,
        contains: (node) => document.contains(node),
        query: (sel) => {
          if (root === null) return undefined
          const hit = root.querySelector(sel)
          return hit instanceof HTMLElement ? hit : undefined
        },
        fallback: root instanceof HTMLElement ? root : undefined,
      })
    }
    function apply(next: HTMLElement | undefined): void {
      if (next !== undefined) next.focus()
    }
    const first = pick()
    if (
      first !== undefined &&
      root instanceof HTMLElement &&
      first === root &&
      saved !== undefined &&
      saved.relocate.length > 0
    ) {
      requestAnimationFrame(() => {
        apply(pick())
      })
      return
    }
    apply(first)
  }
  function requestRestore(): void {
    pendingRestoreRef.current = true
  }
  function look(id: string): void {
    setLookId(id)
    setLookRev((n) => n + 1n)
  }
  function applyRoute(id: string, toggle: boolean, tab: OverviewTabId | undefined = undefined): void {
    const dest = resolveHudRoute(id, tab)
    if (dest === undefined) return
    if (dest.overviewTab !== undefined) setOverviewTab(dest.overviewTab)
    if (toggle && route === dest.route) {
      setRoute("")
      requestRestore()
      return
    }
    if (route.length === 0) rememberFocus()
    setRoute(dest.route)
  }
  function go(id: string): void {
    applyRoute(id, true)
  }
  function openRoute(id: string, tab: OverviewTabId | undefined = undefined): void {
    applyRoute(id, false, tab)
  }
  function clearSelection(): void {
    setSelectedId("")
    setProjection(undefined)
    restoreFocus()
  }
  function selectBuilding(objectId: string): void {
    rememberFocus()
    setSelectedId(objectId)
  }
  function onLocal(_effect: string): void {
    void _effect
  }
  function closeWorkspace(): void {
    if (isTxnInFlight(moneyTxn)) {
      setTxnHold(true)
      return
    }
    setTxnHold(false)
    setRoute("")
    requestRestore()
    if (moneyTxn !== undefined && moneyTxn.kind !== "confirmed" && moneyTxn.kind !== "failed") {
      setMoneyTxn(undefined)
    }
  }
  function manageSelected(): void {
    const dest = selection.manage
    if (dest === undefined) return
    const root = document.querySelector("[data-app='corporator']")
    const manage =
      root === null ? null : root.querySelector("[data-surface='selection'] [data-key='UI_MANAGE']")
    rememberFocus(manage)
    if (dest.districtId !== undefined) look(dest.districtId)
    openRoute(dest.route, dest.overviewTab)
  }
  const screenProps: ScreenProps = {
    view: props.view,
    pack: props.pack,
    strings: props.strings,
    demo: props.demo,
    failed,
    loading: false,
    onClose: closeWorkspace,
    onNavigate: go,
    pendingCell,
    pendingTileX,
    pendingTileY,
    onIntent: props.onIntent,
    onCommit: props.onCommit,
    onLocal,
    moneyTxn,
    onMoneyTxn: setMoneyTxn,
    ...(lookId.length > 0 ? { lookId } : {}),
    ...(selectedId.length > 0 ? { selectedObjectId: selectedId } : {}),
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (isTypingTarget(e.target)) return
      if (e.key === "Escape") {
        const target = hudEscapeTarget({
          txnInFlight: isTxnInFlight(moneyTxn),
          workspaceOpen: route.length > 0,
          selected: selectedId.length > 0,
        })
        if (target === "hold") {
          setTxnHold(true)
          return
        }
        if (target === "workspace") {
          closeWorkspace()
          return
        }
        if (target === "selection") {
          clearSelection()
          return
        }
        setProofId("")
        setTxnHold(false)
        return
      }
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [selectedId, moneyTxn, route])
  useEffect(() => {
    if (route.length > 0 || !pendingRestoreRef.current) return
    pendingRestoreRef.current = false
    restoreFocus()
  }, [route])
  const workspaceOpen = route.length > 0
  const islandChrome = islandChromeVisible(workspaceOpen)
  const workspaceTitle = workspaceLabel(props.view, route)
  const packId = packWorkspaceId(route)
  const workspace =
    route.length === 0 ? null : (
      <WorkspaceDrawer
        title={workspaceTitle.title}
        titleKey={workspaceTitle.key}
        closeLabel={props.view.close.text}
        closeKey={props.view.close.key}
        onClose={closeWorkspace}
        wide={workspaceDrawerWide(route)}
      >
        {isTxnInFlight(moneyTxn) ? (
          <p data-key="UI_TXN_CONTINUES" className="hud-row" role="status" aria-live="polite">
            {continuesText}
          </p>
        ) : null}
        {route === "overview" ? (
          <OverviewWorkspace
            view={props.view}
            tab={overviewTab}
            onTab={setOverviewTab}
            screen={screenProps}
            onSelectBuilding={selectBuilding}
          />
        ) : null}
        {route === "industries" ? (
          <IndustriesWorkspace
            view={props.view}
            pack={props.pack}
            strings={props.strings}
            onLook={(id) => {
              look(id)
              openRoute("district_card")
            }}
          />
        ) : null}
        {route === "journal" ? (
          <JournalFromLog
            view={props.view}
            strings={props.strings}
            extra={[]}
            openId={proofId}
            onBadge={(id) => {
              setProofId((cur) => (cur === id ? "" : id))
            }}
          />
        ) : null}
        {packId !== undefined ? renderPackScreen(packId, screenProps) : null}
      </WorkspaceDrawer>
    )
  const stubMode = props.sceneMode === "stub"
  const onSceneRoute = useCallback((screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint): void => {
    setPendingCell(cell)
    setPendingTileX(tileX)
    setPendingTileY(tileY)
    if (objectId.length === 0) {
      setSelectedId("")
      setProjection(undefined)
      if (!sceneClickOpensWorkspace(screen)) restoreFocus()
    } else {
      rememberFocus()
      setSelectedId(objectId)
    }
    if (sceneClickOpensWorkspace(screen)) {
      const dest = resolveHudRoute(screen)
      if (dest !== undefined) {
        if (dest.overviewTab !== undefined) setOverviewTab(dest.overviewTab)
        if (routeRef.current.length === 0) rememberFocus()
        setRoute(dest.route)
      }
    }
  }, [])
  const stubBuildings = useMemo((): readonly StubBuilding[] => {
    if (props.view.shell.functions.kind !== "ready") return []
    return props.view.shell.functions.rows.map((row) => ({ id: row.id, label: row.name }))
  }, [props.view.shell.functions])
  return (
    <HudShell
      style={geo}
      sceneRoute={route}
      sceneMode={stubMode ? "stub" : "live"}
      narrow={props.narrow}
      drawer={props.drawer}
      selected={selectedId}
      transactionHold={txnHold}
      adapterStatus={props.adapterStatus}
      adapterCode={props.adapterCode}
      scene={
        <IslandScene
          stubMode={stubMode}
          selectedObjectId={selectedId}
          stubBuildings={stubBuildings}
          onProjection={setProjection}
          onSceneRoute={onSceneRoute}
          palette={props.palette}
          camera={props.pack.camera}
          cityTime={cityTime}
          lookId={lookId}
          lookRev={lookRev}
          noGpuText={props.view.noGpu.text}
          light={props.pack.light}
          ticksDay={props.pack.ticksDay}
          occupied={props.pack.islandOccupied}
          bloomStrengthBps={props.pack.bloomStrengthBps}
          bloomRadiusBps={props.pack.bloomRadiusBps}
          bloomThresholdBps={props.pack.bloomThresholdBps}
        />
      }
      chrome={
        <>
          <Topbar view={props.view} onNavigate={go} />
          <LeftRail
            view={props.view}
            strings={props.strings}
            onManageFunds={() => {
              openRoute("bank")
            }}
            onPayroll={() => {
              openRoute("overview", "summary")
            }}
            onResource={() => {
              openRoute("overview", "production")
            }}
          />
          <div className="hud-scene-slot" aria-hidden="true" />
          {islandChrome ? (
            <RightRail
              view={props.view}
              strings={props.strings}
              pack={props.pack}
              onDetails={() => {
                openRoute("overview", "summary")
              }}
            />
          ) : null}
          {islandChrome ? (
            <FunctionStrip
              view={props.view}
              pack={props.pack}
              strings={props.strings}
              selectedId={selectedId}
              onViewAll={() => {
                openRoute("overview", "functions")
              }}
              onSelectBuilding={selectBuilding}
            />
          ) : null}
          {islandChrome ? (
            <RecentActivity
              view={props.view}
              strings={props.strings}
              extra={[]}
              openId={proofId}
              onBadge={(id) => {
                setProofId((cur) => (cur === id ? "" : id))
              }}
              onViewAll={() => {
                openRoute("journal")
              }}
            />
          ) : null}
        </>
      }
      selection={
        <BuildingPopover
          view={props.view}
          strings={props.strings}
          pack={props.pack}
          selection={selection}
          projection={projection}
          narrow={props.narrow}
          workspaceOpen={workspaceOpen}
          onManage={manageSelected}
          onClose={clearSelection}
        />
      }
      workspace={workspace}
      feedback={
        isTxnInFlight(moneyTxn) && route.length === 0 ? (
          <p data-key="UI_TXN_CONTINUES" className="hud-txn-banner" role="status" aria-live="polite">
            {continuesText}
          </p>
        ) : null
      }
    />
  )
})

function workspaceLabel(view: HudView, route: string): { readonly title: string; readonly key: string } {
  for (const row of view.shell.nav) {
    if (row.id === route) return { title: row.label, key: row.key }
  }
  return { title: view.shell.workspace, key: view.shell.workspaceKey }
}

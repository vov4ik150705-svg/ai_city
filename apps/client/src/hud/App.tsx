import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { isShore, loadScene } from "@corporator/render/ground"
import type { ClientPack } from "../packview.js"
import { hudCssVars } from "../palette.js"
import type { Palette } from "../palette.js"
import type { HudFixture } from "../layout.js"
import { lookup, type StringTable } from "../strings.js"
import { SceneStub } from "./SceneStub.js"
import { IslandTopbar as Topbar, type TopbarWallet } from "./topbar/IslandTopbar.js"
import { LeftRail } from "./left/LeftRail.js"
import { RecentActivity, RightRail } from "./right/RightRail.js"
import { FunctionStrip } from "./center/FunctionStrip.js"
import { WorkspaceDrawer } from "./parts/Drawer.js"
import { renderPackScreen } from "./screens/registry.js"
import type { ScreenProps } from "./parts/ScreenFrame.js"
import type { HudView } from "./model.js"
import type { OverviewTabId } from "./fields.js"
import {
  hudDestinationByShortcut,
  hudDestinationStep,
  hudPaneMotion,
  hudRoutePushesParent,
  packWorkspaceId,
  resolveHudRoute,
  sceneClickOpensWorkspace,
  workspaceDrawerWide,
  workspaceLoading,
} from "./navigation.js"
import {
  captureHudFocus,
  hudEscapeTarget,
  cabinetArrows,
  isTypingTarget,
  resolveHudFocusReturn,
  type HudFocusReturn,
} from "./keys.js"
import { OverviewWorkspace } from "./workspace/OverviewWorkspace.js"
import { IndustriesWorkspace } from "./workspace/IndustriesWorkspace.js"
import { JournalFromLog } from "./workspace/JournalFromLog.js"
import { CityLevelWorkspace } from "./workspace/CityLevelWorkspace.js"
import { BuildingPopover } from "./BuildingPopover.js"
import { resolveBuildingSelection, scenePickSelects } from "./selection.js"
import { isLocalReview, isTxnInFlight, type UiTxnState } from "./uiState.js"
import type { BankVoucher } from "./screens/bank.js"
import type { SceneProjection } from "./sceneProjection.js"
import { HudShell } from "./HudShell.js"
import type { CommitExtra, LiveAdapterResult, UiIntent } from "./liveAdapter.js"
import { storeLastCityTime } from "./flows.js"
import "./hud.css"
import "./hud-look.css"
import "./hud-light.css"

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

type HudPlace = {
  readonly route: string
  readonly overviewTab: OverviewTabId
  readonly lookId: string
  readonly selectedId: string
  readonly focusedAgentId: string
}

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
  readonly linkStale?: boolean
  readonly linkAgeMs?: bigint
  readonly linkWaitMs?: bigint
  readonly onDrawer: (id: string) => void
  readonly onIntent: (intent: UiIntent, extra?: CommitExtra) => void | Promise<void | LiveAdapterResult>
  readonly onCommit: (effect: string, extra?: CommitExtra) => void | Promise<void | LiveAdapterResult>
  readonly initialRoute?: string
  readonly cityId?: string
  readonly wallet?: TopbarWallet
  readonly bindTxn?: (set: (state: UiTxnState | undefined) => void) => void
  readonly bankVoucher?: BankVoucher
  readonly stockOut?: string
}): ReactElement {
  const [route, setRoute] = useState(props.initialRoute ?? "")
  const [stack, setStack] = useState<readonly HudPlace[]>([])
  const [lookId, setLookId] = useState("")
  const [lookRev, setLookRev] = useState(0n)
  const [proofId, setProofId] = useState("")
  const [pendingCell, setPendingCell] = useState("")
  const [pendingTileX, setPendingTileX] = useState(0n)
  const [pendingTileY, setPendingTileY] = useState(0n)
  const [overviewTab, setOverviewTab] = useState<OverviewTabId>("summary")
  const [selectedId, setSelectedId] = useState("")
  const [focusedAgentId, setFocusedAgentId] = useState("")
  const [projection, setProjection] = useState<SceneProjection | undefined>(undefined)
  const [moneyTxn, setMoneyTxn] = useState<UiTxnState | undefined>(undefined)
  useEffect(() => {
    props.bindTxn?.(setMoneyTxn)
  }, [props.bindTxn])
  const [txnHold, setTxnHold] = useState(false)
  const [shellMotion, setShellMotion] = useState<"in" | "out">("in")
  const [paneMotion, setPaneMotion] = useState<"in" | "forward" | "back">("in")
  const leavingRef = useRef(false)
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
  const failed = new Set<string>()
  if (tileBad) failed.add("build_tile")
  const selection = resolveBuildingSelection(selectedId, props.pack, props.view.functions)
  const used = new Set<string>()
  const continuesText = lookup(props.strings, "UI_TXN_CONTINUES", used)
  const staleText = lookup(props.strings, "UI_UNAVAILABLE", used)
  const linkStale = props.linkStale === true
  const linkAgeMs = props.linkAgeMs === undefined ? 0n : props.linkAgeMs
  const linkWaitMs = props.linkWaitMs === undefined ? 0n : props.linkWaitMs
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
  function pickOverviewTab(id: OverviewTabId): void {
    if (id === overviewTab) return
    if (route === "overview") {
      const place: HudPlace = { route, overviewTab, lookId, selectedId, focusedAgentId }
      setStack((prev) => [...prev, place])
    }
    setOverviewTab(id)
  }
  function backOverviewHome(): void {
    setOverviewTab("summary")
  }
  function applyRoute(
    id: string,
    toggle: boolean,
    tab: OverviewTabId | undefined = undefined,
    agentId: string | undefined = undefined,
  ): void {
    const dest = resolveHudRoute(id, tab)
    if (dest === undefined) return
    if (dest.overviewTab !== undefined) setOverviewTab(dest.overviewTab)
    if (toggle && route === dest.route) {
      closeWorkspace()
      return
    }
    leavingRef.current = false
    setShellMotion("in")
    setPaneMotion(hudPaneMotion(route, dest.route, false))
    const agentChanges = agentId !== undefined && agentId.length > 0 && agentId !== focusedAgentId
    const tabChanges = dest.overviewTab !== undefined && dest.overviewTab !== overviewTab
    if (route.length === 0) setStack([])
    else if (hudRoutePushesParent(route, dest.route, agentChanges, tabChanges)) {
      const place: HudPlace = { route, overviewTab, lookId, selectedId, focusedAgentId }
      setStack((prev) => [...prev, place])
    }
    if (agentId !== undefined && agentId.length > 0) setFocusedAgentId(agentId)
    else if (dest.route !== "agent_card") setFocusedAgentId("")
    if (route.length === 0) rememberFocus()
    setRoute(dest.route)
  }
  function backWorkspace(): void {
    const place = stack[stack.length - 1]
    if (place === undefined) return
    leavingRef.current = false
    setShellMotion("in")
    setPaneMotion("back")
    setStack((prev) => prev.slice(0, -1))
    setOverviewTab(place.overviewTab)
    setLookId(place.lookId)
    setSelectedId(place.selectedId)
    setFocusedAgentId(place.focusedAgentId)
    setRoute(place.route)
  }
  function go(id: string, objectId?: string): void {
    if (objectId !== undefined && objectId.length > 0) {
      applyRoute(id, false, undefined, objectId)
      return
    }
    applyRoute(id, true)
  }
  function openRoute(id: string, tab: OverviewTabId | undefined = undefined): void {
    applyRoute(id, false, tab)
  }
  function clearSelection(): void {
    setSelectedId("")
    setFocusedAgentId("")
    setProjection(undefined)
    restoreFocus()
  }
  function selectBuilding(objectId: string): void {
    rememberFocus()
    setSelectedId(objectId)
  }
  function openFunction(objectId: string): void {
    rememberFocus()
    setSelectedId(objectId)
    const dest = resolveBuildingSelection(objectId, props.pack, props.view.functions).manage
    if (dest === undefined) return
    if (dest.districtId !== undefined) look(dest.districtId)
    openRoute(dest.route, dest.overviewTab)
  }
  function onLocal(_effect: string): void {
    void _effect
  }
  function closeWorkspace(): void {
    if (isTxnInFlight(moneyTxn)) {
      setTxnHold(true)
      return
    }
    if (route === "offline_return") storeLastCityTime(props.cityId, cityTime)
    setTxnHold(false)
    requestRestore()
    if (moneyTxn !== undefined && moneyTxn.kind !== "confirmed" && moneyTxn.kind !== "failed") {
      setMoneyTxn(undefined)
    }
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (leavingRef.current || reduce || route.length === 0) {
      leavingRef.current = false
      setShellMotion("in")
      setStack([])
      setRoute("")
      setFocusedAgentId("")
      return
    }
    leavingRef.current = true
    setShellMotion("out")
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
    loading: workspaceLoading(route, props.view.logLoading),
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
    ...(route === "agent_card" && focusedAgentId.length > 0
      ? { selectedObjectId: focusedAgentId }
      : selectedId.length > 0
        ? { selectedObjectId: selectedId }
        : {}),
    ...(props.bankVoucher === undefined ? {} : { bankVoucher: props.bankVoucher }),
    ...(props.stockOut === undefined ? {} : { stockOut: props.stockOut }),
    ...(props.adapterCode.length > 0 ? { adapterCode: props.adapterCode } : {}),
  }
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (isTypingTarget(e.target)) return
      if (e.key === "Escape") {
        const target = hudEscapeTarget({
          txnInFlight: isTxnInFlight(moneyTxn),
          reviewOpen: isLocalReview(moneyTxn),
          workspaceOpen: route.length > 0,
          selected: selectedId.length > 0,
        })
        if (target === "hold") {
          setTxnHold(true)
          return
        }
        if (target === "review") {
          setMoneyTxn(undefined)
          return
        }
        if (target === "workspace") {
          if (stack.length > 0) backWorkspace()
          else closeWorkspace()
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
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (e.altKey || e.ctrlKey || e.metaKey) return
        if (route.length === 0 || !cabinetArrows(e.target)) return
        const dir = e.key === "ArrowRight" ? 1 : -1
        const next = hudDestinationStep(route, dir)
        if (next === undefined) {
          if (dir > 0) return
          e.preventDefault()
          if (stack.length > 0) backWorkspace()
          else closeWorkspace()
          return
        }
        e.preventDefault()
        openRoute(next)
        return
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const dest = hudDestinationByShortcut(e.key)
      if (dest === undefined) return
      e.preventDefault()
      openRoute(dest.id)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("keydown", onKey)
    }
  }, [selectedId, moneyTxn, route, stack])
  useEffect(() => {
    if (route.length > 0 || !pendingRestoreRef.current) return
    pendingRestoreRef.current = false
    restoreFocus()
  }, [route])
  useEffect(() => {
    if (route.length === 0) return
    function onPointerDown(event: PointerEvent): void {
      if (leavingRef.current) return
      if (isTxnInFlight(moneyTxn) || isLocalReview(moneyTxn)) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-surface='workspace'], .hud-dialog, .hud-dialog-scrim, .hud-flyout, .hud-popover, .hud-pick__menu, .hud-topbar, .hud-col--left") !== null) {
        return
      }
      closeWorkspace()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [route, moneyTxn])
  useEffect(() => {
    if (selectedId.length === 0 || route.length > 0) return
    function onPointerDown(event: PointerEvent): void {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-surface='selection'], .hud-dialog, .hud-dialog-scrim, .hud-flyout, .hud-pick__menu") !== null) return
      if (target.closest("[data-stub-building], canvas, [data-function] button") !== null) return
      clearSelection()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [selectedId, route])
  const workspaceOpen = route.length > 0
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
        onExited={closeWorkspace}
        motion={shellMotion}
        pane={paneMotion}
        paneKey={route}
        wide={workspaceDrawerWide(route)}
        workspaceId={route}
        {...(stack.length > 0
          ? { onBack: backWorkspace, backLabel: lookup(props.strings, "UI_BACK", used), backKey: "UI_BACK" }
          : route === "overview" && overviewTab !== "summary"
            ? { onBack: backOverviewHome, backLabel: lookup(props.strings, "UI_BACK", used), backKey: "UI_BACK" }
            : {})}
        {...(route === "overview" ? { mark: "chart" as const } : route === "journal" ? { mark: "log" as const } : route === "city_level" ? { mark: "city" as const } : {})}
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
            onTab={pickOverviewTab}
            screen={screenProps}
            onSelectBuilding={openFunction}
          />
        ) : null}
        {route === "industries" ? (
          <IndustriesWorkspace
            view={props.view}
            pack={props.pack}
            strings={props.strings}
            screen={screenProps}
            onLook={(id) => {
              look(id)
              openRoute("district_card")
            }}
          />
        ) : null}
        {route === "city_level" ? (
          <CityLevelWorkspace view={props.view} pack={props.pack} strings={props.strings} />
        ) : null}
        {route === "journal" ? (
          <JournalFromLog
            view={props.view}
            strings={props.strings}
            pack={props.pack}
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
    if (objectId.length > 0 && !scenePickSelects(objectId)) return
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
      sceneRoute={shellMotion === "out" ? "" : route}
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
          <Topbar
            view={props.view}
            onNavigate={go}
            strings={props.strings}
            linkStale={linkStale}
            demo={props.demo}
            chainId={props.pack.chainId}
            weiDecimals={props.pack.weiDecimals}
            {...(props.wallet === undefined ? {} : { wallet: props.wallet })}
          />
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
          <RightRail
            view={props.view}
            strings={props.strings}
            pack={props.pack}
            onDetails={() => {
              openRoute("overview", "summary")
            }}
            onLevel={() => {
              openRoute("city_level")
            }}
          />
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
          <RecentActivity
            view={props.view}
            strings={props.strings}
            pack={props.pack}
            extra={[]}
            openId={proofId}
            onBadge={(id) => {
              setProofId((cur) => (cur === id ? "" : id))
            }}
            onViewAll={() => {
              openRoute("journal")
            }}
          />
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
        <>
          {linkStale ? (
            <p
              data-link="stale"
              data-stale-age={linkAgeMs.toString()}
              data-stale-wait={linkWaitMs.toString()}
              className="hud-stale"
              role="status"
              aria-live="polite"
            >
              {staleText}
            </p>
          ) : null}
          {isTxnInFlight(moneyTxn) && route.length === 0 ? (
            <p data-key="UI_TXN_CONTINUES" className="hud-txn-banner" role="status" aria-live="polite">
              {continuesText}
            </p>
          ) : null}
        </>
      }
    />
  )
})

function workspaceLabel(view: HudView, route: string): { readonly title: string; readonly key: string } {
  if (route === "leaderboard") return { title: view.shell.season.text, key: view.shell.season.key }
  if (route === "city_level") return { title: view.shell.cityLevelLabel, key: view.shell.cityLevelLabelKey }
  for (const row of view.shell.nav) {
    if (row.id === route) return { title: row.label, key: row.key }
  }
  return { title: view.shell.workspace, key: view.shell.workspaceKey }
}

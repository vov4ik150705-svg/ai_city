import { createRoot } from "react-dom/client"
import { useEffect, useState, type ReactElement } from "react"
import { type Json } from "@corporator/contentpack"
import { codes } from "@corporator/protocol"
import { App, type HudSceneMode } from "./hud/App.js"
import { FontFaces } from "./hud/parts/FontFaces.js"
import { hudNarrowLimit } from "./hud/parts/shell.js"
import { buildHud, type ClientSnapshot } from "./hud/model.js"
import { loadHudPreviewAssets } from "./hudPreviewData.js"
import type { ClientPack } from "./packview.js"
import type { StringTable } from "./strings.js"
import type { Palette } from "./palette.js"
import { wallNowMs } from "./clock.js"
import type { HudFixture } from "./layout.js"
import { intentFromCommit, type CommitExtra, type UiIntent } from "./hud/liveAdapter.js"
import type { TopbarWallet } from "./hud/topbar/IslandTopbar.js"

function BootError(props: { readonly code: string; readonly preview: string }): ReactElement {
  return <div data-app="boot-error" data-preview={props.preview} data-key={props.code} />
}

function PreviewRoot(props: {
  readonly pack: ClientPack
  readonly strings: StringTable
  readonly hud: HudFixture
  readonly palette: Palette
  readonly snapshot: ClientSnapshot
  readonly sceneMode: HudSceneMode
}): ReactElement {
  const [firstLoginMs] = useState(() => wallNowMs())
  const [nowMs, setNowMs] = useState(() => wallNowMs())
  const [narrow, setNarrow] = useState(false)
  const [drawer, setDrawer] = useState("")
  const [adapterStatus, setAdapterStatus] = useState("local")
  const [adapterCode, setAdapterCode] = useState("")
  const [snap, setSnap] = useState(props.snapshot)
  const view = buildHud({
    pack: props.pack,
    strings: props.strings,
    snapshot: snap,
    nowMs,
    firstLoginMs,
    demo: true,
  })
  const previewWallet = previewTopbarWallet()

  useEffect(() => {
    const ms = Number(props.pack.clockIntervalMs)
    const id = window.setInterval(() => {
      setNowMs(wallNowMs())
    }, ms)
    return () => {
      window.clearInterval(id)
    }
  }, [props.pack.clockIntervalMs])

  useEffect(() => {
    function measure(): void {
      const limit = hudNarrowLimit(props.hud, props.pack.packSafeW)
      setNarrow(BigInt(window.innerWidth) < limit)
    }
    measure()
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("resize", measure)
    }
  }, [props.hud, props.pack.packSafeW])

  async function onIntent(intent: UiIntent, extra?: CommitExtra): Promise<void> {
    void extra
    let applied = false
    setSnap((cur) => {
      const next = applyPreviewIntent(cur, intent)
      if (next === undefined) return cur
      applied = true
      return next
    })
    if (applied) {
      setAdapterStatus("applied")
      setAdapterCode("")
      return
    }
    if (intent.kind === "upgrade" || intent.kind === "research_start") {
      setAdapterStatus("local")
      setAdapterCode("")
      return
    }
    setAdapterStatus("local")
    setAdapterCode(codes.FEATURE_NOT_IN_V1)
    throw new Error(codes.FEATURE_NOT_IN_V1)
  }

  async function onCommit(effect: string, extra?: { readonly [key: string]: Json }): Promise<void> {
    return extra === undefined ? onIntent(intentFromCommit(effect)) : onIntent(intentFromCommit(effect, extra), extra)
  }

  return (
    <>
      <FontFaces pixelFamily={props.pack.fontPixelFamily} logFamily={props.pack.fontLogFamily} />
      <App
        view={view}
        pack={props.pack}
        strings={props.strings}
        hud={props.hud}
        palette={props.palette}
        tileW={props.pack.tileW}
        scene={props.pack.scene}
        sceneMode={props.sceneMode}
        narrow={narrow}
        drawer={drawer}
        demo={true}
        adapterStatus={adapterStatus}
        adapterCode={adapterCode}
        onDrawer={setDrawer}
        onIntent={onIntent}
        onCommit={onCommit}
        {...(previewWallet === undefined ? {} : { wallet: previewWallet })}
      />
    </>
  )
}

function previewWalletSnap(snapshot: ClientSnapshot): ClientSnapshot {
  if (typeof window === "undefined") return snapshot
  const params = new URLSearchParams(window.location.search)
  if (params.get("wallet") !== "1") return snapshot
  const prev = snapshot.gate
  return {
    ...snapshot,
    accountKind: "wallet",
    gate: {
      openedDistricts: prev?.openedDistricts,
      chainWrong: false,
      districts: prev?.districts,
      stakeThresholdMet: prev?.stakeThresholdMet,
      tierUnlocked: prev?.tierUnlocked,
      stakeMultMet: prev?.stakeMultMet,
      nodeSideOpen: prev?.nodeSideOpen,
      mergeFree: prev?.mergeFree,
    },
  }
}

/** Work-preview only (`?wallet=1`). The address is a layout fixture; the
 * $CORP figure stays the snapshot balance, not the mock's 1,840. */
function previewTopbarWallet(): TopbarWallet | undefined {
  if (typeof window === "undefined") return undefined
  const params = new URLSearchParams(window.location.search)
  if (params.get("wallet") !== "1") return undefined
  return {
    address: "0x4c91g00000000000000000000000000000000a2e7",
    connect: () => Promise.resolve(""),
    disconnect: () => {},
  }
}

export function applyPreviewIntent(snap: ClientSnapshot, intent: UiIntent): ClientSnapshot | undefined {
  if (intent.kind === "upgrade") return previewUpgrade(snap, intent.buildingId)
  if (intent.kind === "research_start") return previewResearch(snap, intent.axisId)
  const agents = snap.agents
  if (agents === undefined) return undefined
  if (intent.kind === "assign") {
    const agentId = intent.agentId ?? ""
    const buildingId = intent.buildingId ?? ""
    if (agentId.length === 0 || buildingId.length === 0) return undefined
    return {
      ...snap,
      agents: agents.map((row) => (row.id === agentId ? { ...row, buildingId } : row)),
    }
  }
  if (intent.kind === "set_objective") {
    const agentId = intent.agentId ?? ""
    if (agentId.length === 0 || intent.objective.length === 0) return undefined
    return {
      ...snap,
      agents: agents.map((row) => (row.id === agentId ? { ...row, objective: intent.objective } : row)),
    }
  }
  return undefined
}

function previewUpgrade(snap: ClientSnapshot, buildingId: string): ClientSnapshot | undefined {
  const functions = snap.functions
  if (buildingId.length === 0 || functions === undefined) return undefined
  let hit = false
  const next = functions.map((row) => {
    if (row.id !== buildingId || row.level === undefined) return row
    hit = true
    return { ...row, level: row.level + 1n }
  })
  if (!hit) return undefined
  return { ...snap, functions: next }
}

function previewResearch(snap: ClientSnapshot, axisId: string): ClientSnapshot | undefined {
  if (axisId.length === 0) return undefined
  return { ...snap, researchFocus: axisId }
}

export async function bootHudPreview(sceneMode: HudSceneMode): Promise<void> {
  const rootEl = document.getElementById("root")
  if (rootEl === null) throw new Error(codes.API_MALFORMED)
  const root = createRoot(rootEl)
  const preview = sceneMode === "stub" ? "hud-work" : "hud"
  try {
    const assets = await loadHudPreviewAssets()
    root.render(
      <PreviewRoot
        pack={assets.pack}
        strings={assets.strings}
        hud={assets.hud}
        palette={assets.palette}
        snapshot={previewWalletSnap(assets.snapshot)}
        sceneMode={sceneMode}
      />,
    )
  } catch {
    root.render(<BootError code={codes.API_PACK_STALE} preview={preview} />)
  }
}

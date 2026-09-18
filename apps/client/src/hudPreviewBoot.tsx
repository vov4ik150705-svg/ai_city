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
  const view = buildHud({
    pack: props.pack,
    strings: props.strings,
    snapshot: props.snapshot,
    nowMs,
    firstLoginMs,
    demo: true,
  })

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

  async function onIntent(_intent: UiIntent, _extra?: CommitExtra): Promise<void> {
    void _intent
    void _extra
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
      />
    </>
  )
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
        snapshot={assets.snapshot}
        sceneMode={sceneMode}
      />,
    )
  } catch {
    root.render(<BootError code={codes.API_PACK_STALE} preview={preview} />)
  }
}

import { createRoot } from "react-dom/client"
import { useState, type CSSProperties, type ReactElement } from "react"
import { codes } from "@corporator/protocol"
import { FontFaces } from "./hud/parts/FontFaces.js"
import { buildHud } from "./hud/model.js"
import { loadHudPreviewAssets, type HudPreviewAssets } from "./hudPreviewData.js"
import { hudCssVars } from "./palette.js"
import { PanelStudio } from "./hud/studio/PanelStudio.js"
import { wallNowMs } from "./clock.js"

function BootError(props: { readonly code: string }): ReactElement {
  return <div data-app="boot-error" data-preview="hud-panels" data-key={props.code} />
}

function LoadedStudio(props: HudPreviewAssets): ReactElement {
  const [stamp] = useState(() => wallNowMs())
  const view = buildHud({
    pack: props.pack,
    strings: props.strings,
    snapshot: props.snapshot,
    nowMs: stamp,
    firstLoginMs: stamp,
    demo: true,
  })
  const vars = hudCssVars(props.palette)
  const style: CSSProperties = { ...vars }
  return (
    <>
      <FontFaces pixelFamily={props.pack.fontPixelFamily} logFamily={props.pack.fontLogFamily} />
      <PanelStudio view={view} strings={props.strings} pack={props.pack} style={style} />
    </>
  )
}

export async function bootHudStudio(): Promise<void> {
  const rootEl = document.getElementById("root")
  if (rootEl === null) throw new Error(codes.API_MALFORMED)
  const root = createRoot(rootEl)
  try {
    const assets = await loadHudPreviewAssets()
    root.render(
      <LoadedStudio
        pack={assets.pack}
        strings={assets.strings}
        hud={assets.hud}
        palette={assets.palette}
        snapshot={assets.snapshot}
      />,
    )
  } catch {
    root.render(<BootError code={codes.API_PACK_STALE} />)
  }
}

if (typeof document !== "undefined") void bootHudStudio()

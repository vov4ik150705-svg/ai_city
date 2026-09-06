import type { ReactElement } from "react"
import pixelUrl from "../../../../../art/fonts/press_start_2p.woff2?url"
import logUrl from "../../../../../art/fonts/ibm_plex_sans.woff2?url"

export function FontFaces(props: {
  readonly pixelFamily?: string
  readonly logFamily?: string
}): ReactElement {
  const pixel = props.pixelFamily ?? "hud-pixel"
  const log = props.logFamily ?? "hud-log"
  const css =
    "@font-face{font-family:" +
    JSON.stringify(pixel) +
    ";src:url(" +
    JSON.stringify(pixelUrl) +
    ") format('woff2');font-display:swap;}" +
    "@font-face{font-family:" +
    JSON.stringify(log) +
    ";src:url(" +
    JSON.stringify(logUrl) +
    ") format('woff2');font-display:swap;}" +
    ":root{--hud-face-pixel:" +
    JSON.stringify(pixel) +
    ";--hud-face-log:" +
    JSON.stringify(log) +
    ";}"
  return <style>{css}</style>
}

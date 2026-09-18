import type { ReactElement } from "react"
import uiUrl from "../../../../../art/fonts/ibm_plex_sans.woff2?url"
import logUrl from "../../../../../art/fonts/jetbrains_mono.woff2?url"

const UI_FAMILY = "IBM Plex Sans"
const DATA_FAMILY = "JetBrains Mono"

function approvedUi(name: string | undefined): string {
  return name === UI_FAMILY ? name : UI_FAMILY
}

function approvedData(name: string | undefined): string {
  return name === DATA_FAMILY ? name : DATA_FAMILY
}

export function FontFaces(props: {
  readonly pixelFamily?: string
  readonly logFamily?: string
}): ReactElement {
  const uiFamily = approvedUi(props.pixelFamily)
  const dataFamily = approvedData(props.logFamily)
  const css =
    "@font-face{font-family:" +
    JSON.stringify(uiFamily) +
    ";src:url(" +
    JSON.stringify(uiUrl) +
    ") format('woff2');font-style:normal;font-weight:400;font-display:swap;}" +
    "@font-face{font-family:" +
    JSON.stringify(dataFamily) +
    ";src:url(" +
    JSON.stringify(logUrl) +
    ") format('woff2');font-display:swap;}" +
    ":root{--hud-face-ui:" +
    JSON.stringify(uiFamily) +
    ";--hud-face-display:" +
    JSON.stringify(uiFamily) +
    ";--hud-face-data:" +
    JSON.stringify(dataFamily) +
    ";}"
  return <style>{css}</style>
}

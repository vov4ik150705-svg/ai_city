import type { ReactElement } from "react"
import type { HudView } from "../model.js"
import { DistrictsPanel } from "../left/Overview.js"

/** Presentation adapter: Industries workspace reuses the districts view, not active functions. */
export function IndustriesFromDistricts(props: {
  readonly view: HudView
  readonly onLook: (id: string) => void
}): ReactElement {
  const titleRow = props.view.left.find((row) => row.id === "districts")
  const title = titleRow === undefined ? props.view.shell.nav.find((row) => row.id === "industries")?.label ?? "" : titleRow.title
  const titleKey = titleRow === undefined ? "UI_DISTRICTS" : titleRow.key
  return <DistrictsPanel title={title} titleKey={titleKey} rows={props.view.districts} onLook={props.onLook} />
}

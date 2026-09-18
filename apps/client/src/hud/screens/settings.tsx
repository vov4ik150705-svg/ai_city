import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

/** Pack compatibility surface; navigation intentionally never resolves to settings. */
export function SettingsScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const unavailable = lookup(props.strings, "UI_UNAVAILABLE", used)
  return (
    <ScreenFrame id="settings" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <section className="hud-setting--dead" data-settings-active="0" aria-hidden="true">
        <span data-key="UI_UNAVAILABLE">{unavailable}</span>
      </section>
    </ScreenFrame>
  )
}

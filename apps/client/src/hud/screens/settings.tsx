import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ActionButton } from "../parts/ActionButton.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function SettingsScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  return (
    <ScreenFrame id="settings" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      <ul className="hud-list">
        {props.pack.settingsRows.map((row) => (
          <li key={row.id} data-setting={row.id} data-v1={row.v1}>
            {row.id === "autopilot" ? (
              <ActionButton {...props} actionId="settings_open_companion" />
            ) : (
              lookup(props.strings, row.labelKey, used)
            )}
          </li>
        ))}
      </ul>
    </ScreenFrame>
  )
}

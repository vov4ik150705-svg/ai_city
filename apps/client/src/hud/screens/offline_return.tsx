import type { ReactElement } from "react"
import { lookup } from "../../strings.js"
import { ScreenFrame, type ScreenProps } from "../parts/ScreenFrame.js"

export function OfflineReturnScreen(props: ScreenProps): ReactElement {
  const used = new Set<string>()
  const continueLabel = lookup(props.strings, "UI_CONTINUE", used)
  const caughtUp = lookup(props.strings, "UI_OFFLINE_CAUGHT_UP", used)
  const hours = props.view.offlineHours
  return (
    <ScreenFrame id="offline_return" view={props.view} loading={props.loading} empty={false} onClose={props.onClose}>
      {hours === undefined ? (
        <p data-offline="caught-up" data-key="UI_OFFLINE_CAUGHT_UP">
          {caughtUp}
        </p>
      ) : (
        <p data-offline="hours" data-exact={hours.toString()}>
          {hours.toString()}
        </p>
      )}
      <button type="button" className="hud-action hud-btn hud-btn--primary" data-action="offline_continue" data-effect="navigate" onClick={props.onClose}>
        {continueLabel}
      </button>
    </ScreenFrame>
  )
}

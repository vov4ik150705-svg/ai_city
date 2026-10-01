import type { ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import type { StringTable } from "../../strings.js"
import type { HudView } from "../model.js"
import { RecentActivityLook } from "../studio/RecentActivityLook.js"
import { CityLevelPanel } from "./CityLevelPanel.js"
import { CityStatusPanel } from "./CityStatusPanel.js"

export function RightRail(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly pack: ClientPack
  readonly onDetails?: () => void
  readonly onDistricts?: () => void
  readonly onLevel?: () => void
}): ReactElement {
  return (
    <aside data-surface="right_panel" className="hud-col hud-col--right">
      <CityLevelPanel
        view={props.view}
        strings={props.strings}
        pack={props.pack}
        {...(props.onLevel === undefined ? {} : { onOpen: props.onLevel })}
      />
      <CityStatusPanel
        view={props.view}
        strings={props.strings}
        pack={props.pack}
        {...(props.onDetails === undefined ? {} : { onDetails: props.onDetails })}
        {...(props.onDistricts === undefined ? {} : { onDistricts: props.onDistricts })}
      />
    </aside>
  )
}

export function RecentActivity(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly extra: readonly { readonly id: string; readonly key: string; readonly text: string }[]
  readonly openId: string
  readonly onBadge: (id: string) => void
  readonly onViewAll: () => void
  readonly pack?: ClientPack
}): ReactElement {
  void props.openId
  void props.onBadge
  return (
    <RecentActivityLook
      view={props.view}
      strings={props.strings}
      extra={props.extra}
      onViewAll={props.onViewAll}
      {...(props.pack === undefined ? {} : { pack: props.pack })}
    />
  )
}

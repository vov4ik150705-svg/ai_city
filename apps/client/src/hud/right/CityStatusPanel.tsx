import type { ReactElement } from "react"
import type { ClientPack } from "../../packview.js"
import type { StringTable } from "../../strings.js"
import type { HudView } from "../model.js"
import { CityStatusLook } from "../studio/CityStatusLook.js"

export function CityStatusPanel(props: {
  readonly view: HudView
  readonly strings: StringTable
  readonly pack: ClientPack
  readonly onDetails?: () => void
  readonly onDistricts?: () => void
}): ReactElement {
  return (
    <CityStatusLook
      view={props.view}
      strings={props.strings}
      pack={props.pack}
      {...(props.onDetails === undefined ? {} : { onDetails: props.onDetails })}
      {...(props.onDistricts === undefined ? {} : { onDistricts: props.onDistricts })}
    />
  )
}

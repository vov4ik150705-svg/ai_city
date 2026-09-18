import type { ReactElement } from "react"
import { lookup, type StringTable } from "../../strings.js"
import type { ClientPack } from "../../packview.js"
import type { HudView } from "../model.js"
import { ActiveFunctionsLook } from "../studio/ActiveFunctionsLook.js"

export function FunctionStrip(props: {
  readonly view: HudView
  readonly pack: ClientPack
  readonly strings?: StringTable
  readonly selectedId?: string
  readonly onViewAll?: () => void
  readonly onSelectBuilding?: (objectId: string) => void
}): ReactElement {
  const strings = props.strings
  const used = new Set<string>()
  const unavailable = strings === undefined ? props.view.shell.functions.message : lookup(strings, "UI_UNAVAILABLE", used)
  return (
    <ActiveFunctionsLook
      view={props.view}
      pack={props.pack}
      unavailable={unavailable}
      {...(props.selectedId === undefined ? {} : { selectedId: props.selectedId })}
      {...(props.onViewAll === undefined ? {} : { onViewAll: props.onViewAll })}
      {...(props.onSelectBuilding === undefined ? {} : { onSelectBuilding: props.onSelectBuilding })}
    />
  )
}

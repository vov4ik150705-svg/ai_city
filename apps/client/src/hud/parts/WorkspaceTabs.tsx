import type { ReactElement } from "react"

export type WorkspaceTabSpec<Id extends string = string> = {
  readonly id: Id
  readonly key: string
  readonly label: string
}

export function WorkspaceTabs<Id extends string>(props: {
  readonly label: string
  readonly tabPrefix: string
  readonly panelId: (id: Id) => string
  readonly tabs: readonly WorkspaceTabSpec<Id>[]
  readonly active: Id
  readonly onPick: (id: Id) => void
}): ReactElement {
  return (
    <div className="hud-tabs" role="tablist" aria-label={props.label}>
      {props.tabs.map((tab) => {
        const on = tab.id === props.active
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${props.tabPrefix}${tab.id}`}
            data-key={tab.key}
            aria-selected={on}
            aria-controls={props.panelId(tab.id)}
            className={on ? "hud-tabs__btn hud-tabs__btn--on" : "hud-tabs__btn"}
            onClick={() => {
              props.onPick(tab.id)
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export const Tabs = WorkspaceTabs

import type { ReactElement } from "react"

export function Loading(props: { readonly kind: string }): ReactElement {
  return <div data-loading={props.kind} className="hud-load" />
}

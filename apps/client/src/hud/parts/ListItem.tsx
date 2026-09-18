import type { ReactElement, ReactNode } from "react"

export function ListItem(props: {
  readonly className?: string
  readonly leading?: ReactNode
  readonly trailing?: ReactNode
  readonly ariaLabel?: string
  readonly onClick?: () => void
  readonly children: ReactNode
}): ReactElement {
  const className = ["hud-list-item", props.className]
    .filter((part) => part !== undefined && part.length > 0)
    .join(" ")
  if (props.onClick === undefined) {
    return (
      <div className={className}>
        {props.leading === undefined ? null : <span className="hud-list-item__leading">{props.leading}</span>}
        <span className="hud-list-item__body">{props.children}</span>
        {props.trailing === undefined ? null : <span className="hud-list-item__trailing">{props.trailing}</span>}
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`${className} hud-list-item--interactive`}
      {...(props.ariaLabel === undefined ? {} : { "aria-label": props.ariaLabel })}
      onClick={props.onClick}
    >
      {props.leading === undefined ? null : <span className="hud-list-item__leading">{props.leading}</span>}
      <span className="hud-list-item__body">{props.children}</span>
      {props.trailing === undefined ? null : <span className="hud-list-item__trailing">{props.trailing}</span>}
    </button>
  )
}

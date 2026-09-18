import type { ButtonHTMLAttributes, ReactElement, ReactNode } from "react"

export function IconButton(
  props: {
    readonly label: string
    readonly labelKey: string
    readonly children?: ReactNode
  } & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "aria-pressed" | "aria-expanded">,
): ReactElement {
  const child = props.children
  return (
    <button
      type="button"
      data-key={props.labelKey}
      className="hud-iconbtn"
      aria-label={props.label}
      title={props.label}
      disabled={props.disabled}
      aria-pressed={props["aria-pressed"]}
      aria-expanded={props["aria-expanded"]}
      onClick={props.onClick}
    >
      {child === undefined ? <span className="hud-iconbtn__label">{props.label}</span> : child}
    </button>
  )
}

import type { ReactElement, ReactNode } from "react"

export function Section(props: {
  readonly id?: string
  readonly className?: string
  readonly children: ReactNode
}): ReactElement {
  const className = ["hud-section", props.className]
    .filter((part) => part !== undefined && part.length > 0)
    .join(" ")
  return (
    <section
      {...(props.id === undefined ? {} : { "data-id": props.id })}
      className={className}
    >
      {props.children}
    </section>
  )
}

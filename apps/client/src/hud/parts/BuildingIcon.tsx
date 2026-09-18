import type { ReactElement } from "react"
import { BuildingThumbnail } from "./BuildingThumbnail.js"

export function BuildingIcon(props: {
  readonly buildingId: string
  readonly className?: string
}): ReactElement {
  const className = props.className
  if (className === undefined) {
    return <BuildingThumbnail buildingId={props.buildingId} unavailable="" compact={true} fallbackIcon={true} />
  }
  return (
    <BuildingThumbnail buildingId={props.buildingId} unavailable="" compact={true} fallbackIcon={true} className={className} />
  )
}

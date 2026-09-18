import { useEffect, useRef, type ReactElement } from "react"
import type { SceneProjection } from "./sceneProjection.js"

export type SceneStubBuilding = {
  readonly id: string
  readonly label: string
}

export function SceneStub(props: {
  readonly selectedObjectId: string
  readonly buildings: readonly SceneStubBuilding[]
  readonly onSceneRoute: (screen: string, objectId: string, cell: string, tileX: bigint, tileY: bigint) => void
  readonly onProjection: (proj: SceneProjection | undefined) => void
}): ReactElement {
  const hostRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(props.selectedObjectId)
  selectedRef.current = props.selectedObjectId
  const projectRef = useRef(props.onProjection)
  projectRef.current = props.onProjection

  function emitProjection(objectId: string): void {
    if (objectId.length === 0) {
      projectRef.current(undefined)
      return
    }
    const host = hostRef.current
    if (host === null) {
      projectRef.current(undefined)
      return
    }
    const chip = host.querySelector(`[data-stub-building="${CSS.escape(objectId)}"]`)
    if (!(chip instanceof HTMLElement)) {
      projectRef.current({ x: host.clientWidth / 2, y: host.clientHeight / 2, visible: true })
      return
    }
    const box = chip.getBoundingClientRect()
    const hostBox = host.getBoundingClientRect()
    projectRef.current({
      x: box.left - hostBox.left + box.width / 2,
      y: box.top - hostBox.top,
      visible: true,
    })
  }

  useEffect(() => {
    emitProjection(props.selectedObjectId)
  }, [props.selectedObjectId, props.buildings])

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    function project(): void {
      emitProjection(selectedRef.current)
    }
    const ro = new ResizeObserver(() => {
      project()
    })
    ro.observe(host)
    window.addEventListener("resize", project)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", project)
    }
  }, [])

  return (
    <div ref={hostRef} data-surface="scene-stub" className="hud-scene hud-scene-stub">
      <p className="hud-scene-stub__note">HUD work — Terra not loaded</p>
      <div className="hud-scene-stub__deck" role="list">
        {props.buildings.map((row) => (
          <button
            key={row.id}
            type="button"
            role="listitem"
            data-stub-building={row.id}
            className="hud-scene-stub__chip"
            aria-pressed={props.selectedObjectId === row.id}
            onClick={(e) => {
              e.stopPropagation()
              props.onSceneRoute("building_card", row.id, ".", 0n, 0n)
            }}
          >
            {row.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="hud-scene-stub__clear"
        onClick={() => {
          props.onSceneRoute("", "", ".", 0n, 0n)
        }}
      >
        Clear selection
      </button>
    </div>
  )
}
